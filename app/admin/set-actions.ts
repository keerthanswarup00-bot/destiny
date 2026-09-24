"use server";
import { redirect, revalidatePath, revalidateTag } from "next/cache";
import { adminDb } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { HIGHLIGHT_MAX_ZOOM, normalizeHighlightCrop } from "@/lib/site/website-gallery";
import { encryptDownloadPin, hashGalleryPassword } from "@/lib/gallery-password";

function v(form: FormData, key: string) { return String(form.get(key) ?? ""); }

/** Invalidate cached public site-content reads (tags mirror SITE_CACHE_TAGS in lib/site/site-content.ts). */
async function invalidateTags(...tags: string[]) {
  await Promise.all(tags.map(tag => revalidateTag(tag)));
}

export async function setFolderPublished(form: FormData) {
  await requireAdmin();
  const id = v(form, "id");
  const published = v(form, "published") === "true";
  const supabase = await adminDb();
  const { data: folder } = await supabase.from("folders").select("id,gallery_id").eq("id", id).maybeSingle();
  if (!folder) return;
  await supabase.from("folders").update({ published }).eq("id", folder.id).eq("gallery_id", folder.gallery_id);
  revalidatePath(`/admin/galleries/${folder.gallery_id}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(folder.gallery_id)) ?? ""}`);
  await invalidateTags("site-stories", "site-portfolio");
}

export async function setFolderCover(form: FormData) {
  await requireAdmin();
  const id = v(form, "id");
  const coverPhotoId = v(form, "cover_photo_id");
  const supabase = await adminDb();
  const { data: folder } = await supabase.from("folders").select("id,gallery_id").eq("id", id).maybeSingle();
  if (!folder) return;
  const cover = coverPhotoId ? (await supabase.from("photos").select("id").eq("id", coverPhotoId).eq("gallery_id", folder.gallery_id).eq("folder_id", id).maybeSingle()).data : null;
  if (coverPhotoId && !cover) return;
  await supabase.from("folders").update({ cover_photo_id: cover?.id ?? null }).eq("id", id).eq("gallery_id", folder.gallery_id);
  revalidatePath(`/admin/galleries/${folder.gallery_id}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(folder.gallery_id)) ?? ""}`);
  await invalidateTags("site-stories", "site-portfolio");
}

/**
 * Gallery-level highlight used as the ONE client-gallery hero.
 *
 * The chosen photo may come from ANY set of the gallery (published or not) —
 * the gallery-level editor deliberately ignores folder-level covers. Setting it
 * never touches the photo's folder, ordering, cover, download asset, watermark,
 * favourites, or selections; it only changes which photo is the gallery hero.
 */
export async function setGalleryHighlight(form: FormData) {
  await requireAdmin();
  const id = v(form, "id");
  const photoId = v(form, "photo_id");
  const supabase = await adminDb();
  const { data: gallery } = await supabase.from("galleries").select("id").eq("id", id).maybeSingle();
  if (!gallery) return;
  if (photoId) {
    const { data: photo } = await supabase.from("photos").select("id").eq("id", photoId).eq("gallery_id", id).maybeSingle();
    if (!photo) return;
  }
  await supabase.from("galleries").update({ highlight_photo_id: photoId || null, highlight_crop: null }).eq("id", id);
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(id)) ?? ""}`);
  await invalidateTags("site-stories", "site-portfolio");
}

/**
 * Save the normalized 16/9 crop for the current gallery highlight. Mirrors the
 * Website Gallery crop editor: pure {x,y,zoom} metadata in galleries.highlight_crop,
 * replayed by the client hero as a CSS transform — no image is ever rewritten.
 * Only allowed when the gallery already has a highlight photo selected.
 */
export async function saveGalleryHighlightCrop(form: FormData) {
  await requireAdmin();
  const id = v(form, "id");
  const crop = normalizeHighlightCrop({ x: Number(v(form, "x")), y: Number(v(form, "y")), zoom: Number(v(form, "zoom")) });
  if (!id || !crop) return;
  const supabase = await adminDb();
  const { data: gallery } = await supabase.from("galleries").select("highlight_photo_id").eq("id", id).maybeSingle();
  if (!gallery?.highlight_photo_id) return;
  const rounded = {
    x: Math.round(crop.x * 10000) / 10000,
    y: Math.round(crop.y * 10000) / 10000,
    zoom: Math.round(Math.min(HIGHLIGHT_MAX_ZOOM, Math.max(1, crop.zoom)) * 100) / 100,
  };
  const { error } = await supabase.from("galleries").update({ highlight_crop: rounded }).eq("id", id);
  if (error) return;
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(id)) ?? ""}`);
}

export async function moveFolder(form: FormData) {
  await requireAdmin();
  const id = v(form, "id");
  const galleryId = v(form, "gallery_id");
  const direction = v(form, "direction");
  if (direction !== "up" && direction !== "down") return;
  const supabase = await adminDb();
  const { data: folders } = await supabase.from("folders").select("id,sort_order").eq("gallery_id", galleryId).order("sort_order").order("id");
  if (!folders || folders.length < 2) return;
  const index = folders.findIndex(folder => folder.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= folders.length) return;
  const current = folders[index];
  const target = folders[swapIndex];
  await supabase.from("folders").update({ sort_order: target.sort_order }).eq("id", current.id).eq("gallery_id", galleryId);
  await supabase.from("folders").update({ sort_order: current.sort_order }).eq("id", target.id).eq("gallery_id", galleryId);
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(galleryId)) ?? ""}`);
}

export async function setGalleryStatus(form: FormData) {
  await requireAdmin();
  const id = v(form, "id");
  const status = v(form, "status");
  if (status !== "draft" && status !== "published" && status !== "archived") return;
  const supabase = await adminDb();
  await supabase.from("galleries").update({ status }).eq("id", id);
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(id)) ?? ""}`);
  await invalidateTags("site-stories", "site-portfolio");
}

async function signedGallerySlug(galleryId: string) {
  const supabase = await adminDb();
  const { data } = await supabase.from("galleries").select("slug").eq("id", galleryId).maybeSingle();
  return data?.slug ?? "";
}


export async function setFolderDownloadPassword(form: FormData) {
  const id = String(form.get("id") ?? "").trim();
  const galleryId = String(form.get("gallery_id") ?? "").trim();
  const password = String(form.get("download_password") ?? "").trim();
  const clear = String(form.get("clear_download_password") ?? "") === "on";
  if (!id || !galleryId) return;
  await requireAdmin();
  const db = await adminDb();
  const { data: folder } = await db.from("folders").select("id").eq("id", id).eq("gallery_id", galleryId).maybeSingle();
  if (!folder) return;
  if (clear) {
    await db.from("folders").update({ download_password_hash: null, download_password_encrypted: null }).eq("id", id).eq("gallery_id", galleryId);
  } else if (password) {
    if (password.length < 6) {
      redirect(`/admin/galleries/${galleryId}?error=invalid-download-password`);
    }
    const hash = await hashGalleryPassword(password);
    const encrypted = encryptDownloadPin(password);
    await db.from("folders").update({ download_password_hash: hash, download_password_encrypted: encrypted }).eq("id", id).eq("gallery_id", galleryId);
  }
  revalidatePath(`/admin/galleries/${galleryId}`);
}
