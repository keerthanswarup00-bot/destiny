import "server-only";
import sharp from "sharp";
import {
  MAX_PHOTO_DIMENSION,
  MAX_PHOTO_PIXELS,
  validatePhotoMetadata,
  type PhotoMimeType,
} from "@/lib/photo-validation";

const mimeByFormat: Record<string, PhotoMimeType> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export type PhotoContentResult =
  | {
      ok: true;
      width: number;
      height: number;
      mimeType: PhotoMimeType;
      bytes: number;
    }
  | {
      ok: false;
      message: string;
    };

export async function validatePhotoContent(
  body: Buffer,
  input: { filename: unknown; mimeType: unknown; bytes: unknown },
): Promise<PhotoContentResult> {
  const metadata = validatePhotoMetadata(input);
  if (!metadata.ok) return metadata;
  if (body.byteLength !== metadata.bytes) {
    return { ok: false, message: "Upload failed: the uploaded file size did not match." };
  }
  let details: sharp.Metadata;
  try {
    details = await sharp(body, { failOn: "error", limitInputPixels: MAX_PHOTO_PIXELS }).metadata();
  } catch {
    return { ok: false, message: "Upload failed: the file is not a valid supported image." };
  }
  const mimeType = details.format ? mimeByFormat[details.format] : undefined;
  if (!mimeType || mimeType !== metadata.mimeType) {
    return { ok: false, message: "Upload failed: the file contents do not match its type." };
  }
  const width = details.width;
  const height = details.height;
  if (!width || !height || !Number.isInteger(width) || !Number.isInteger(height) || width > MAX_PHOTO_DIMENSION || height > MAX_PHOTO_DIMENSION || width * height > MAX_PHOTO_PIXELS) {
    return { ok: false, message: "Upload failed: the image dimensions are too large." };
  }
  return { ok: true, width, height, mimeType, bytes: body.byteLength };
}
