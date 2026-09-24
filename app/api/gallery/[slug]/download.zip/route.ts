import { NextResponse } from "next/server";
import sharp from "sharp";
import { isValidProfileEmail, normalizeProfileEmail, setProfileCookie, upsertProfile } from "@/lib/gallery-profile";
import { requireGalleryAccess } from "@/lib/gallery-access";
import { galleryDb } from "@/lib/gallery-db";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { photoStore } from "@/lib/storage-provider";
import { downloadFilename } from "@/lib/client-media";
import { createStoredZip } from "@/lib/stored-zip";

function safeSegment(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return cleaned || fallback;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const gallery = await requireGalleryAccess(slug);
    const form = await request.formData();
    const email = normalizeProfileEmail(String(form.get("email") ?? ""));
    const pin = String(form.get("pin") ?? "");
    if (!isValidProfileEmail(email) || !pin) return NextResponse.json({ error: "Enter your email and PIN." }, { status: 400 });

    const pinValid =
      (gallery.password_hash ? await verifyGalleryPassword(pin, gallery.password_hash) : false) ||
      (gallery.client_password_hash ? await verifyGalleryPassword(pin, gallery.client_password_hash) : false);
    if (!pinValid) return NextResponse.json({ error: "The email or PIN is incorrect." }, { status: 401 });

    const profile = await upsertProfile(email, false);
    if (!profile) return NextResponse.json({ error: "Unable to save your email. Try again." }, { status: 500 });
    await setProfileCookie(profile.id);

    const db = galleryDb();
    const [{ data: photos }, { data: folders }] = await Promise.all([
      db.from("photos").select("id,folder_id,filename,sort_order,thumbnail_path,preview_path,download_path,original_path").eq("gallery_id", gallery.id),
      db.from("folders").select("id,name,sort_order").eq("gallery_id", gallery.id),
    ]);

    const photosByFolder = new Map<string, NonNullable<typeof photos>>();
    for (const photo of photos ?? []) {
      const list = photosByFolder.get(photo.folder_id) ?? [];
      list.push(photo);
      photosByFolder.set(photo.folder_id, list);
    }
    for (const list of photosByFolder.values()) list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));

    const folderById = new Map((folders ?? []).map(folder => [folder.id, folder]));
    const ordered = [...(folders ?? [])]
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

    if (!entries.length) return NextResponse.json({ error: "The gallery has no downloadable photos." }, { status: 404 });
    const zip = createStoredZip(entries);
    const archiveName = safeSegment(gallery.title, "gallery") + "-photos.zip";
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
