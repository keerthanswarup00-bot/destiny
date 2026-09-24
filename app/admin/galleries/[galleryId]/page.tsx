import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CollectionEditor } from "@/components/admin/collection-editor";
import { GallerySettings } from "@/components/admin/gallery-settings";
import { adminDb } from "@/lib/admin-data";
import { galleryEmails, galleryViewStats, relativeTimeLabel } from "@/lib/admin-analytics";
import { adminError } from "@/lib/admin-validation";
import { photoStore } from "@/lib/storage-provider";
import { normalizeHighlightCrop } from "@/lib/site/website-gallery";
import { decryptDownloadPin } from "@/lib/gallery-password";
import { DownloadZipPreloader } from "@/components/admin/download-zip-preloader";

export default async function GalleryDetail({
  params,
  searchParams,
}: {
  params: Promise<{ galleryId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { galleryId } = await params;
  const { error } = await searchParams;
  const message = adminError(error);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const db = await adminDb();
  const { data: gallery } = await db.from("galleries").select("id,title,slug,description,status,client_id,password_hash,client_password_hash,highlight_photo_id,highlight_crop,created_at").eq("id", galleryId).maybeSingle();
  if (!gallery) notFound();
  const shareUrl = `${proto}://${host}/gallery/${gallery.slug}`;

  const [{ data: client }, { data: clients }, { data: folders }, { data: photos }, { data: branding }, insights, emails] = await Promise.all([
    db.from("clients").select("id,name").eq("id", gallery.client_id).maybeSingle(),
    db.from("clients").select("id,name").order("name"),
    db.from("folders").select("id,name,slug,parent_folder_id,sort_order,published,cover_photo_id,description,download_password_hash,download_password_encrypted").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("photos").select("id,filename,folder_id,thumbnail_path,preview_path,original_path,width,height,sort_order").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("site_branding").select("watermark_path,watermark_enabled").eq("id", "branding").maybeSingle(),
    galleryViewStats(galleryId),
    galleryEmails(galleryId),
  ]);
  const watermarkEnabled = Boolean(branding?.watermark_path && branding.watermark_enabled !== false);

  const signingPaths = (photos ?? []).map(photo => photo.thumbnail_path || photo.preview_path || photo.original_path).filter(Boolean);
  const originalPaths = (photos ?? []).map(photo => photo.original_path).filter(Boolean);
  const [grid, originals] = await Promise.all([
    signingPaths.length ? photoStore().signedGetUrls(signingPaths, 60 * 30) : Promise.resolve(new Map<string, string>()),
    originalPaths.length ? photoStore().signedGetUrls(originalPaths, 60 * 30) : Promise.resolve(new Map<string, string>()),
  ]);
  const urlByPath = grid;
  const downloadByPath = originals;

  const photosByFolder: Record<string, { id: string; filename: string; width: number | null; height: number | null; src: string; downloadUrl: string }[]> = {};
  for (const photo of photos ?? []) {
    const signable = photo.thumbnail_path || photo.preview_path || photo.original_path;
    const src = urlByPath.get(signable) ?? "";
    if (!src) continue;
    const list = photosByFolder[photo.folder_id] ?? [];
    list.push({ id: photo.id, filename: photo.filename, width: photo.width, height: photo.height, src, downloadUrl: downloadByPath.get(photo.original_path) ?? "" });
    photosByFolder[photo.folder_id] = list;
  }

const coversByFolder: Record<string, string | null> = {};
let coverUrl: string | null = null;
for (const folder of folders ?? []) {
  const list = photosByFolder[folder.id] ?? [];
  const pick = list.find(photo => photo.id === folder.cover_photo_id) ?? list[0];
  coversByFolder[folder.id] = pick?.src ?? null;
  if (!coverUrl && pick?.src) coverUrl = pick.src;
}

// The gallery-level client highlight (galleries.highlight_photo_id) resolves to
// any photo in the gallery regardless of set; null until one is configured.
const highlightPhoto = (photos ?? []).find(photo => photo.id === gallery.highlight_photo_id);
const highlight = {
    id: gallery.highlight_photo_id,
    src: highlightPhoto ? (urlByPath.get(highlightPhoto.thumbnail_path || highlightPhoto.preview_path || highlightPhoto.original_path) ?? null) : null,
    crop: highlightPhoto ? normalizeHighlightCrop(gallery.highlight_crop) : null,
  };

  const galleryError = error === "invalid-gallery" ? message : null;
  const folderError =
    error === "invalid-folder" || error === "folder-storage-delete" || error === "folder-delete" ? message : null;
  const photoError =
    error === "invalid-photo" || error === "photo-storage-delete" || error === "photo-delete" ||
    error === "photos-storage-delete" || error === "photos-delete" ? message : null;
  const workspaceError = folderError ?? photoError;

  return (
    <>
      <DownloadZipPreloader galleryId={galleryId} folderIds={(folders ?? []).map(folder => folder.id)} />
      <div id="gallery-workspace">
        <CollectionEditor
          error={workspaceError}
          coverUrl={coverUrl}
          coversByFolder={coversByFolder}
          folders={(folders ?? []).map(folder => ({
            id: folder.id,
            name: folder.name,
            slug: folder.slug,
            description: folder.description,
            published: folder.published,
            coverPhotoId: folder.cover_photo_id,
            hasDownloadPassword: Boolean(folder.download_password_hash),
             downloadPassword: decryptDownloadPin(folder.download_password_encrypted),
          }))}
          gallery={{
            id: gallery.id,
            title: gallery.title,
            slug: gallery.slug,
            status: gallery.status,
            description: gallery.description,
            createdAt: gallery.created_at,
            clientName: client?.name ?? null,
            clientId: client?.id ?? null,
            passwordProtected: Boolean(gallery.password_hash),
          }}
          photosByFolder={photosByFolder}
          shareUrl={shareUrl}
          watermarkEnabled={watermarkEnabled}
        />
      </div>
      <GallerySettings
        clients={clients ?? []}
        error={galleryError}
        folders={(folders ?? []).map(folder => ({ id: folder.id, name: folder.name }))}
        gallery={{
          id: gallery.id,
          title: gallery.title,
          slug: gallery.slug,
          description: gallery.description,
          clientId: gallery.client_id,
          clientName: client?.name ?? null,
          status: gallery.status,
          passwordProtected: Boolean(gallery.password_hash),
          clientPasswordProtected: Boolean(gallery.client_password_hash),
        }}
        highlight={highlight}
        photosByFolder={photosByFolder}
        shareUrl={shareUrl}
        insights={{
          uniqueVisitors: insights.uniqueVisitors,
          returningVisitors: insights.returningVisitors,
          totalViews: insights.totalViews,
          firstViewedLabel: relativeTimeLabel(insights.firstViewedAt),
          lastViewedLabel: relativeTimeLabel(insights.lastViewedAt),
          emails,
        }}
      />
    </>
  );
}