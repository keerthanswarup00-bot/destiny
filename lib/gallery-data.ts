import "server-only";
import { CLIENT_SIGNED_URL_SECONDS, clientFacingObjectPath } from "@/lib/client-media";
import { GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";
import { galleryDb } from "@/lib/gallery-db";

export async function signedClientUrls(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const unique = [...new Set(paths)];
  const { data } = await galleryDb().storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(unique, CLIENT_SIGNED_URL_SECONDS);
  return new Map((data ?? []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]));
}

export async function galleryFolders(galleryId: string) {
  const db = galleryDb();
  const [{ data: folders }, { data: photos }] = await Promise.all([
    db.from("folders").select("id,name,slug,sort_order").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("photos").select("id,folder_id,sort_order,thumbnail_path,preview_path,original_path,width,height").eq("gallery_id", galleryId).order("sort_order").order("id"),
  ]);
  const counts = new Map<string, number>();
  const covers = new Map<string, { path: string; width: number | null; height: number | null }>();
  for (const photo of photos ?? []) {
    counts.set(photo.folder_id, (counts.get(photo.folder_id) ?? 0) + 1);
    if (!covers.has(photo.folder_id)) {
      covers.set(photo.folder_id, { path: clientFacingObjectPath(photo, "grid"), width: photo.width, height: photo.height });
    }
  }
  const urls = await signedClientUrls([...covers.values()].map(cover => cover.path));
  return (folders ?? []).map(folder => {
    const cover = covers.get(folder.id);
    return {
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      photoCount: counts.get(folder.id) ?? 0,
      coverUrl: cover ? urls.get(cover.path) ?? null : null,
      coverWidth: cover?.width ?? null,
      coverHeight: cover?.height ?? null,
    };
  });
}

export async function galleryFolder(galleryId: string, folderSlug: string) {
  const db = galleryDb();
  const { data: folder } = await db.from("folders").select("id,name,slug").eq("gallery_id", galleryId).eq("slug", folderSlug).maybeSingle();
  if (!folder) return null;
  const { data: photos } = await db.from("photos").select("id,width,height,sort_order,thumbnail_path,preview_path,original_path").eq("gallery_id", galleryId).eq("folder_id", folder.id).order("sort_order").order("id");
  const gridPaths = (photos ?? []).map(photo => clientFacingObjectPath(photo, "grid"));
  const fullPaths = (photos ?? []).map(photo => clientFacingObjectPath(photo, "full"));
  const [urls, fullUrls] = await Promise.all([signedClientUrls(gridPaths), signedClientUrls(fullPaths)]);
  return {
    folder,
    photos: (photos ?? []).map(photo => {
      const gridPath = clientFacingObjectPath(photo, "grid");
      const fullPath = clientFacingObjectPath(photo, "full");
      const src = urls.get(gridPath) ?? "";
      const fullSrc = fullUrls.get(fullPath) ?? src;
      return {
        id: photo.id,
        width: photo.width,
        height: photo.height,
        src,
        fullSrc,
      };
    }).filter(photo => photo.src),
  };
}

export async function selectedPhotoIds(galleryId: string, viewerKeyHash: string | null) {
  if (!viewerKeyHash) return new Set<string>();
  const { data } = await galleryDb().from("selections").select("photo_id").eq("gallery_id", galleryId).eq("viewer_key_hash", viewerKeyHash);
  return new Set((data ?? []).map(row => row.photo_id));
}

export async function viewerSubmission(galleryId: string, viewerKeyHash: string | null) {
  if (!viewerKeyHash) return null;
  const { data } = await galleryDb().from("selection_submissions").select("id,photo_count,submitted_at,status").eq("gallery_id", galleryId).eq("selection_session_hash", viewerKeyHash).maybeSingle();
  return data;
}
