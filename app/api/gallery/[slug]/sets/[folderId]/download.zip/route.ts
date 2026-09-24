import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireGalleryAccess } from "@/lib/gallery-access";
import { galleryDb } from "@/lib/gallery-db";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { photoStore } from "@/lib/storage-provider";
import { DOWNLOAD_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { prepareSetDownload } from "@/lib/set-download";

function safeSegment(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return cleaned || fallback;
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

    if (!pin) return NextResponse.json({ error: "Enter the download PIN." }, { status: 400 });

    const db = galleryDb();
    const { data: folder, error } = await db
      .from("folders")
      .select("id,name,download_password_hash,download_zip_path,download_zip_signature")
      .eq("id", folderId)
      .eq("gallery_id", gallery.id)
      .maybeSingle();

    if (error) {
      console.error("[set-download] folder lookup failed", { galleryId: gallery.id, folderId, error: error.message });
      return NextResponse.json({ error: "The set download could not be prepared." }, { status: 500 });
    }

    if (!folder) return NextResponse.json({ error: "This photo set could not be found." }, { status: 404 });

    if (!folder.download_password_hash) {
      return NextResponse.json({
        error: "This set is not ready for download yet. Ask the gallery owner to set a download PIN.",
      }, { status: 403 });
    }

    if (!(await verifyGalleryPassword(pin, folder.download_password_hash))) {
      return NextResponse.json({ error: "The download PIN is incorrect." }, { status: 401 });
    }

    let zipPath = folder.download_zip_path;
    const cachedReady =
      Boolean(zipPath) &&
      Boolean(folder.download_zip_signature) &&
      await photoStore().objectExists(zipPath!);

    if (!cachedReady) {
      after(async () => {
        try {
          await prepareSetDownload(gallery.id, folderId);
        } catch (error) {
          console.error("[set-download] background preparation failed", {
            galleryId: gallery.id,
            folderId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      return NextResponse.json({ status: "preparing" }, { status: 202 });
    }

    const archiveName =
      safeSegment(gallery.title, "gallery") +
      "-" +
      safeSegment(folder.name, "photos") +
      ".zip";

    const url = await photoStore().signedDownloadUrl(
      zipPath!,
      archiveName,
      DOWNLOAD_SIGNED_URL_SECONDS,
    );

    if (!url) {
      console.error("[set-download] signed URL generation returned empty", { galleryId: gallery.id, folderId, zipPath });
      return NextResponse.json({ error: "The set download could not be prepared." }, { status: 500 });
    }

    return NextResponse.json({ status: "ready", url, filename: archiveName });
  } catch (error) {
    console.error("[set-download] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "The set download could not be prepared." }, { status: 500 });
  }
}
