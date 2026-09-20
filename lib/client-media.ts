import "server-only";

type PhotoPaths = { thumbnail_path: string | null; preview_path: string | null; original_path: string };

/** Prefer future derivatives; fall back to the original upload until those exist. */
export function clientFacingObjectPath(photo: PhotoPaths, kind: "grid" | "full") {
  if (kind === "grid") return photo.thumbnail_path || photo.preview_path || photo.original_path;
  return photo.preview_path || photo.original_path;
}

export const CLIENT_SIGNED_URL_SECONDS = 60 * 15;
export const DOWNLOAD_SIGNED_URL_SECONDS = 60;

export function safeDownloadName(filename: string, fallback = "photograph.jpg") {
  const base = filename.replaceAll("\\", "/").split("/").pop() || fallback;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(0, 180);
  return cleaned.includes(".") ? cleaned : fallback;
}

/** Turn a name into a filesystem-safe segment: "Aryan & Priya" → "Aryan-Priya". */
export function sanitizeFilenameSegment(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function originalExtension(photo: { original_path: string; filename: string }): string {
  const tail = (photo.original_path || photo.filename || "")
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.split("?")[0] ?? "";
  const match = tail.match(/\.([A-Za-z0-9]{2,8})$/);
  return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

/**
 * The visible download name: GALLERY-SET-NNN.ext, e.g. "Aryan-Wedding-Wedding-001.jpg".
 * The number is the photo's 1-based position inside its own Set.
 */
export function downloadFilename(input: { galleryTitle: string; folderName: string; index: number; photo: { original_path: string; filename: string } }) {
  const segments = [sanitizeFilenameSegment(input.galleryTitle), sanitizeFilenameSegment(input.folderName)].filter(Boolean);
  const base = segments.length ? segments.join("-") : "photograph";
  const ordinal = String(Math.max(1, Math.floor(input.index))).padStart(3, "0");
  return `${base}-${ordinal}${originalExtension(input.photo)}`;
}
