import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { GalleryForm } from "@/components/admin/gallery-form";
import { CollectionEditor } from "@/components/admin/collection-editor";
import { SelectionSubmissions, type AdminSubmission } from "@/components/admin/selection-submissions";
import { adminDb } from "@/lib/admin-data";
import { adminError, GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";

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
  const { data: gallery } = await db.from("galleries").select("id,title,slug,description,status,client_id,password_hash,created_at").eq("id", galleryId).maybeSingle();
  if (!gallery) notFound();
  const shareUrl = `${proto}://${host}/gallery/${gallery.slug}`;

  const [{ data: client }, { data: clients }, { data: folders }, { data: photos }, { data: submissions }, { count: selectionCount }] = await Promise.all([
    db.from("clients").select("id,name").eq("id", gallery.client_id).maybeSingle(),
    db.from("clients").select("id,name").order("name"),
    db.from("folders").select("id,name,slug,parent_folder_id,sort_order,published,cover_photo_id,description").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("photos").select("id,filename,folder_id,thumbnail_path,preview_path,original_path,width,height,sort_order").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("selection_submissions").select("id,selection_session_hash,photo_count,status,submitted_at").eq("gallery_id", galleryId).order("submitted_at", { ascending: false }),
    db.from("selections").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId),
  ]);

  const signingPaths = (photos ?? []).map(photo => photo.thumbnail_path || photo.preview_path || photo.original_path).filter(Boolean);
  const originalPaths = (photos ?? []).map(photo => photo.original_path).filter(Boolean);
  const [grid, originals] = await Promise.all([
    signingPaths.length ? db.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(signingPaths, 60 * 30) : Promise.resolve({ data: [] }),
    originalPaths.length ? db.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(originalPaths, 60 * 30) : Promise.resolve({ data: [] }),
  ]);
  const urlByPath = new Map((grid.data ?? []).map(item => [item.path, item.signedUrl]));
  const downloadByPath = new Map((originals.data ?? []).map(item => [item.path, item.signedUrl]));

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

  const sessionHashes = (submissions ?? []).map(submission => submission.selection_session_hash);
  const { data: selectionRows } = sessionHashes.length
    ? await db.from("selections").select("photo_id,viewer_key_hash").eq("gallery_id", galleryId).in("viewer_key_hash", sessionHashes)
    : { data: [] };
  const selectedPhotoIds = [...new Set((selectionRows ?? []).map(row => row.photo_id))];
  const { data: selectedPhotos } = selectedPhotoIds.length
    ? await db.from("photos").select("id,filename,original_path").in("id", selectedPhotoIds)
    : { data: [] };
  const selectedPaths = (selectedPhotos ?? []).map(photo => photo.original_path);
  const selectedSigned = selectedPaths.length
    ? (await db.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(selectedPaths, 60 * 30)).data ?? []
    : [];
  const previewBySelectedPath = new Map(selectedSigned.map(item => [item.path, item.signedUrl]));
  const photoById = new Map((selectedPhotos ?? []).map(photo => [photo.id, photo]));
  const submissionView: AdminSubmission[] = (submissions ?? []).map(submission => ({
    id: submission.id,
    status: submission.status,
    photoCount: submission.photo_count,
    submittedAt: submission.submitted_at,
    photos: (selectionRows ?? []).filter(row => row.viewer_key_hash === submission.selection_session_hash).map(row => {
      const photo = photoById.get(row.photo_id);
      return photo ? { id: photo.id, filename: photo.filename, previewUrl: previewBySelectedPath.get(photo.original_path) ?? null } : null;
    }).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)),
  }));
  const selectionStatus = (submissions ?? []).length
    ? "Selection submitted"
    : (selectionCount ?? 0) > 0
      ? "Selection in progress"
      : "No selection";

  const galleryError = error === "invalid-gallery" ? message : null;
  const folderError = error === "invalid-folder" ? message : null;

  return (
    <>
      <CollectionEditor
        error={folderError}
        coverUrl={coverUrl}
        coversByFolder={coversByFolder}
        folders={(folders ?? []).map(folder => ({
          id: folder.id,
          name: folder.name,
          slug: folder.slug,
          description: folder.description,
          published: folder.published,
          coverPhotoId: folder.cover_photo_id,
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
      />
      <section className="admin-content editor-settings">
        <GalleryForm
          clients={clients ?? []}
          error={galleryError}
          gallery={{ id: gallery.id, title: gallery.title, slug: gallery.slug, description: gallery.description, client_id: gallery.client_id, status: gallery.status, passwordProtected: Boolean(gallery.password_hash) }}
        />
        <aside className="admin-panel settings-card" id="share-panel">
          <h2>Share collection</h2>
          <label>Share link<div className="copy-field"><input readOnly value={shareUrl} /></div></label>
          <p className="empty">{gallery.password_hash ? "A password is currently required to open this collection." : "No password is set — the link opens directly."}</p>
          <p className="empty">{gallery.status === "published" ? "The link is live. Clients can open the gallery and submit their selection." : "Publish the collection in the editor to make the link live."}</p>
          <div className="admin-selection-status">
            <span>Selection</span>
            <strong className={selectionStatus === "Selection submitted" ? "is-submitted" : undefined}>{selectionStatus}</strong>
          </div>
        </aside>
        <section className="admin-panel" id="submitted-selections">
          <div className="panel-heading">
            <h2>Submitted selections</h2>
            <span>{submissions?.length ?? 0} total</span>
          </div>
          <SelectionSubmissions submissions={submissionView} />
        </section>
      </section>
    </>
  );
}