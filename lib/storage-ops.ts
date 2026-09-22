import "server-only";
import { photoStore } from "@/lib/storage-provider";

/**
 * Photo storage keys are strictly server-controlled and deterministic:
 * `<gallery>/<folder>/<photo>/<name>.ext` where every segment is a uuid. Watermark
 * logos, branding assets and Website Gallery images live elsewhere and must
 * NEVER match this shape so an over-broad cleanup can not delete them.
 */
const PHOTO_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/i;

export function isClientPhotoStorageKey(key: string): boolean {
  return key.length > 36 && PHOTO_KEY_RE.test(key);
}

export function photoStoragePaths(photo: {
  original_path?: string | null;
  thumbnail_path?: string | null;
  preview_path?: string | null;
  download_path?: string | null;
}): string[] {
  return [photo.original_path, photo.preview_path, photo.thumbnail_path, photo.download_path].filter((path): path is string => Boolean(path));
}

/**
 * Read-only audit: list every object in the active provider bucket and return
 * the photo-shaped keys that no gallery photo references. Nothing is deleted.
 * The caller is responsible for admin authentication.
 */
export async function auditStorageOrphans(referenced: ReadonlySet<string>): Promise<string[]> {
  const listed = await photoStore().listKeys();
  return [...new Set(listed)].filter(key => isClientPhotoStorageKey(key) && !referenced.has(key));
}

/**
 * Deliberate, explicit cleanup: remove ONLY the passed keys that (a) are
 * photo-shaped and (b) are not currently referenced by any gallery photo.
 * Returns the keys actually removed. No bucket-wide "delete what is not in
 * the database" logic.
 */
export async function cleanupOrphanedPhotoKeys(keys: string[], referenced: ReadonlySet<string>): Promise<string[]> {
  const safe = [...new Set(keys)].filter(key => isClientPhotoStorageKey(key) && !referenced.has(key));
  if (safe.length) await photoStore().removePhotos(safe);
  return safe;
}