import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/gallery-profile";
import { requireGalleryAccess } from "@/lib/gallery-access";
import { galleryDb } from "@/lib/gallery-db";
import { photoStore } from "@/lib/storage-provider";
import { downloadFilename } from "@/lib/client-media";
import { derivativeDownloadName } from "@/lib/photo-share";
import { createStoredZip } from "@/lib/stored-zip";

function safeSegment(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return cleaned || fallback;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const gallery = await requireGalleryAccess(slug);
    const profile = await currentProfile();
    if (!profile) return NextResponse.json({ error: "Email identity required." }, { status: 401 });

    const db = galleryDb();
    const { data: favorites } = await db
      .from("selections")
      .select("photo_id")
      .eq("gallery_id", gallery.id)
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });

    const photoIds = (favorites ?? []).map(row => row.photo_id);
    if (!photoIds.length) return NextResponse.json({ error: "No favourites found." }, { status: 404 });

    const [{ data: photos }, { data: folders }] = await Promise.all([
      db.from("photos")
        .select("id,folder_id,filename,sort_order,thumbnail_path,preview_path,download_path,original_path")
        .eq("gallery_id", gallery.id)
        .in("id", photoIds),
      db.from("folders")
        .select("id,name,sort_order")
        .eq("gallery_id", gallery.id),
    ]);

    const folderById = new Map((folders ?? []).map(folder => [folder.id, folder]));
    const photosByFolder = new Map<string, NonNullable<typeof photos>>();
    for (const photo of photos ?? []) {
      const list = photosByFolder.get(photo.folder_id) ?? [];
      list.push(photo);
      photosByFolder.set(photo.folder_id, list);
    }

    for (const list of photosByFolder.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
    }

    const favoritesSet = new Set(photoIds);
    const ordered = [...(folders ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      .flatMap(folder => (photosByFolder.get(folder.id) ?? []).filter(photo => favoritesSet.has(photo.id)));

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

      const folder = folderById.get(photo.folder_id);
      const folderName = safeSegment(folder?.name ?? "Gallery", "Gallery");
      const filename = downloadFilename({
        galleryTitle: gallery.title,
        folderName: folder?.name ?? "Gallery",
        index: (photosByFolder.get(photo.folder_id) ?? []).findIndex(item => item.id === photo.id) + 1,
        photo,
      });
      const finalName = safeSegment(derivativeDownloadName(filename, path), "photograph.jpg");
      entries.push({ name: folderName + "/" + finalName, data });
    }

    if (!entries.length) {
      return NextResponse.json({ error: "The favourites could not be prepared." }, { status: 503 });
    }

    const zip = createStoredZip(entries);
    const archiveName = safeSegment(gallery.title, "gallery") + "-favourites.zip";
    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=\"" + archiveName.replace(/"/g, "") + "\"",
        "Content-Length": String(zip.byteLength),
        "Cache-Control": "private, no-store",
        ...(skipped ? { "X-Favorites-Skipped": String(skipped) } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "The favourites download could not be prepared." }, { status: 500 });
  }
}
