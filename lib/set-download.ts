import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { galleryDb } from "@/lib/gallery-db";
import { photoStore } from "@/lib/storage-provider";
import { createStoredZip } from "@/lib/stored-zip";
import { downloadFilename } from "@/lib/client-media";

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

export type SetDownloadPreparation = {
  status: "ready" | "empty" | "preparing";
  path?: string;
  skipped?: number;
};

export async function prepareSetDownload(
  galleryId: string,
  folderId: string,
): Promise<SetDownloadPreparation> {
  const db = galleryDb();

  const [{ data: gallery }, { data: folder }, { data: photos }] = await Promise.all([
    db.from("galleries").select("id,title").eq("id", galleryId).maybeSingle(),
    db.from("folders").select("id,name,slug,download_zip_path,download_zip_signature").eq("id", folderId).eq("gallery_id", galleryId).maybeSingle(),
    db.from("photos").select("id,filename,folder_id,original_path,sort_order,download_path,preview_path,thumbnail_path").eq("gallery_id", galleryId).eq("folder_id", folderId).order("sort_order").order("id"),
  ]);

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

  const results: Array<{ name: string; data: Buffer } | null> = new Array(ordered.length).fill(null);
  let nextIndex = 0;
  let skipped = 0;
  const concurrency = 8;

  const workers = Array.from({ length: Math.min(concurrency, ordered.length) }, async () => {
    while (nextIndex < ordered.length) {
      const index = nextIndex++;
      const photo = ordered[index];
      const path = photo.download_path || photo.original_path || photo.preview_path || photo.thumbnail_path;
      if (!path) {
        skipped += 1;
        continue;
      }

      const data = await photoStore().downloadBytes(path);
      if (!data) {
        skipped += 1;
        continue;
      }

      try {
        const jpeg = /\.(jpe?g)$/i.test(path)
          ? data
          : await sharp(data).jpeg({ quality: 92 }).toBuffer();

        const filename = downloadFilename({
          galleryTitle: gallery.title,
          folderName: folder.name,
          index: index + 1,
          photo,
        }).replace(/\.[a-z0-9]+$/i, ".jpg");

        results[index] = { name: filename, data: jpeg };
      } catch {
        skipped += 1;
      }
    }
  });

  await Promise.all(workers);

  const entries = results.filter((entry): entry is { name: string; data: Buffer } => Boolean(entry));
  if (!entries.length) throw new Error("This set has no downloadable photos.");

  const zip = createStoredZip(entries);
  const zipPath = `gallery-downloads/${galleryId}/${folderId}/${signature}.zip`;

  await photoStore().uploadPhoto({
    key: zipPath,
    body: zip,
    contentType: "application/zip",
    upsert: true,
  });

  if (folder.download_zip_path && folder.download_zip_path !== zipPath) {
    try { await photoStore().removePhotos([folder.download_zip_path]); } catch {}
  }

  const { error } = await db.from("folders").update({
    download_zip_path: zipPath,
    download_zip_signature: signature,
    download_zip_generated_at: new Date().toISOString(),
  }).eq("id", folderId).eq("gallery_id", galleryId);

  if (error) throw new Error(`ZIP created but could not be registered: ${error.message}`);

  return { status: "ready", path: zipPath, skipped };
}
