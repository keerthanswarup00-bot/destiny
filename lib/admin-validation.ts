import { z } from "zod";
export { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/photo-validation";
export const clientSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(200), event_date: z.string().trim().max(50), phone: z.string().trim().max(50), notes: z.string().trim().max(5000) });
export const gallerySchema = z.object({ title: z.string().trim().min(1).max(200), client_id: z.string().uuid(), description: z.string().trim().max(5000), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"), status: z.enum(["draft", "published", "archived"]) });
export const folderSchema = z.object({ name: z.string().trim().min(1).max(200) });
export const photoUploadSchema = z.object({ gallery_id: z.string().uuid(), folder_id: z.string().uuid() });
export const GALLERY_ASSET_BUCKET = "client-gallery-assets";
export const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const errorMessages: Record<string, string> = {
  "invalid-client": "Name is required.",
  "client-create": "Could not create that client. Try again.",
  "client-has-galleries": "This client still has galleries, so it cannot be deleted.",
  "invalid-gallery": "Title is required. Slug must use lowercase letters, numbers, and hyphens.",
  "gallery-create": "Could not create that gallery. The slug may already be in use.",
  "gallery-storage-delete": "The gallery could not be deleted because one or more photo files could not be removed.",
  "gallery-delete": "Could not delete that gallery. Try again.",
  "invalid-folder": "Folder name is required and must include a letter or number.",
  "invalid-photo": "Choose a folder and JPEG, PNG, WebP, or GIF files up to 15MB.",
  "photo-upload": "Could not store that photo. Try again.",
  "photo-storage-delete": "That photo could not be deleted because its files could not be removed from storage.",
  "photo-delete": "Could not delete that photo. Try again.",
  "photos-storage-delete": "Those photos could not be deleted because one or more files could not be removed from storage.",
  "photos-delete": "Could not delete those photos. Try again.",
  "folder-storage-delete": "That set could not be deleted because one or more photo files could not be removed from storage.",
  "folder-delete": "Could not delete that set. Try again.",
};
export function adminError(code?: string | string[]) {
  const value = Array.isArray(code) ? code[0] : code;
  return value ? errorMessages[value] ?? null : null;
}
