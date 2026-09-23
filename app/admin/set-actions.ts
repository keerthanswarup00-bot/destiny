"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { adminDb } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

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
  const crop = cover ? folderCoverCrop(form) : null;
  await supabase
    .from("folders")
    .update({ cover_photo_id: cover?.id ?? null, cover_crop: crop })
    .eq("id", id)
    .eq("gallery_id", folder.gallery_id);
  revalidatePath(`/admin/galleries/${folder.gallery_id}`);
  revalidatePath(`/gallery/${(await signedGallerySlug(folder.gallery_id)) ?? ""}`);
  await invalidateTags("site-stories", "site-portfolio");
}

/**
 * Read the normalized { x, y, zoom } crop from a Set cover form. Absent or
 * malformed values yield null (centered, no-crop cover fit) so the quick
 * highlight actions that only pick a source photo keep working unchanged.
 */
function folderCoverCrop(form: FormData) {
  const x = form.get("x");
  const y = form.get("y");
  const zoom = form.get("zoom");
  if (x === null || y === null || zoom === null) return null;
  const nx = Number(String(x));
  const ny = Number(String(y));
  const nz = Number(String(zoom));
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return null;
  return {
    x: Math.min(1, Math.max(0, nx)),
    y: Math.min(1, Math.max(0, ny)),
    zoom: Math.min(8, Math.max(1, nz)),
  };
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
