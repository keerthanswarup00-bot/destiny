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
