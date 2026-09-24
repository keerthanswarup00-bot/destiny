import "server-only";
import sharp from "sharp";
import { CLIENT_SIGNED_URL_SECONDS, clientFacingObjectPath } from "@/lib/client-media";
import { photoStore } from "@/lib/storage-provider";
import { galleryDb } from "@/lib/gallery-db";

type PhotoWithPaths = { width: number | null; height: number | null; thumbnail_path: string | null; preview_path: string | null; original_path: string };

const dimensionCache = new Map<string, { width: number; height: number }>();

/** Resolve intrinsic dimensions for photos whose rows predate width/height capture. Reads are cached per object. */
export async function resolvePhotoDimensions(photo: PhotoWithPaths): Promise<{ width: number | null; height: number | null }> {
  if (photo.width && photo.height) return { width: photo.width, height: photo.height };
  const objectPath = photo.thumbnail_path ?? photo.preview_path ?? photo.original_path;
  if (!objectPath) return { width: null, height: null };
  const cached = dimensionCache.get(objectPath);
  if (cached) return cached;
  try {
    const body = await photoStore().downloadBytes(objectPath);
    if (!body) return { width: null, height: null };
    const metadata = await sharp(body).metadata();
    const size = { width: metadata.width ?? null, height: metadata.height ?? null };
    if (size.width && size.height) dimensionCache.set(objectPath, size as { width: number; height: number });
    return size;
  } catch {
    return { width: null, height: null };
  }
}

export async function signedClientUrls(paths: string[]) {
  return photoStore().signedGetUrls(paths, CLIENT_SIGNED_URL_SECONDS);
}

export type GalleryFolderCard = {
  id: string;
  name: string;
  slug: string;
  photoCount: number;
  coverUrl: string | null;
  coverFullUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

export async function galleryFolders(galleryId: string): Promise<GalleryFolderCard[]> {
  const db = galleryDb();
  const [{ data: folders }, { data: photos }] = await Promise.all([
    db.from("folders").select("id,name,slug,sort_order,published,cover_photo_id").eq("gallery_id", galleryId).eq("published", true).order("sort_order").order("id"),
    db.from("photos").select("id,folder_id,sort_order,thumbnail_path,preview_path,original_path,width,height").eq("gallery_id", galleryId).order("sort_order").order("id"),
  ]);
  const counts = new Map<string, number>();
  const covers = new Map<string, { path: string; fullPath: string; width: number | null; height: number | null }>();
  for (const folder of folders ?? []) {
    const folderPhotos = (photos ?? []).filter(photo => photo.folder_id === folder.id).sort((a, b) => a.sort_order - b.sort_order || 0);
    counts.set(folder.id, folderPhotos.length);
    // Cover: explicit cover_photo_id if it belongs to THIS set; otherwise the
    // first photo of THIS set only. Never another Set, never a gallery-wide image.
    const chosen = folderPhotos.find(photo => photo.id === folder.cover_photo_id) ?? folderPhotos[0];
    if (chosen) {
      const path = clientFacingObjectPath(chosen, "grid");
      if (path) {
        // Fullscreen viewer gets the high-resolution derivative; identical URL
        // to the grid asset when no preview exists.
        const fullPath = clientFacingObjectPath(chosen, "full") ?? path;
        const dims = await resolvePhotoDimensions(chosen);
        covers.set(folder.id, { path, fullPath, width: dims.width, height: dims.height });
      }
    }
  }
  const urls = await signedClientUrls([...new Set([...covers.values()].flatMap(cover => [cover.path, cover.fullPath]))]);
  return (folders ?? []).map(folder => {
    const cover = covers.get(folder.id);
    return {
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      photoCount: counts.get(folder.id) ?? 0,
      coverUrl: cover ? urls.get(cover.path) ?? null : null,
      coverFullUrl: cover ? urls.get(cover.fullPath) ?? null : null,
      coverWidth: cover?.width ?? null,
      coverHeight: cover?.height ?? null,
    };
  });
}

export type GalleryOverview = {
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  setCount: number;
  photoCount: number;
};

export async function galleryOverviews(galleryIds: string[]): Promise<Map<string, GalleryOverview>> {
  if (!galleryIds.length) return new Map();
  const db = galleryDb();
  const unique = [...new Set(galleryIds)];
  const [foldersResult, photosResult] = await Promise.all([
    db.from("folders").select("gallery_id,id,sort_order,published,cover_photo_id").in("gallery_id", unique).order("sort_order").order("id"),
    db.from("photos").select("id,gallery_id,folder_id,width,height,thumbnail_path,preview_path,original_path").in("gallery_id", unique),
  ]);
  const photosByGallery = new Map<string, { id: string; gallery_id: string; folder_id: string; width: number | null; height: number | null; thumbnail_path: string | null; preview_path: string | null; original_path: string }[]>();
  for (const photo of photosResult.data ?? []) {
    const list = photosByGallery.get(photo.gallery_id) ?? [];
    list.push(photo);
    photosByGallery.set(photo.gallery_id, list);
  }
  const covers = new Map<string, { path: string; width: number | null; height: number | null }>();
  const out = new Map<string, GalleryOverview>();
  for (const id of unique) {
    const folders = (foldersResult.data ?? []).filter(folder => folder.gallery_id === id);
    const photos = photosByGallery.get(id) ?? [];
    const setCount = folders.length;
    const photoCount = photos.length;
    const firstPublished = folders.find(folder => folder.published);
    let coverUrl: string | null = null;
    let coverWidth: number | null = null;
    let coverHeight: number | null = null;
    if (firstPublished) {
      const folderPhotos = photos.filter(photo => photo.folder_id === firstPublished.id);
      const chosen = folderPhotos.find(photo => photo.id === firstPublished.cover_photo_id) ?? folderPhotos[0];
      if (chosen) {
        const path = clientFacingObjectPath(chosen, "grid");
        if (path) {
          const dims = await resolvePhotoDimensions(chosen);
          covers.set(id, { path, width: dims.width, height: dims.height });
        }
      }
    }
    out.set(id, { coverUrl, coverWidth, coverHeight, setCount, photoCount });
  }
  const urls = await signedClientUrls([...covers.values()].map(cover => cover.path));
  for (const [id, cover] of covers) {
    const entry = out.get(id);
    if (entry) entry.coverUrl = urls.get(cover.path) ?? null;
  }
  return out;
}

export type GalleryFolderPhotoCard = {
  id: string;
  width: number | null;
  height: number | null;
  src: string;
  fullSrc: string;
};

export type GalleryFolderDetail = {
  folder: { id: string; name: string; slug: string; description: string | null };
  photos: GalleryFolderPhotoCard[];
} | null;

export async function galleryFolder(galleryId: string, folderSlug: string): Promise<GalleryFolderDetail> {
  const db = galleryDb();
  const { data: folder } = await db.from("folders").select("id,name,slug,description").eq("gallery_id", galleryId).eq("slug", folderSlug).maybeSingle();
  if (!folder) return null;
  const { data: photos } = await db.from("photos").select("id,width,height,sort_order,thumbnail_path,preview_path,original_path").eq("gallery_id", galleryId).eq("folder_id", folder.id).order("sort_order").order("id");
  const photosWithDimensions = await Promise.all((photos ?? []).map(async photo => ({ ...photo, ...(await resolvePhotoDimensions(photo)) })));
  const eligible = photosWithDimensions
    .map(photo => ({ photo, grid: clientFacingObjectPath(photo, "grid"), full: clientFacingObjectPath(photo, "full") }))
    .filter(entry => entry.grid !== null);
  const gridPaths = eligible.map(entry => entry.grid as string);
  const fullPaths = eligible.map(entry => entry.full ?? (entry.grid as string));
  const [urls, fullUrls] = await Promise.all([signedClientUrls(gridPaths), signedClientUrls([...new Set(fullPaths)])]);
  return {
    folder,
    photos: eligible.map(({ photo, grid, full }) => {
      const gridPath = grid as string;
      const src = urls.get(gridPath) ?? "";
      const fullSrc = fullUrls.get(full ?? "") ?? src;
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

export async function galleryFolderPhotos(galleryId: string, folderSlug: string): Promise<GalleryFolderPhotoCard[]> {
  const detail = await galleryFolder(galleryId, folderSlug);
  return detail?.photos ?? [];
}

export async function galleryClient(galleryId: string) {
  const db = galleryDb();
  const { data: gallery } = await db.from("galleries").select("client_id").eq("id", galleryId).maybeSingle();
  if (!gallery?.client_id) return null;
  const { data: client } = await db.from("clients").select("name,event_date").eq("id", gallery.client_id).maybeSingle();
  return client;
}

export async function selectedPhotoIds(galleryId: string, profileId: string | null) {
  if (!profileId) return new Set<string>();
  const { data } = await galleryDb().from("selections").select("photo_id").eq("gallery_id", galleryId).eq("profile_id", profileId);
  return new Set((data ?? []).map(row => row.photo_id));
}

/** Official client selection for an identified profile: distinct from favourites. */
export async function clientSelectedPhotoIds(galleryId: string, profileId: string | null) {
  if (!profileId) return new Set<string>();
  const { data } = await galleryDb().from("client_selection_photos").select("photo_id").eq("gallery_id", galleryId).eq("profile_id", profileId);
  return new Set((data ?? []).map(row => row.photo_id));
}

export async function viewerSubmission(galleryId: string, profileId: string | null) {
  if (!profileId) return null;
  const { data } = await galleryDb().from("selection_submissions").select("id,photo_count,submitted_at,status").eq("gallery_id", galleryId).eq("profile_id", profileId).maybeSingle();
  return data;
}
