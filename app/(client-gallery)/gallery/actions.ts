"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashIp } from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";
import { ensureViewerKeyHash, grantGalleryAccess, requireGalleryAccess } from "@/lib/gallery-access";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { ensurePhotoShareToken, photoFromShareToken, signedDownloadUrl } from "@/lib/photo-share";

export type PasswordState = { error: string | null };

const GENERIC_FAILURE = "Unable to open this gallery.";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

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

export async function togglePhotoSelection(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const photoId = String(form.get("photo_id") ?? "").trim();
  const folder = String(form.get("folder") ?? "").trim();
  const gallery = await requireGalleryAccess(slug);
  const db = galleryDb();
  const viewerHash = await ensureViewerKeyHash();
  const { data: submitted } = await db.from("selection_submissions").select("id").eq("gallery_id", gallery.id).eq("selection_session_hash", viewerHash).maybeSingle();
  const { count } = await db.from("selections").select("id", { count: "exact", head: true }).eq("gallery_id", gallery.id).eq("viewer_key_hash", viewerHash);
  if (submitted) return { ok: false as const, error: "This selection has already been sent.", selected: false, count: count ?? 0, submitted: true };
  const { data: photo } = await db.from("photos").select("id").eq("id", photoId).eq("gallery_id", gallery.id).maybeSingle();
  if (!photo) return { ok: false as const, error: "That photograph is unavailable.", selected: false, count: count ?? 0, submitted: false };
  const { data: existing } = await db.from("selections").select("id").eq("gallery_id", gallery.id).eq("photo_id", photo.id).eq("viewer_key_hash", viewerHash).maybeSingle();
  if (existing) {
    await db.from("selections").delete().eq("id", existing.id).eq("gallery_id", gallery.id).eq("viewer_key_hash", viewerHash);
  } else {
    await db.from("selections").insert({ gallery_id: gallery.id, photo_id: photo.id, viewer_name: "Guest", viewer_key_hash: viewerHash });
  }
  revalidatePath(`/gallery/${gallery.slug}`);
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) revalidatePath(`/gallery/${gallery.slug}/${folder}`);
  const { count: nextCount } = await db.from("selections").select("id", { count: "exact", head: true }).eq("gallery_id", gallery.id).eq("viewer_key_hash", viewerHash);
  return { ok: true as const, error: null, selected: !existing, count: nextCount ?? 0, submitted: false };
}

export async function downloadGalleryPhoto(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const photoId = String(form.get("photo_id") ?? "").trim();
  try {
    const gallery = await requireGalleryAccess(slug);
    const { data: photo } = await galleryDb().from("photos").select("filename,thumbnail_path,preview_path,original_path").eq("id", photoId).eq("gallery_id", gallery.id).maybeSingle();
    if (!photo) return { url: null, error: "That photograph is unavailable." };
    const url = await signedDownloadUrl(photo.filename, photo);
    return url ? { url, error: null } : { url: null, error: "Download is unavailable right now." };
  } catch {
    return { url: null, error: "Download is unavailable right now." };
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
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000";
    const proto = headerList.get("x-forwarded-proto") || "http";
    return { url: `${proto}://${host}/p/${token}`, error: null };
  } catch {
    return { url: null, error: "A share link could not be created." };
  }
}

export async function downloadSharedPhoto(form: FormData) {
  const token = String(form.get("token") ?? "").trim();
  const shared = await photoFromShareToken(token);
  if (!shared) return { url: null, error: "That photograph is unavailable." };
  const url = await signedDownloadUrl(shared.photo.filename, shared.photo);
  return url ? { url, error: null } : { url: null, error: "Download is unavailable right now." };
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
