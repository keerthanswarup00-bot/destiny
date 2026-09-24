import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { requireGalleryAccess } from "@/lib/gallery-access";
import { galleryDb } from "@/lib/gallery-db";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { photoStore } from "@/lib/storage-provider";
import { DOWNLOAD_SIGNED_URL_SECONDS, downloadFilename } from "@/lib/client-media";
import { createStoredZip } from "@/lib/stored-zip";

function safeSegment(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return cleaned || fallback;
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; folderId: string }> },
) {
  try {
    const { slug, folderId } = await params;
    const gallery = await requireGalleryAccess(slug);
    const form = await request.formData();
    const pin = String(form.get("pin") ?? "").trim();

    if (!pin) {
      return NextResponse.json({ error: "Enter the download PIN." }, { status: 400 });
    }

    const db = galleryDb();
    const [{ data: folder, error: folderError }, { data: photos, error: photoError }] = await Promise.all([
      db
        .from("folders")
        .select("id,name,slug,download_password_hash,download_zip_path,download_zip_signature")
        .eq("id", folderId)
        .eq("gallery_id", gallery.id)
        .maybeSingle(),
      db
        .from("photos")
        .select("id,filename,folder_id,sort_order,download_path,preview_path,thumbnail_path")
        .eq("gallery_id", gallery.id)
        .eq("folder_id", folderId)
        .order("sort_order")
        .order("id"),
    ]);

    if (folderError || photoError) {
      return NextResponse.json({ error: "The set download could not be prepared." }, { status: 500 });
    }

    if (!folder) {
      return NextResponse.json({ error: "This photo set could not be found." }, { status: 404 });
    }

    if (!folder.download_password_hash) {
      return NextResponse.json({
        error: "This set is not ready for download yet. Ask the gallery owner to set a download PIN.",
      }, { status: 403 });
    }

    const valid = await verifyGalleryPassword(pin, folder.download_password_hash);
    if (!valid) {
      return NextResponse.json({ error: "The download PIN is incorrect." }, { status: 401 });
    }

    const ordered = photos ?? [];
    if (!ordered.length) {
      return NextResponse.json({ error: "This set has no downloadable photos." }, { status: 404 });
    }

    const signature = signatureFor(ordered);
    let zipPath = folder.download_zip_path;

    if (
      !zipPath ||
      folder.download_zip_signature !== signature ||
      !(await photoStore().objectExists(zipPath))
    ) {
      const entries: { name: string; data: Buffer }[] = [];

      const concurrency = 8;
      let nextIndex = 0;
      const workers = Array.from({ length: Math.min(concurrency, ordered.length) }, async () => {
        while (nextIndex < ordered.length) {
          const index = nextIndex++;
          const photo = ordered[index];
          const path = photo.download_path || photo.preview_path || photo.thumbnail_path;
          if (!path) continue;

          const data = await photoStore().downloadBytes(path);
          if (!data) continue;

          try {
            const lowerPath = path.toLowerCase();
            const jpeg = /\\.(jpe?g)$/.test(lowerPath)
              ? data
              : await sharp(data).jpeg({ quality: 92 }).toBuffer();
            const filename = downloadFilename({
              galleryTitle: gallery.title,
              folderName: folder.name,
              index: index + 1,
              photo,
            }).replace(/\\.[a-z0-9]+$/i, ".jpg");

            entries[index] = { name: filename, data: jpeg };
          } catch {
            // Skip an individual unreadable source rather than failing the set.
          }
        }
      });
      await Promise.all(workers);

      const readyEntries = entries.filter(Boolean);\n      if (!readyEntries.length) {
        return NextResponse.json({ error: "This set has no downloadable photos." }, { status: 404 });
      }

      const zip = createStoredZip(readyEntries);
      zipPath = `gallery-downloads/${gallery.id}/${folder.id}/${signature}.zip`;

      await photoStore().uploadPhoto({
        key: zipPath,
        body: zip,
        contentType: "application/zip",
        upsert: true,
      });

      if (folder.download_zip_path && folder.download_zip_path !== zipPath) {
        try {
          await photoStore().removePhotos([folder.download_zip_path]);
        } catch {
          // The new archive is valid even if cleanup of the old archive fails.
        }
      }

      const { error: updateError } = await db
        .from("folders")
        .update({
          download_zip_path: zipPath,
          download_zip_signature: signature,
          download_zip_generated_at: new Date().toISOString(),
        })
        .eq("id", folder.id)
        .eq("gallery_id", gallery.id);

      if (updateError) {
        return NextResponse.json({ error: "The ZIP was created but could not be registered." }, { status: 500 });
      }
    }

    const archiveName =
      safeSegment(gallery.title, "gallery") +
      "-" +
      safeSegment(folder.name, "photos") +
      ".zip";

    const url = await photoStore().signedDownloadUrl(
      zipPath,
      archiveName,
      DOWNLOAD_SIGNED_URL_SECONDS,
    );

    if (!url) {
      return NextResponse.json({ error: "The set download could not be prepared." }, { status: 500 });
    }

    return NextResponse.json({ url, filename: archiveName });
  } catch {
    return NextResponse.json({ error: "The set download could not be prepared." }, { status: 500 });
  }
}
