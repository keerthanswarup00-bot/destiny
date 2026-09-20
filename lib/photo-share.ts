import "server-only";
import { DOWNLOAD_SIGNED_URL_SECONDS, clientFacingObjectPath, safeDownloadName } from "@/lib/client-media";
import { GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";
import { hashViewerToken, photoShareToken } from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";

export async function signedDownloadUrl(filename: string, paths: { thumbnail_path: string | null; preview_path: string | null; original_path: string }) {
  const path = clientFacingObjectPath(paths, "full");
  const { data, error } = await galleryDb().storage.from(GALLERY_ASSET_BUCKET).createSignedUrl(path, DOWNLOAD_SIGNED_URL_SECONDS, { download: safeDownloadName(filename) });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function ensurePhotoShareToken(galleryId: string, photoId: string) {
  const token = photoShareToken(photoId);
  const tokenHash = hashViewerToken(token);
  const db = galleryDb();
  const { data: existing } = await db.from("photo_shares").select("id,revoked_at,expires_at,photo_id,gallery_id").eq("token_hash", tokenHash).maybeSingle();
  if (existing) {
    if (existing.revoked_at || existing.photo_id !== photoId || existing.gallery_id !== galleryId) return null;
    if (existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) return null;
    return token;
  }
  const { error } = await db.from("photo_shares").insert({ gallery_id: galleryId, photo_id: photoId, token_hash: tokenHash, created_by: null });
  if (error) return null;
  return token;
}

export async function photoFromShareToken(token: string) {
  if (token.length < 32) return null;
  const tokenHash = hashViewerToken(token);
  const db = galleryDb();
  const { data: share } = await db.from("photo_shares").select("photo_id,gallery_id,revoked_at,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!share || share.revoked_at) return null;
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return null;
  const [{ data: photo }, { data: gallery }] = await Promise.all([
    db.from("photos").select("id,folder_id,filename,width,height,thumbnail_path,preview_path,original_path").eq("id", share.photo_id).eq("gallery_id", share.gallery_id).maybeSingle(),
    db.from("galleries").select("id,title,slug,status").eq("id", share.gallery_id).maybeSingle(),
  ]);
  if (!photo || !gallery) return null;
  return { photo, galleryId: gallery.id, galleryTitle: gallery.title, gallerySlug: gallery.slug, galleryPublished: gallery.status === "published" };
}
