import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { galleryDb } from "@/lib/gallery-db";
import { photoStore } from "@/lib/storage-provider";
import { downloadFilename } from "@/lib/client-media";

const activePreparations = new Set<string>();

function u16(value: number) {
  const out = Buffer.allocUnsafe(2);
  out.writeUInt16LE(value, 0);
  return out;
}

function u32(value: number) {
  const out = Buffer.allocUnsafe(4);
  out.writeUInt32LE(value >>> 0, 0);
  return out;
}

function crc32(input: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function signatureFor(photos: Array<{
  id: string;
  download_path: string | null;
  preview_path: string | null;
  thumbnail_path: string | null;
  sort_order: number | null;
}>) {
  const payload = photos
    .map(photo => [
      photo.id,
      photo.download_path ?? "",
      photo.preview_path ?? "",
      photo.thumbnail_path ?? "",
      photo.sort_order ?? 0,
    ].join("|"))
    .join("\n");

  return createHash("sha256").update(payload).digest("hex");
}

function localHeader(name: Buffer, crc: number, size: number) {
  return Buffer.concat([
    Buffer.from("PK\x03\x04", "binary"),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(size),
    u32(size),
    u16(name.length),
    u16(0),
    name,
  ]);
}

function centralHeader(
  name: Buffer,
  crc: number,
  size: number,
  offset: number,
) {
  return Buffer.concat([
    Buffer.from("PK\x01\x02", "binary"),
    u16(20),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(size),
    u32(size),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(offset),
    name,
  ]);
}

function endOfCentralDirectory(count: number, size: number, offset: number) {
  return Buffer.concat([
    Buffer.from("PK\x05\x06", "binary"),
    u16(0),
    u16(0),
    u16(count),
    u16(count),
    u32(size),
    u32(offset),
    u16(0),
  ]);
}

type ZipEntryMeta = {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
};

function zipParts(
  photos: Array<{
    filename: string;
    original_path: string;
    download_path: string | null;
    preview_path: string | null;
    thumbnail_path: string | null;
  }>,
  galleryTitle: string,
  folderName: string,
) {
  return (async function* () {
    const entries: ZipEntryMeta[] = [];
    let offset = 0;

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const path = photo.download_path || photo.original_path || photo.preview_path || photo.thumbnail_path;
      if (!path) continue;

      const data = await photoStore().downloadBytes(path);
      if (!data) throw new Error(`Could not read photo ${photo.filename || photo.original_path}`);

      let jpeg: Buffer;
      try {
        jpeg = /\.(jpe?g)$/i.test(path)
          ? data
          : await sharp(data).jpeg({ quality: 92 }).toBuffer();
      } catch (error) {
        throw new Error(`Could not process photo ${photo.filename || photo.original_path}: ${error instanceof Error ? error.message : String(error)}`);
      }

      const filename = downloadFilename({
        galleryTitle,
        folderName,
        index: index + 1,
        photo,
      }).replace(/\.[a-z0-9]+$/i, ".jpg");
      const name = Buffer.from(filename, "utf8");
      const crc = crc32(jpeg);
      const header = localHeader(name, crc, jpeg.length);

      entries.push({
        name,
        crc,
        size: jpeg.length,
        offset,
      });

      yield header;
      yield jpeg;
      offset += header.length + jpeg.length;
    }

    if (!entries.length) throw new Error("This set has no downloadable photos.");

    const centralStart = offset;
    for (const entry of entries) {
      const header = centralHeader(entry.name, entry.crc, entry.size, entry.offset);
      yield header;
      offset += header.length;
    }

    yield endOfCentralDirectory(entries.length, offset - centralStart, centralStart);
  })();
}

export type SetDownloadPreparation = {
  status: "ready" | "empty";
  path?: string;
};

export async function prepareSetDownload(
  galleryId: string,
  folderId: string,
): Promise<SetDownloadPreparation> {
  const lockKey = `${galleryId}:${folderId}`;
  if (activePreparations.has(lockKey)) return { status: "preparing" };
  activePreparations.add(lockKey);

  try {
    return await prepareSetDownloadUnlocked(galleryId, folderId);
  } finally {
    activePreparations.delete(lockKey);
  }
}

async function prepareSetDownloadUnlocked(
  galleryId: string,
  folderId: string,
): Promise<SetDownloadPreparation> {
  const db = galleryDb();

  const [{ data: gallery, error: galleryError }, { data: folder, error: folderError }, { data: photos, error: photoError }] = await Promise.all([
    db.from("galleries").select("id,title").eq("id", galleryId).maybeSingle(),
    db.from("folders").select("id,name,slug,download_zip_path,download_zip_signature").eq("id", folderId).eq("gallery_id", galleryId).maybeSingle(),
    db.from("photos").select("id,filename,folder_id,original_path,sort_order,download_path,preview_path,thumbnail_path").eq("gallery_id", galleryId).eq("folder_id", folderId).order("sort_order").order("id"),
  ]);

  if (galleryError) throw new Error(`Gallery lookup failed: ${galleryError.message}`);
  if (folderError) throw new Error(`Set lookup failed: ${folderError.message}`);
  if (photoError) throw new Error(`Photo lookup failed: ${photoError.message}`);
  if (!gallery || !folder) throw new Error("Set not found.");

  const ordered = photos ?? [];
  const signature = signatureFor(ordered);

  if (!ordered.length) {
    if (folder.download_zip_path) {
      try { await photoStore().removePhotos([folder.download_zip_path]); } catch {}
    }
    await db.from("folders").update({
      download_zip_path: null,
      download_zip_signature: null,
      download_zip_generated_at: null,
    }).eq("id", folderId).eq("gallery_id", galleryId);
    return { status: "empty" };
  }

  if (
    folder.download_zip_path &&
    folder.download_zip_signature === signature &&
    await photoStore().objectExists(folder.download_zip_path)
  ) {
    return { status: "ready", path: folder.download_zip_path };
  }

  const zipPath = `gallery-downloads/${galleryId}/${folderId}/${signature}.zip`;
  const store = photoStore();

  if (!store.uploadStream) {
    throw new Error("Streaming R2 upload is not available for the active storage provider.");
  }

  await store.uploadStream({
    key: zipPath,
    contentType: "application/zip",
    parts: zipParts(
      ordered.map(photo => ({
        filename: photo.filename,
        original_path: photo.original_path,
        download_path: photo.download_path,
        preview_path: photo.preview_path,
        thumbnail_path: photo.thumbnail_path,
      })),
      gallery.title,
      folder.name,
    ),
  });

  if (folder.download_zip_path && folder.download_zip_path !== zipPath) {
    try { await store.removePhotos([folder.download_zip_path]); } catch {}
  }

  const { error: updateError } = await db.from("folders").update({
    download_zip_path: zipPath,
    download_zip_signature: signature,
    download_zip_generated_at: new Date().toISOString(),
  }).eq("id", folderId).eq("gallery_id", galleryId);

  if (updateError) throw new Error(`ZIP uploaded but could not be registered: ${updateError.message}`);

  return { status: "ready", path: zipPath };
}
