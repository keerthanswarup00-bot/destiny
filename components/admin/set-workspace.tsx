"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { deletePhotos, movePhotos } from "@/app/admin/crud-actions";
import { setFolderCover, setFolderPublished } from "@/app/admin/set-actions";
import { ApplyWatermarkButton } from "@/components/admin/apply-watermark-button";
import { DeleteSelectedButton } from "@/components/admin/delete-selected-button";
import { uploadClientGalleryFiles } from "@/components/admin/client-gallery-upload";
import { StagedUploadQueue, type StagedUploadQueueHandle } from "@/components/admin/upload-queue";

type WorkspacePhoto = { id: string; filename: string; width: number | null; height: number | null; src: string; downloadUrl: string };
type MoveTarget = { id: string; name: string };

export function SetWorkspace({
  gallery,
  folder,
  moveTargets,
  photos,
  watermarkEnabled,
}: {
  gallery: { id: string; title: string; slug: string };
  folder: { id: string; name: string; slug: string; description: string | null; published: boolean };
  moveTargets: MoveTarget[];
  photos: WorkspacePhoto[];
  watermarkEnabled: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const queueRef = useRef<StagedUploadQueueHandle>(null);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clear = () => setSelected(new Set());
  const none = selected.size === 0;
  const single = selected.size === 1;
  const singleId = single ? [...selected][0] : null;
  const allSelected = photos.length > 0 && photos.every(photo => selected.has(photo.id));
  const selectAll = () => setSelected(new Set(photos.map(photo => photo.id)));

  function stageFiles(files: FileList | null | File[]) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    queueRef.current?.addFiles(files);
  }

  async function commitPending(files: File[]) {
    if (!files.length) return;
    setUploading(files.length);
    setUploadError(null);
    setDragOver(false);
    try {
      const result = await uploadClientGalleryFiles(files, { galleryId: gallery.id, folderId: folder.id });
      if (!result.ok) setUploadError(result.message);
    } catch (uploadError) {
      setUploadError(uploadError instanceof Error && uploadError.message ? uploadError.message : "Upload failed. Please try again.");
    } finally {
      setUploading(0);
      setShowUpload(false);
      queueRef.current?.clear();
      router.refresh();
    }
  }

  function downloadSelected() {
    for (const photo of photos) {
      if (selected.has(photo.id) && photo.downloadUrl) {
        const a = document.createElement("a");
        a.href = photo.downloadUrl;
        a.rel = "noopener";
        a.target = "_blank";
        a.click();
      }
    }
  }

  const clientUrl = `/gallery/${gallery.slug}/${folder.slug}`;
  const moveTargetsList = moveTargets.filter(target => target.id !== folder.id);

  return (
    <section className="ws-wrap">
      <header className="ws-header">
        <Link className="back" href={`/admin/galleries/${gallery.id}`}>
          ← Galleries
        </Link>
        <div className="ws-title">
          <h1>{folder.name}</h1>
          <p className="muted">
            {gallery.title} · {photos.length} {photos.length === 1 ? "photo" : "photos"}
            {folder.description ? <> · {folder.description}</> : null}
          </p>
        </div>
        <div className="ws-header-actions">
          <form action={setFolderPublished}>
            <input name="id" type="hidden" value={folder.id} />
            <input name="published" type="hidden" value={folder.published ? "false" : "true"} />
            <button className={`set-pill admin-toggle${folder.published ? " is-published" : ""}`} type="submit">
              {folder.published ? <Eye size={13} strokeWidth={1.8} /> : <EyeOff size={13} strokeWidth={1.8} />}
              {folder.published ? "Published" : "Hidden"}
            </button>
          </form>
          <Link className="admin-button is-secondary" href={clientUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={15} strokeWidth={1.8} /> Open gallery
          </Link>
          <button className="admin-button" onClick={() => fileInput.current?.click()} type="button">
            <Upload size={15} strokeWidth={1.8} /> Upload
          </button>
        </div>
      </header>

      {showUpload && !uploading ? (
        <>
          <StagedUploadQueue
            onCommit={commitPending}
            onCountChange={setQueueCount}
            ref={queueRef}
            uploading={uploading > 0}
          />
          {!queueCount ? (
            <div
              className={`upload-zone${dragOver ? " is-dragging" : ""}`}
              onDragLeave={() => setDragOver(false)}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDrop={e => { e.preventDefault(); stageFiles(e.dataTransfer.files); }}
            >
              <button aria-label="Close" className="upload-close" onClick={() => setShowUpload(false)} type="button"><X size={16} /></button>
              <div className="upload-zone-icon"><ImageIcon size={26} strokeWidth={1.5} /></div>
              <strong>Drop photos here</strong>
              <span>or</span>
              <button className="admin-button" onClick={() => fileInput.current?.click()} type="button">Browse files</button>
              <em>JPEG, PNG, WebP or GIF.</em>
            </div>
          ) : null}
        </>
      ) : null}
      {uploading ? (
        <div className="upload-progress" role="status">
          <span className="upload-spinner" />
          Uploading {uploading} {uploading === 1 ? "photo" : "photos"}…
        </div>
      ) : null}
      {uploadError ? <p className="form-error" role="alert">{uploadError}</p> : null}

      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-hidden="true"
        className="visually-hidden-input"
        multiple
        onChange={e => stageFiles(e.target.files)}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />

      <div className="ws-toolbar" aria-live="polite">
        {none ? (
          <>
            {photos.length ? (
              <button className="admin-button is-secondary" onClick={selectAll} type="button">Select All</button>
            ) : null}
            <button className="admin-button is-secondary" onClick={() => fileInput.current?.click()} type="button">
              <Upload size={15} strokeWidth={1.8} /> Upload pictures
            </button>
            <Link className="admin-button is-secondary" href={clientUrl} rel="noreferrer" target="_blank">
              <ExternalLink size={15} strokeWidth={1.8} /> Open gallery
            </Link>
          </>
        ) : (
          <>
            <strong className="ws-selected-count">{selected.size} selected</strong>
            {allSelected ? (
              <button className="admin-button is-secondary" onClick={clear} type="button">Deselect All</button>
            ) : (
              <button className="admin-button is-secondary" onClick={selectAll} type="button">Select All</button>
            )}
            <form className="ws-move-form" action={movePhotos}>
              {[...selected].map(id => <input key={id} name="ids" type="hidden" value={id} />)}
              <input name="gallery_id" type="hidden" value={gallery.id} />
              <select aria-label="Move selected photos to" className="ws-move-select" defaultValue="" name="folder_id" required>
                <option disabled value="">Move to…</option>
                {moveTargetsList.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
              </select>
              <button className="admin-button is-secondary" type="submit">
                <ArrowRight size={15} strokeWidth={1.8} /> Move
              </button>
            </form>
            <button className="admin-button is-secondary" onClick={downloadSelected} type="button">
              <Download size={15} strokeWidth={1.8} /> Download
            </button>
            <ApplyWatermarkButton
              disabled={!watermarkEnabled}
              folderId={folder.id}
              galleryId={gallery.id}
              photoIds={[...selected]}
            />
            {singleId ? (
              <form action={setFolderCover}>
                <input name="id" type="hidden" value={folder.id} />
                <input name="cover_photo_id" type="hidden" value={singleId} />
                <button className="admin-button is-secondary" type="submit">
                  <ImageIcon size={15} strokeWidth={1.8} /> Highlight image
                </button>
              </form>
            ) : null}
            <button className="admin-button is-secondary is-danger" onClick={() => setConfirmDelete(true)} type="button">
              <Trash2 size={15} strokeWidth={1.8} /> Delete
            </button>
            <button aria-label="Clear selection" className="icon-button" onClick={clear} type="button">
              <X size={16} />
            </button>
          </>
        )}
      </div>

      {photos.length ? (
        <div className="ws-photo-grid">
          {photos.map(photo => (
            <label className={`ws-photo${selected.has(photo.id) ? " is-selected" : ""}`} key={photo.id}>
              {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" loading="lazy" src={photo.src} />
              <input checked={selected.has(photo.id)} onChange={() => toggle(photo.id)} type="checkbox" />
              <span className="ws-photo-check"><Check size={13} strokeWidth={3} /></span>
              <span className="ws-photo-title" title={photo.filename}>{photo.filename}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="ws-empty">
          <ImageIcon size={34} strokeWidth={1.2} />
          <h2>No photos yet</h2>
          <p className="muted">Drop a few photos here or click Upload to start this set.</p>
          <button className="admin-button" onClick={() => fileInput.current?.click()} type="button">
            <Upload size={15} strokeWidth={1.8} /> Upload photos
          </button>
        </div>
      )}

      {confirmDelete ? (
        <div className="ws-confirm">
          <p>
            Delete {selected.size} {selected.size === 1 ? "photo" : "photos"}?
            This will permanently remove {selected.size === 1 ? "this photo" : "these photos"} from this gallery.
          </p>
          <div>
            <button className="admin-button is-secondary" onClick={() => setConfirmDelete(false)} type="button">Cancel</button>
            <form action={deletePhotos} onSubmit={() => setConfirmDelete(false)}>
              {[...selected].map(id => <input key={id} name="ids" type="hidden" value={id} />)}
              <input name="gallery_id" type="hidden" value={gallery.id} />
              <input name="folder_id" type="hidden" value={folder.id} />
              <DeleteSelectedButton count={selected.size} />
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}