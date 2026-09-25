export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type PhotoMimeType = (typeof ALLOWED_PHOTO_TYPES)[number];

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTO_FILENAME_LENGTH = 500;
export const MAX_PHOTO_DIMENSION = 50_000;
export const MAX_PHOTO_PIXELS = 100_000_000;

const extensionsByMime: Record<PhotoMimeType, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
};

const mimeByExtension: Record<string, PhotoMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const PHOTO_FORMAT_MESSAGE = "Upload failed: use JPEG, PNG, WebP, or GIF images up to 15 MB each.";
export const PHOTO_SIZE_MESSAGE = "Upload failed: each image must be no larger than 15 MB.";
export const PHOTO_FILENAME_MESSAGE = "Upload failed: use a valid file name no longer than 500 characters without folders or control characters.";

export type PhotoMetadataInput = {
  filename: string;
  mimeType: string;
  bytes: number;
};

export type PhotoMetadataResult =
  | {
      ok: true;
      filename: string;
      mimeType: PhotoMimeType;
      bytes: number;
      extension: string;
    }
  | {
      ok: false;
      message: string;
    };

function invalidMetadata(): PhotoMetadataResult {
  return { ok: false, message: PHOTO_FORMAT_MESSAGE };
}

export function photoExtensionForMime(mimeType: string): string | null {
  const normalized = mimeType.trim().toLowerCase();
  return extensionsByMime[normalized as PhotoMimeType]?.[0] ?? null;
}

export function validatePhotoMetadata(input: { filename: unknown; mimeType: unknown; bytes: unknown }): PhotoMetadataResult {
  if (typeof input.filename !== "string" || typeof input.mimeType !== "string" || typeof input.bytes !== "number") {
    return invalidMetadata();
  }
  const filename = input.filename;
  const mimeType = input.mimeType.trim().toLowerCase();
  const bytes = input.bytes;
  if (!filename.trim() || Array.from(filename).length > MAX_PHOTO_FILENAME_LENGTH) {
    return { ok: false, message: PHOTO_FILENAME_MESSAGE };
  }
  if (/[\u0000-\u001f\u007f-\u009f/\\]/u.test(filename)) {
    return { ok: false, message: PHOTO_FILENAME_MESSAGE };
  }
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    return invalidMetadata();
  }
  if (bytes > MAX_PHOTO_BYTES) {
    return { ok: false, message: PHOTO_SIZE_MESSAGE };
  }
  const extension = filename.match(/\.([a-z0-9]{1,8})$/i)?.[1].toLowerCase();
  if (!extension || !mimeByExtension[extension] || !photoExtensionForMime(mimeType)) {
    return invalidMetadata();
  }
  if (mimeByExtension[extension] !== mimeType) {
    return { ok: false, message: "Upload failed: the file extension does not match its type." };
  }
  return { ok: true, filename, mimeType: mimeType as PhotoMimeType, bytes, extension };
}
