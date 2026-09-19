import Link from "next/link";
import { notFound } from "next/navigation";
import { createFolder, uploadPhotos } from "@/app/admin/crud-actions";
import { FolderRow } from "@/components/admin/folder-row";
import { GalleryForm } from "@/components/admin/gallery-form";
import { PhotoItem } from "@/components/admin/photo-item";
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
  const db = await adminDb();
  const { data: gallery } = await db.from("galleries").select("id,title,slug,description,status,client_id,password_hash").eq("id", galleryId).maybeSingle();
  if (!gallery) notFound();
  const [{ data: client }, { data: clients }, { data: folders }, { data: photos }, { data: submissions }, { count: selectionCount }] = await Promise.all([
    db.from("clients").select("id,name").eq("id", gallery.client_id).maybeSingle(),
    db.from("clients").select("id,name").order("name"),
    db.from("folders").select("id,name,parent_folder_id,sort_order").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("photos").select("id,filename,bytes,folder_id,original_path,sort_order").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("selection_submissions").select("id,selection_session_hash,photo_count,status,submitted_at").eq("gallery_id", galleryId).order("submitted_at", { ascending: false }),
    db.from("selections").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId),
  ]);
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
  const photoError = error === "invalid-photo" || error === "photo-upload" ? message : null;
  const folderNames = new Map((folders ?? []).map(folder => [folder.id, folder.name]));
  const paths = (photos ?? []).map(photo => photo.original_path);
  const signed = paths.length
    ? (await db.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(paths, 60 * 30)).data ?? []
    : [];
  const previewByPath = new Map(signed.map(item => [item.path, item.signedUrl]));

  return (
    <section className="admin-content">
      <Link className="back" href="/admin/galleries">← Galleries</Link>
      <div className="admin-title">
        <div>
          <p className="eyebrow">GALLERY · {gallery.status}</p>
          <h1>{gallery.title}</h1>
          <p className="muted">Client: {client ? <Link href={`/admin/clients/${client.id}`}>{client.name}</Link> : "Unknown"}</p>
        </div>
        <a className="admin-button" href="#photo-upload">Add photos</a>
      </div>
      <div className="gallery-admin-grid">
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Folders</h2>
            <form action={createFolder} className="folder-form">
              <input name="gallery_id" type="hidden" value={gallery.id} />
              <input aria-label="Folder name" maxLength={200} name="name" placeholder="New folder" required />
              <button className="subtle-button">+ New folder</button>
            </form>
          </div>
          {folderError ? <p className="form-error" role="alert">{folderError}</p> : null}
          {folders?.length ? folders.map(folder => (
            <FolderRow folder={folder} galleryId={gallery.id} key={folder.id} />
          )) : <p className="empty">No folders yet. Create a folder before uploading photos.</p>}
        </section>
        <aside className="admin-panel settings-card">
          <h2>Client gallery</h2>
          <label>Share link<div className="copy-field"><input readOnly value={`/gallery/${gallery.slug}`} /></div></label>
          <p className="empty">{gallery.status === "published" ? "Clients can open this path once you share it." : "Publish the gallery before clients can open the link."} {gallery.password_hash ? "A password is currently required." : "No password is set."}</p>
          <div className="admin-selection-status">
            <span>Selection</span>
            <strong className={selectionStatus === "Selection submitted" ? "is-submitted" : undefined}>{selectionStatus}</strong>
          </div>
        </aside>
      </div>
      <GalleryForm
        clients={clients ?? []}
        error={galleryError}
        gallery={{ id: gallery.id, title: gallery.title, slug: gallery.slug, description: gallery.description, client_id: gallery.client_id, status: gallery.status, passwordProtected: Boolean(gallery.password_hash) }}
      />
      <section className="admin-panel" id="submitted-selections">
        <div className="panel-heading">
          <h2>Submitted selections</h2>
          <span>{submissions?.length ?? 0} total</span>
        </div>
        <SelectionSubmissions submissions={submissionView} />
      </section>
      <section className="admin-panel" id="photo-upload">
        <div className="panel-heading">
          <h2>Photos</h2>
          <span>{photos?.length ?? 0} total</span>
        </div>
        {folders?.length ? (
          <form action={uploadPhotos} className="photo-upload-form">
            {photoError ? <p className="form-error" role="alert">{photoError}</p> : null}
            <input name="gallery_id" type="hidden" value={gallery.id} />
            <label>Folder
              <select defaultValue={folders[0].id} name="folder_id" required>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <label>Files
              <input accept="image/jpeg,image/png,image/webp,image/gif" multiple name="files" required type="file" />
            </label>
            <p className="empty">Originals go to the private Storage bucket. Previews here are short-lived admin signed URLs.</p>
            <button className="admin-button">Upload photos</button>
          </form>
        ) : <p className="empty">Create a folder first, then you can upload photos into it.</p>}
        {photos?.length ? (
          <div className="photo-admin-grid">
            {photos.map(photo => (
              <PhotoItem
                folderName={folderNames.get(photo.folder_id) ?? "Folder"}
                galleryId={gallery.id}
                key={photo.id}
                photo={{ id: photo.id, filename: photo.filename, bytes: photo.bytes, previewUrl: previewByPath.get(photo.original_path) ?? null }}
              />
            ))}
          </div>
        ) : folders?.length ? <p className="empty">No photos yet. Upload JPEG, PNG, WebP, or GIF files into a folder.</p> : null}
      </section>
    </section>
  );
}
