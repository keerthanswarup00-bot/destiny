import "server-only";
import { DOWNLOAD_SIGNED_URL_SECONDS, safeDownloadName } from "@/lib/client-media";
import { hashViewerToken, photoShareToken } from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";
import { photoStore } from "@/lib/storage-provider";

type DownloadablePaths = { thumbnail_path: string | null; preview_path: string | null; original_path: string; download_path?: string | null };

/** Extension of the object actually being downloaded (e.g. ".jpg", ".webp"). */
function assetExtension(path: string): string {
  const segment = path.split("/").pop() ?? "";
  const match = segment.match(/\.([a-z0-9]{2,8})$/i);
  return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

/**
 * Rebase the visible download name onto the actual download asset so the saved
 * file's extension always matches the served bytes (JPEG for new download.jpg
 * rows, WebP for legacy rows still pointing at download.webp/preview/thumbnail).
 */
export function derivativeDownloadName(filename: string, path: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, "") + assetExtension(path);
}

export async function signedDownloadUrl(filename: string, paths: DownloadablePaths): Promise<{ url: string; name: string } | null> {
  // Client-facing downloads always serve the watermarked full-resolution
  // derivative (falling back to the watermarked preview/thumbnail for legacy
  // rows). The private original is never eligible for a client download.
  const path = paths.download_path || paths.preview_path || paths.thumbnail_path;
  if (!path) return null;
  const name = safeDownloadName(derivativeDownloadName(filename, path), "photograph.jpg");
  const url = await photoStore().signedDownloadUrl(path, name, DOWNLOAD_SIGNED_URL_SECONDS);
  return url ? { url, name } : null;
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
    db.from("photos").select("id,folder_id,filename,width,height,thumbnail_path,preview_path,download_path,original_path").eq("id", share.photo_id).eq("gallery_id", share.gallery_id).maybeSingle(),
    db.from("galleries").select("id,title,slug,status").eq("id", share.gallery_id).maybeSingle(),
  ]);
  if (!photo || !gallery) return null;
  return { photo, galleryId: gallery.id, galleryTitle: gallery.title, gallerySlug: gallery.slug, galleryPublished: gallery.status === "published" };
}
