import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireGalleryAccess } from "@/lib/gallery-access";
import { galleryDb } from "@/lib/gallery-db";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { photoStore } from "@/lib/storage-provider";
import { downloadFilename } from "@/lib/client-media";
import { createStoredZip } from "@/lib/stored-zip";
import { createHash } from "node:crypto";

function downloadSignature(photos: Array<{ id: string; download_path: string | null; preview_path: string | null; thumbnail_path: string | null; sort_order: number | null }>) {
  const payload = photos
    .map(photo => [photo.id, photo.download_path ?? "", photo.preview_path ?? "", photo.thumbnail_path ?? "", photo.sort_order ?? 0].join("|"))
    .join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

function safeSegment(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return cleaned || fallback;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const gallery = await requireGalleryAccess(slug);
    const form = await request.formData();
    const setSlug = String(form.get("set_slug") ?? "").trim();
    const pin = String(form.get("pin") ?? "").trim();
    if (!pin) return NextResponse.json({ error: "Enter the set download PIN." }, { status: 400 });

    const db = galleryDb();
    const [{ data: photos }, { data: folders }] = await Promise.all([
      db.from("photos").select("id,folder_id,filename,sort_order,thumbnail_path,preview_path,download_path,original_path").eq("gallery_id", gallery.id),
      db.from("folders").select("id,name,slug,sort_order,download_password_hash,download_zip_path,download_zip_signature").eq("gallery_id", gallery.id),
    ]);

    const photosByFolder = new Map<string, NonNullable<typeof photos>>();
    for (const photo of photos ?? []) {
      const list = photosByFolder.get(photo.folder_id) ?? [];
      list.push(photo);
      photosByFolder.set(photo.folder_id, list);
    }
    for (const list of photosByFolder.values()) list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));

    const targetFolder = setSlug ? (folders ?? []).find(folder => folder.slug === setSlug) : null;
    if (!targetFolder) {
      return NextResponse.json({ error: "A photo set must be selected for download." }, { status: 400 });
    }
    if (!targetFolder.download_password_hash) {
      return NextResponse.json({ error: "This set is not ready for download yet. Ask the gallery owner to set a download PIN." }, { status: 403 });
    }
    const pinValid = await verifyGalleryPassword(pin, targetFolder.download_password_hash);
    if (!pinValid) {
      return NextResponse.json({ error: "The download PIN is incorrect." }, { status: 401 });
    }
    const signature = downloadSignature(photosByFolder.get(targetFolder.id) ?? []);
    if (
      targetFolder.download_zip_path &&
      targetFolder.download_zip_signature === signature &&
      await photoStore().objectExists(targetFolder.download_zip_path)
    ) {
      const archiveName = safeSegment(gallery.title, "gallery") + "-" + safeSegment(targetFolder.name, "photos") + ".zip";
      const url = await photoStore().signedDownloadUrl(targetFolder.download_zip_path, archiveName, DOWNLOAD_SIGNED_URL_SECONDS);
      if (url) return NextResponse.redirect(url);
    }

    const scopedFolders = [targetFolder];
    const folderById = new Map(scopedFolders.map(folder => [folder.id, folder]));
    const ordered = [...scopedFolders]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      .flatMap(folder => photosByFolder.get(folder.id) ?? []);

    const entries: { name: string; data: Buffer }[] = [];
    let skipped = 0;
    for (const photo of ordered) {
      const path = photo.download_path || photo.preview_path || photo.thumbnail_path;
      if (!path) { skipped += 1; continue; }
      const data = await photoStore().downloadBytes(path);
      if (!data) { skipped += 1; continue; }
      let jpeg: Buffer;
      try { jpeg = await sharp(data).jpeg({ quality: 92 }).toBuffer(); }
      catch { skipped += 1; continue; }
      const folder = folderById.get(photo.folder_id);
      const folderName = safeSegment(folder?.name ?? "Gallery", "Gallery");
      const filename = downloadFilename({
        galleryTitle: gallery.title,
        folderName: folder?.name ?? "Gallery",
        index: (photosByFolder.get(photo.folder_id) ?? []).findIndex(item => item.id === photo.id) + 1,
        photo,
      }).replace(/\.[a-z0-9]+$/i, ".jpg");
      entries.push({ name: folderName + "/" + filename, data: jpeg });
    }

    if (!entries.length) return NextResponse.json({ error: "This set has no downloadable photos." }, { status: 404 });
    const zip = createStoredZip(entries);
    const archiveName = safeSegment(gallery.title, "gallery") + "-" + safeSegment(targetFolder?.name ?? "photos", "photos") + ".zip";
    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archiveName.replace(/"/g, "")}"`,
        "Content-Length": String(zip.byteLength),
        "Cache-Control": "private, no-store",
        ...(skipped ? { "X-Gallery-Skipped": String(skipped) } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "The download could not be prepared." }, { status: 500 });
  }
}
