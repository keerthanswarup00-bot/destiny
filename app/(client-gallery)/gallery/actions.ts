"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashIp } from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";
import { ensureViewerKeyHash, grantGalleryAccess, identifyViewer, requireGalleryAccess, resolveGalleryAccess } from "@/lib/gallery-access";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { downloadFilename } from "@/lib/client-media";
import { ensurePhotoShareToken, photoFromShareToken, signedDownloadUrl } from "@/lib/photo-share";

export type PasswordState = { error: string | null };
export type IdentifyState = { ok: boolean; error: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const GENERIC_FAILURE = "Unable to open this gallery.";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function sharedPhotoOrigin() {
  const configuredHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (!configuredHost && process.env.NODE_ENV === "production") {
    throw new Error("shared-photo-origin-not-configured");
  }
  const origin = new URL(`https://${configuredHost || "localhost:3000"}`);
  if (process.env.NODE_ENV !== "production") origin.protocol = "http:";
  return origin.origin;
}

async function requestFingerprint() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip") || "unknown";
  return hashIp(ip);
}

async function recentFailures(galleryId: string, ipHash: string) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await galleryDb().from("access_attempts").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId).eq("succeeded", false).eq("ip_hash", ipHash).gte("attempted_at", since);
  return count ?? 0;
}

async function recordAttempt(galleryId: string, succeeded: boolean, ipHash: string, failureReason: string | null) {
  await galleryDb().from("access_attempts").insert({ gallery_id: galleryId, succeeded, ip_hash: ipHash, user_agent: null, failure_reason: failureReason });
}

export async function submitGalleryPassword(_: PasswordState, form: FormData): Promise<PasswordState> {
  const slug = String(form.get("slug") ?? "").trim();
  const password = String(form.get("password") ?? "");
  try {
    const ipHash = await requestFingerprint();
    const { data: gallery } = await galleryDb().from("galleries").select("id,slug,status,password_hash").eq("slug", slug).maybeSingle();
    if (!gallery || gallery.status !== "published" || !gallery.password_hash) {
      return { error: GENERIC_FAILURE };
    }
    if (await recentFailures(gallery.id, ipHash) >= MAX_FAILURES) {
      await recordAttempt(gallery.id, false, ipHash, "rate_limited");
      return { error: GENERIC_FAILURE };
    }
    const valid = await verifyGalleryPassword(password, gallery.password_hash);
    if (!valid) {
      await recordAttempt(gallery.id, false, ipHash, "invalid");
      return { error: GENERIC_FAILURE };
    }
    await recordAttempt(gallery.id, true, ipHash, null);
    await grantGalleryAccess(gallery.id, gallery.password_hash);
    redirect(`/gallery/${gallery.slug}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    return { error: GENERIC_FAILURE };
  }
}

/**
 * Bind the current viewer session to an email so the client's favourites persist
 * across visits. The email is never stored or echoed — only sealed into the
 * existing HttpOnly viewer cookie, which already keys the favourites table.
 */
export async function identifyGalleryViewer(form: FormData): Promise<IdentifyState> {
  const slug = String(form.get("slug") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  try {
    const access = await resolveGalleryAccess(slug);
    if (access.state !== "granted") {
      return { ok: false, error: "This gallery is unavailable." };
    }
    await identifyViewer(email);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Unable to save your email. Try again." };
  }
}

export async function togglePhotoFavorite(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const photoId = String(form.get("photo_id") ?? "").trim();
  const selected = String(form.get("selected") ?? "") === "true";

  const gallery = await requireGalleryAccess(slug);
  const db = galleryDb();
  const viewerHash = await ensureViewerKeyHash();

  const { data: photo } = await db
    .from("photos")
    .select("id")
    .eq("id", photoId)
    .eq("gallery_id", gallery.id)
    .maybeSingle();

  if (!photo) {
    return {
      ok: false as const,
      error: "That photograph is unavailable.",
      selected: false,
    };
  }

  if (selected) {
    const { error } = await db
      .from("selections")
      .upsert(
        {
          gallery_id: gallery.id,
          photo_id: photo.id,
          viewer_name: "Guest",
          viewer_key_hash: viewerHash,
        },
        {
          onConflict: "gallery_id,photo_id,viewer_key_hash",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      return {
        ok: false as const,
        error: "Unable to save this favourite.",
        selected: false,
      };
    }
  } else {
    const { error } = await db
      .from("selections")
      .delete()
      .eq("gallery_id", gallery.id)
      .eq("photo_id", photo.id)
      .eq("viewer_key_hash", viewerHash);

    if (error) {
      return {
        ok: false as const,
        error: "Unable to remove this favourite.",
        selected: true,
      };
    }
  }

  return {
    ok: true as const,
    error: null,
    selected,
  };
}

type DownloadResult = { url: string | null; filename: string | null; error: string | null };

/**
 * Resolve the visible download name for a photo: GALLERY-SET-NNN.ext.
 * The number is the photo's 1-based position within its OWN Set; the name is
 * generated server-side and never taken from the browser.
 */
async function photoDownloadInfo(galleryId: string, photoId: string) {
  const db = galleryDb();
  const { data: photo } = await db.from("photos").select("id,folder_id,filename,sort_order,thumbnail_path,preview_path,download_path,original_path").eq("id", photoId).eq("gallery_id", galleryId).maybeSingle();
  if (!photo) return null;
  const [{ data: folder }, { data: gallery }, { data: folderPhotos }] = await Promise.all([
    db.from("folders").select("name").eq("id", photo.folder_id).eq("gallery_id", galleryId).maybeSingle(),
    db.from("galleries").select("title").eq("id", galleryId).maybeSingle(),
    db.from("photos").select("id,sort_order").eq("gallery_id", galleryId).eq("folder_id", photo.folder_id).order("sort_order").order("id"),
  ]);
  const index = (folderPhotos ?? []).findIndex(row => row.id === photo.id) + 1;
  const filename = downloadFilename({
    galleryTitle: gallery?.title || galleryId,
    folderName: folder?.name || "Gallery",
    index,
    photo,
  });
  return { photo, filename };
}

export async function downloadGalleryPhoto(form: FormData): Promise<DownloadResult> {
  const slug = String(form.get("slug") ?? "").trim();
  const photoId = String(form.get("photo_id") ?? "").trim();
  try {
    const gallery = await requireGalleryAccess(slug);
    const info = await photoDownloadInfo(gallery.id, photoId);
    if (!info) return { url: null, filename: null, error: "That photograph is unavailable." };
    const resolved = await signedDownloadUrl(info.filename, info.photo);
    return resolved ? { url: resolved.url, filename: resolved.name, error: null } : { url: null, filename: info.filename, error: "Download is unavailable right now." };
  } catch {
    return { url: null, filename: null, error: "Download is unavailable right now." };
  }
}

export async function downloadGalleryPhotos(form: FormData): Promise<{ items: DownloadResult[]; error: string | null }> {
  const slug = String(form.get("slug") ?? "").trim();
  const photoIds = form.getAll("photo_id").map(String).filter(Boolean);
  if (!photoIds.length) return { items: [], error: "Select at least one photograph first." };
  try {
    const gallery = await requireGalleryAccess(slug);
    const items: DownloadResult[] = [];
    for (const photoId of photoIds) {
      const info = await photoDownloadInfo(gallery.id, photoId);
      if (!info) {
        items.push({ url: null, filename: null, error: "That photograph is unavailable." });
        continue;
      }
      const resolved = await signedDownloadUrl(info.filename, info.photo);
      items.push(resolved ? { url: resolved.url, filename: resolved.name, error: null } : { url: null, filename: info.filename, error: "Download is unavailable right now." });
    }
    return { items, error: null };
  } catch {
    return { items: [], error: "The download could not be started. Try again." };
  }
}

export async function shareGalleryPhoto(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const photoId = String(form.get("photo_id") ?? "").trim();
  try {
    const gallery = await requireGalleryAccess(slug);
    const { data: photo } = await galleryDb().from("photos").select("id").eq("id", photoId).eq("gallery_id", gallery.id).maybeSingle();
    if (!photo) return { url: null, error: "That photograph is unavailable." };
    const token = await ensurePhotoShareToken(gallery.id, photo.id);
    if (!token) return { url: null, error: "A share link could not be created." };
    return { url: `${sharedPhotoOrigin()}/p/${token}`, error: null };
  } catch {
    return { url: null, error: "A share link could not be created." };
  }
}

export async function downloadSharedPhoto(form: FormData): Promise<DownloadResult> {
  const token = String(form.get("token") ?? "").trim();
  const shared = await photoFromShareToken(token);
  if (!shared) return { url: null, filename: null, error: "That photograph is unavailable." };
  const info = await photoDownloadInfo(shared.galleryId, shared.photo.id);
  if (!info) return { url: null, filename: null, error: "That photograph is unavailable." };
  const resolved = await signedDownloadUrl(info.filename, info.photo);
  return resolved ? { url: resolved.url, filename: resolved.name, error: null } : { url: null, filename: info.filename, error: "Download is unavailable right now." };
}

export async function clearPhotoSelection(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const folder = String(form.get("folder") ?? "").trim();
  try {
    const gallery = await requireGalleryAccess(slug);
    const db = galleryDb();
    const viewerHash = await ensureViewerKeyHash();
    const { data: submitted } = await db.from("selection_submissions").select("id").eq("gallery_id", gallery.id).eq("selection_session_hash", viewerHash).maybeSingle();
    if (submitted) return { ok: false as const, error: "The selection has already been sent and cannot be changed." };
    await db.from("selections").delete().eq("gallery_id", gallery.id).eq("viewer_key_hash", viewerHash);
    revalidatePath(`/gallery/${gallery.slug}`);
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) revalidatePath(`/gallery/${gallery.slug}/${folder}`);
    return { ok: true as const, error: null };
  } catch {
    return { ok: false as const, error: "The selection could not be cleared. Try again." };
  }
}

export async function submitPhotoSelection(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const folder = String(form.get("folder") ?? "").trim();
  try {
    const gallery = await requireGalleryAccess(slug);
    const db = galleryDb();
    const viewerHash = await ensureViewerKeyHash();
    const { data: existing } = await db.from("selection_submissions").select("id,photo_count").eq("gallery_id", gallery.id).eq("selection_session_hash", viewerHash).maybeSingle();
    if (existing) return { ok: false as const, error: "This selection has already been sent.", count: existing.photo_count, submitted: true };
    const { count } = await db.from("selections").select("id", { count: "exact", head: true }).eq("gallery_id", gallery.id).eq("viewer_key_hash", viewerHash);
    if (!count) return { ok: false as const, error: "Select at least one photograph first.", count: 0, submitted: false };
    const { error } = await db.from("selection_submissions").insert({ gallery_id: gallery.id, selection_session_hash: viewerHash, photo_count: count, status: "submitted" });
    if (error) return { ok: false as const, error: "The selection could not be sent. Try again.", count, submitted: false };
    revalidatePath(`/gallery/${gallery.slug}`);
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) revalidatePath(`/gallery/${gallery.slug}/${folder}`);
    revalidatePath(`/admin/galleries/${gallery.id}`);
    return { ok: true as const, error: null, count, submitted: true };
  } catch {
    return { ok: false as const, error: "The selection could not be sent. Try again.", count: 0, submitted: false };
  }
}
