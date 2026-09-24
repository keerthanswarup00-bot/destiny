import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { adminDb } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { photoStore } from "@/lib/storage-provider";
import { createStoredZip } from "@/lib/stored-zip";
import { downloadFilename } from "@/lib/client-media";

function safeSegment(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\\s+/g, " ").replace(/\\.+$/g, "");
  return cleaned || fallback;
}

function signatureFor(photos: Array<{ id: string; download_path: string | null; preview_path: string | null; thumbnail_path: string | null; sort_order: number | null }>) {
  const payload = photos
    .map(photo => [photo.id, photo.download_path ?? "", photo.preview_path ?? "", photo.thumbnail_path ?? "", photo.sort_order ?? 0].join("|"))
    .join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ galleryId: string; folderId: string }> },
) {
  try {
    await requireAdmin();
    const { galleryId, folderId } = await params;
    const db = await adminDb();

    const [{ data: gallery }, { data: folder }, { data: photos }] = await Promise.all([
      db.from("galleries").select("id,title").eq("id", galleryId).maybeSingle(),
      db.from("folders").select("id,name,slug,download_zip_path,download_zip_signature").eq("id", folderId).eq("gallery_id", galleryId).maybeSingle(),
      db.from("photos").select("id,filename,folder_id,original_path,sort_order,download_path,preview_path,thumbnail_path").eq("gallery_id", galleryId).eq("folder_id", folderId).order("sort_order").order("id"),
    ]);

    if (!gallery || !folder) return NextResponse.json({ error: "Set not found." }, { status: 404 });

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
      return NextResponse.json({ status: "empty" });
    }

    if (folder.download_zip_path && folder.download_zip_signature === signature && await photoStore().objectExists(folder.download_zip_path)) {
      return NextResponse.json({ status: "ready", path: folder.download_zip_path });
    }

    const entries: { name: string; data: Buffer }[] = [];
    let skipped = 0;

    for (const photo of ordered) {
      const path = photo.download_path || photo.preview_path || photo.thumbnail_path;
      if (!path) {
        skipped += 1;
        continue;
      }

      const data = await photoStore().downloadBytes(path);
      if (!data) {
        skipped += 1;
        continue;
      }

      let jpeg: Buffer;
      try {
        jpeg = await sharp(data).jpeg({ quality: 92 }).toBuffer();
      } catch {
        skipped += 1;
        continue;
      }

      const filename = downloadFilename({
        galleryTitle: gallery.title,
        folderName: folder.name,
        index: ordered.findIndex(item => item.id === photo.id) + 1,
        photo,
      }).replace(/\\.[a-z0-9]+$/i, ".jpg");

      entries.push({ name: filename, data: jpeg });
    }

    if (!entries.length) return NextResponse.json({ error: "This set has no downloadable photos." }, { status: 404 });

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

    if (error) return NextResponse.json({ error: "ZIP was created but could not be registered." }, { status: 500 });

    return NextResponse.json({ status: "ready", path: zipPath, skipped });
  } catch {
    return NextResponse.json({ error: "Could not prepare the set download." }, { status: 500 });
  }
}
