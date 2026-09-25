"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatGalleryDate } from "@/lib/format-date";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  MoreVertical,
  Pencil,
  Search,
  Settings,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AddSetDialog } from "@/components/admin/add-set-dialog";
import { AdminPhotoPreview } from "@/components/admin/admin-photo-preview";
import { ApplyWatermarkButton } from "@/components/admin/apply-watermark-button";
import { CopyButton } from "@/components/admin/copy-button";
import { DeleteSelectedButton } from "@/components/admin/delete-selected-button";
import {
  deleteFolder,
  deletePhotos,
  movePhotos,
  renameFolder,
} from "@/app/admin/crud-actions";
import {
  moveFolder,
  setFolderPublished,
  setGalleryStatus,
  setFolderDownloadPassword,
} from "@/app/admin/set-actions";
import { uploadClientGalleryFiles, type GalleryUploadProgress } from "@/components/admin/client-gallery-upload";
import { StagedUploadQueue, type StagedUploadQueueHandle } from "@/components/admin/upload-queue";

type EditorFolder = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  published: boolean;
  coverPhotoId: string | null;
  hasDownloadPassword: boolean;
  downloadPassword: string | null;
};

type EditorPhoto = {
  id: string;
  filename: string;
  width: number | null;
  height: number | null;
  src: string;
  downloadUrl: string;
};

export function CollectionEditor({
  gallery,
  folders,
  photosByFolder,
  coverUrl,
  coversByFolder,
  shareUrl,
  error,
  watermarkEnabled,
}: {
  gallery: {
    id: string;
    title: string;
    slug: string;
    status: string;
    description: string | null;
    createdAt: string;
    clientName: string | null;
    clientId: string | null;
    passwordProtected: boolean;
  };
  folders: EditorFolder[];
  photosByFolder: Record<string, EditorPhoto[]>;
  coverUrl: string | null;
  coversByFolder?: Record<string, string | null>;
  shareUrl: string;
  error?: string | null;
  watermarkEnabled: boolean;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string>(folders[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const selectionModifierRef = useRef({ shiftKey: false, additive: false });
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreMenuFor, setMoreMenuFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<EditorFolder | null>(null);
  const [deleteFor, setDeleteFor] = useState<EditorFolder | null>(null);
  const [downloadPasswordFor, setDownloadPasswordFor] = useState<EditorFolder | null>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const fileInput = useRef<HTMLInputElement>(null);
  const queueRef = useRef<StagedUploadQueueHandle>(null);
  const renameRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const downloadPasswordRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (renameFor && renameRef.current && !renameRef.current.open) renameRef.current.showModal();
    else if (!renameFor && renameRef.current?.open) renameRef.current.close();
  }, [renameFor]);
  useEffect(() => {
    if (deleteFor && deleteRef.current && !deleteRef.current.open) deleteRef.current.showModal();
    else if (!deleteFor && deleteRef.current?.open) deleteRef.current.close();
  }, [deleteFor]);
  useEffect(() => {
    if (downloadPasswordFor && downloadPasswordRef.current && !downloadPasswordRef.current.open) downloadPasswordRef.current.showModal();
    else if (!downloadPasswordFor && downloadPasswordRef.current?.open) downloadPasswordRef.current.close();
  }, [downloadPasswordFor]);

  const activeFolder = folders.find(folder => folder.id === activeId) ?? folders[0] ?? null;
  const isPublished = gallery.status === "published";
  const photos = useMemo(
    () => (activeFolder ? photosByFolder[activeFolder.id] ?? [] : []),
    [activeFolder, photosByFolder]
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? photos.filter(photo => photo.filename.toLowerCase().includes(term)) : photos;
  }, [photos, search]);
  const none = selected.size === 0;
  const single = selected.size === 1;
  const singleId = single ? [...selected][0] : null;
  const allVisibleSelected = visible.length > 0 && visible.every(photo => selected.has(photo.id));
  const setAnchor = (id: string | null) => {
    selectionAnchorRef.current = id;
    setSelectionAnchor(id);
  };

  const selectAllVisible = () => {
    setSelected(new Set(visible.map(photo => photo.id)));
    setAnchor(null);
  };
  const deselectAllVisible = () => {
    const ids = new Set(visible.map(photo => photo.id));
    setSelected(prev => new Set([...prev].filter(id => !ids.has(id))));
    setAnchor(null);
  };

  const switchSet = (id: string) => {
    setActiveId(id);
    setSelected(new Set());
    setAnchor(null);
    setSearch("");
    setMoreMenuFor(null);
  };

  const toggle = (id: string, shiftKey = false, additive = false) => {
    const clickedIndex = visible.findIndex(photo => photo.id === id);
    const anchorId = selectionAnchorRef.current;

    if (shiftKey && anchorId && clickedIndex >= 0) {
      const anchorIndex = visible.findIndex(photo => photo.id === anchorId);

      if (anchorIndex >= 0) {
        const start = Math.min(anchorIndex, clickedIndex);
        const end = Math.max(anchorIndex, clickedIndex);
        const rangeIds = visible.slice(start, end + 1).map(photo => photo.id);

        setSelected(prev => {
          if (!additive) return new Set(rangeIds);
          const next = new Set(prev);
          for (const rangeId of rangeIds) next.add(rangeId);
          return next;
        });

        // Shift-click extends from the original anchor.
        // Keep the anchor unchanged so repeated Shift-clicks behave like
        // desktop photo managers such as Apple Photos and Google Photos.
        return;
      }
    }

    setSelected(prev => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    setAnchor(id);
  };

  const clear = () => {
    setSelected(new Set());
    setAnchor(null);
  };

  function stageFiles(files: FileList | null | File[]) {
    if (!files || files.length === 0 || !activeFolder || uploading > 0) return;
    setUploadError(null);
    queueRef.current?.addFiles(files);
  }

  async function commitPending(files: File[], onProgress: (event: GalleryUploadProgress) => void) {
    if (!files.length || !activeFolder) return { ok: false };
    setUploading(files.length);
    setUploadError(null);
    try {
      const result = await uploadClientGalleryFiles(
        files,
        { galleryId: gallery.id, folderId: activeFolder.id },
        onProgress,
      );
      if (!result.ok) setUploadError(result.message);
      if (result.ok) router.refresh();
      return { ok: result.ok };
    } catch (uploadError) {
      const message = uploadError instanceof Error && uploadError.message ? uploadError.message : "Upload failed. Please try again.";
      setUploadError(message);
      return { ok: false };
    } finally {
      setUploading(0);
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

  const nextTargets = folders.filter(folder => folder.id !== activeFolder?.id);
  const clientUrl = shareUrl;

  return (
    <section className="collection-editor">
      <header className="ce-toolbar">
        <div className="ce-title">
          <Link aria-label="Back to Client Galleries" className="ce-back icon-button" href="/admin/galleries">
            <ArrowLeft size={18} strokeWidth={1.8} />
          </Link>
          <div>
            <h1>{gallery.title}</h1>
            <p className="ce-meta">
              {isPublished ? (
                <span className="status-pill published">Published</span>
              ) : (
                <span className="status-pill draft">{gallery.status === "archived" ? "Archived" : "Draft"}</span>
              )}
              {gallery.clientName ? (
                <>
                  <span aria-hidden="true">·</span>
                  {gallery.clientId ? (
                    <a href={`/admin/clients/${gallery.clientId}`}>{gallery.clientName}</a>
                  ) : (
                    <span>{gallery.clientName}</span>
                  )}
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <span>{formatGalleryDate(gallery.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="ce-toolbar-actions">
          <div className="ce-search">
            <Search size={15} strokeWidth={1.8} />
            <input aria-label="Search photos" onChange={e => setSearch(e.target.value)} placeholder="Search photos" value={search} />
          </div>
          <div className="ce-more-wrap">
            {toolbarMenuOpen ? <button aria-label="Close menu" className="menu-backdrop" onClick={() => setToolbarMenuOpen(false)} tabIndex={-1} type="button" /> : null}
            <button aria-expanded={toolbarMenuOpen} aria-haspopup="menu" aria-label="More collection actions" className="icon-button" onClick={() => setToolbarMenuOpen(open => !open)} type="button">
              <MoreVertical size={17} strokeWidth={1.8} />
            </button>
            {toolbarMenuOpen ? (
              <div className="menu ce-more-menu" role="menu">
                <a href="#gallery-settings" onClick={() => setToolbarMenuOpen(false)} role="menuitem"><Settings size={14} strokeWidth={1.8} /> Gallery settings</a>
              </div>
            ) : null}
          </div>
          <button className="admin-button ce-primary-upload" disabled={uploading > 0} onClick={() => fileInput.current?.click()} type="button">
            <Upload size={15} strokeWidth={1.8} /> Upload Photos
          </button>
          <CopyButton label="Share" text={shareUrl} />
          {isPublished ? (
            <Link aria-label="Preview the client gallery" className="admin-button is-secondary" href={shareUrl} rel="noreferrer" target="_blank">
              <ExternalLink size={15} strokeWidth={1.8} /> Preview
            </Link>
          ) : (
            <span className="admin-button is-secondary is-static" title="Publish the collection to preview it">
              <ExternalLink size={15} strokeWidth={1.8} /> Preview
            </span>
          )}
          <form action={setGalleryStatus} className="ce-status-form">
            <input name="id" type="hidden" value={gallery.id} />
            <input name="status" type="hidden" value={isPublished ? "draft" : "published"} />
            <button className="admin-button is-secondary" type="submit">
              {isPublished ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
              {isPublished ? " Unpublish" : " Publish"}
            </button>
          </form>
        </div>
      </header>

      <div className="ce-body">
        <aside className="ce-setbar">
          <div className="ce-cover">
            {(() => {
              const cover = coversByFolder?.[activeFolder?.id ?? ""] ?? coverUrl ?? null;
              return cover ? (
                // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={cover} />
              ) : (
                <span className="ce-cover-empty"><ImagePlus size={22} strokeWidth={1.4} /></span>
              );
            })()}
          </div>
          <nav aria-label="Collection sections" className="ce-iconnav">
            <span className="active" title="Photos"><ImageIcon size={16} strokeWidth={1.8} /><span>Photos</span></span>
            <a href="#gallery-settings" title="Collection settings"><Settings size={16} strokeWidth={1.8} /><span>Settings</span></a>
            <a href="#settings-sharing" title="Share"><Share2 size={16} strokeWidth={1.8} /><span>Share</span></a>
          </nav>
          <div className="ce-setlist-head">
            <span>Sets</span>
            <AddSetDialog galleryId={gallery.id} />
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {folders.length ? (
            <ul className="ce-setlist">
              {folders.map(folder => {
                const active = folder.id === activeFolder?.id;
                const count = photosByFolder[folder.id]?.length ?? 0;
                const coverThumb = coversByFolder?.[folder.id] ?? null;
                return (
                  <li className={active ? "is-active" : undefined} key={folder.id}>
                    {moreMenuFor === folder.id ? <button aria-label="Close menu" className="menu-backdrop" onClick={() => setMoreMenuFor(null)} tabIndex={-1} type="button" /> : null}
                    <span aria-hidden="true" className="ce-set-grip"><GripVertical size={13} strokeWidth={1.4} /></span>
                    <span aria-hidden="true" className="ce-set-thumb">
                      {coverThumb ? (
                        // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={coverThumb} />
                      ) : (
                        <ImagePlus size={14} strokeWidth={1.4} />
                      )}
                    </span>
                    <button
                      aria-current={active ? "page" : undefined}
                      className="ce-set-name"
                      onClick={() => switchSet(folder.id)}
                      type="button"
                    >
                      <span>{folder.name}</span>
                      <em>{count}</em>
                    </button>
                    <span className="ce-set-menu">
                      <button
                        aria-expanded={moreMenuFor === folder.id}
                        aria-haspopup="menu"
                        aria-label={`Actions for set ${folder.name}`}
                        className="icon-button"
                        onClick={() => setMoreMenuFor(open => (open === folder.id ? null : folder.id))}
                        type="button"
                      >
                        <MoreVertical size={15} strokeWidth={1.8} />
                      </button>
                      {moreMenuFor === folder.id ? (
                        <div className="menu" role="menu">
                          <button onClick={() => { setRenameFor(folder); setMoreMenuFor(null); }} role="menuitem" type="button">
                            <Pencil size={14} strokeWidth={1.8} /> Rename
                          </button>
                          <button onClick={() => { setDownloadPasswordFor(folder); setMoreMenuFor(null); }} role="menuitem" type="button">
                            <Download size={14} strokeWidth={1.8} /> Download PIN
                          </button>
                          <form action={setFolderPublished}>
                            <input name="id" type="hidden" value={folder.id} />
                            <input name="published" type="hidden" value={folder.published ? "false" : "true"} />
                            <button onClick={() => setMoreMenuFor(null)} role="menuitem" type="submit">
                              {folder.published ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
                              {folder.published ? "Hide from clients" : "Show to clients"}
                            </button>
                          </form>
                          <div className="menu-divider" />
                          <form action={moveFolder}>
                            <input name="id" type="hidden" value={folder.id} />
                            <input name="gallery_id" type="hidden" value={gallery.id} />
                            <input name="direction" type="hidden" value="up" />
                            <button onClick={() => setMoreMenuFor(null)} role="menuitem" type="submit">
                              <ChevronUp size={14} strokeWidth={2} /> Move up
                            </button>
                          </form>
                          <form action={moveFolder}>
                            <input name="id" type="hidden" value={folder.id} />
                            <input name="gallery_id" type="hidden" value={gallery.id} />
                            <input name="direction" type="hidden" value="down" />
                            <button onClick={() => setMoreMenuFor(null)} role="menuitem" type="submit">
                              <ChevronDown size={14} strokeWidth={2} /> Move down
                            </button>
                          </form>
                          <div className="menu-divider" />
                          <button className="is-danger" onClick={() => { setDeleteFor(folder); setMoreMenuFor(null); }} role="menuitem" type="button">
                            <Trash2 size={14} strokeWidth={1.8} /> Delete
                          </button>
                        </div>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">No photo set yet. Create the gallery again or add a set to begin uploading.</p>
          )}
        </aside>

        <div className="ce-workspace">
          {activeFolder ? (
            <>
              <div className="ce-workspace-head">
                <div>
                  <h2>{activeFolder.name}</h2>
                  <p className="ce-set-meta">
                    {photos.length} {photos.length === 1 ? "photo" : "photos"}
                    {activeFolder.description ? <> · {activeFolder.description}</> : null}
                  </p>
                </div>
                <div className="ce-workspace-actions">
                  <Link className="admin-button is-secondary" href={clientUrl} rel="noreferrer" target="_blank">
                    <ExternalLink size={15} strokeWidth={1.8} /> Open client view
                  </Link>
                </div>
              </div>

              {uploading ? (
                <div className="upload-progress" role="status">
                  <span className="upload-spinner" />
                  Uploading and processing {uploading} {uploading === 1 ? "photo" : "photos"}…
                </div>
              ) : null}
              {uploadError ? <p className="form-error" role="alert">{uploadError}</p> : null}
              <StagedUploadQueue
                onBrowse={() => fileInput.current?.click()}
                onCommit={commitPending}
                onError={setUploadError}
                ref={queueRef}
                uploading={uploading > 0}
              />

              {photos.length ? (
                <>
                  {none ? (
                    <div className="ws-toolbar" aria-live="polite">
                      {visible.length ? (
                        <button className="admin-button is-secondary" onClick={selectAllVisible} type="button">Select All</button>
                      ) : null}
                      {visible.length !== photos.length ? (
                        <span className="ce-filtered-hint">{visible.length} of {photos.length} shown</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="ws-selection-toolbar" aria-live="polite">
                      <div className="ws-selection-summary">
                        <strong>{selected.size}</strong>
                        <span>{selected.size === 1 ? "photo selected" : "photos selected"}</span>
                      </div>
                      <div className="ws-selection-actions">
                        {allVisibleSelected ? (
                          <button className="admin-button is-secondary" onClick={deselectAllVisible} type="button">Deselect All</button>
                        ) : (
                          <button className="admin-button is-secondary" onClick={selectAllVisible} type="button">Select All</button>
                        )}
                        {nextTargets.length ? (
                          <form className="ws-move-form" action={movePhotos}>
                            {[...selected].map(id => <input key={id} name="ids" type="hidden" value={id} />)}
                            <input name="gallery_id" type="hidden" value={gallery.id} />
                            <select aria-label="Move selected photos to" className="ws-move-select" defaultValue="" name="folder_id" required>
                              <option disabled value="">Add to set…</option>
                              {nextTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
                            </select>
                            <button className="admin-button is-secondary" type="submit">
                              <ArrowRight size={15} strokeWidth={1.8} /> Add to set
                            </button>
                          </form>
                        ) : null}
                        <button className="admin-button is-secondary" onClick={downloadSelected} type="button">
                          <Download size={15} strokeWidth={1.8} /> Download
                        </button>
                        <ApplyWatermarkButton
                          disabled={!watermarkEnabled}
                          folderId={activeFolder.id}
                          galleryId={gallery.id}
                          photoIds={[...selected]}
                        />
                        <button className="admin-button is-secondary is-danger" onClick={() => setConfirmDelete(true)} type="button">
                          <Trash2 size={15} strokeWidth={1.8} /> Delete
                        </button>
                        <button aria-label="Clear selection" className="icon-button" onClick={clear} type="button">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {visible.length ? (
                    <div className="ws-photo-grid ce-photo-grid">
                      {visible.map(photo => (
                        <div className={`ws-photo${selected.has(photo.id) ? " is-selected" : ""}`} key={photo.id}>
                          <button
                            aria-label={`Preview ${photo.filename}`}
                            className="ws-photo-preview"
                            onClick={() => setPreviewIndex(visible.findIndex(item => item.id === photo.id))}
                            type="button"
                          >
                            {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={photo.filename} loading="lazy" src={photo.src} />
                          </button>
                          <button
                            aria-label={selected.has(photo.id) ? `Deselect ${photo.filename}` : `Select ${photo.filename}`}
                            aria-pressed={selected.has(photo.id)}
                            className="ws-photo-select"
                            onClick={event => toggle(photo.id, event.shiftKey, event.metaKey || event.ctrlKey)}
                            type="button"
                          >
                            <span className="ws-photo-check" aria-hidden="true">
                              {selected.has(photo.id) ? <Check size={13} strokeWidth={3} /> : null}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty">No photos match your search.</p>
                  )}
                </>
              ) : (
                <div className="upload-zone ce-empty">
                  <div className="upload-zone-icon"><ImageIcon size={26} strokeWidth={1.4} /></div>
                  <strong>Your gallery is ready.</strong>
                  <span>Upload your first photos to get started.</span>
                  <span>Use the Upload Photos action above to add images.</span>
                  <em>JPEG, PNG, WebP or GIF.</em>
                </div>
              )}

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
            </>
          ) : (
            <div className="ws-empty ce-empty">
              <FolderOpen size={34} strokeWidth={1.2} />
              <h2>Create a set to start uploading</h2>
              <p className="muted">Sets group your photos — Highlights, Wedding, Party.</p>
              <AddSetDialog galleryId={gallery.id} highlighted />
            </div>
          )}
        </div>
      </div>

      {previewIndex >= 0 ? (
        <AdminPhotoPreview
          index={previewIndex}
          onChange={setPreviewIndex}
          onClose={() => setPreviewIndex(-1)}
          photos={visible}
        />
      ) : null}
      {renameFor ? (
        <dialog className="admin-dialog" onCancel={() => setRenameFor(null)} ref={renameRef}>
          <form action={renameFolder} onSubmit={() => setRenameFor(null)}>
            <h2>Rename set</h2>
            <input name="id" type="hidden" value={renameFor.id} />
            <input name="gallery_id" type="hidden" value={gallery.id} />
            <label>Name<input autoFocus defaultValue={renameFor.name} maxLength={200} name="name" required /></label>
            <label>Description<textarea defaultValue={renameFor.description ?? ""} maxLength={400} name="description" rows={2} /></label>
            <menu>
              <button onClick={() => setRenameFor(null)} type="button">Cancel</button>
              <button className="admin-button">Save</button>
            </menu>
          </form>
        </dialog>
      ) : null}
      {downloadPasswordFor ? (
        <dialog className="admin-dialog ce-download-pin-dialog" onCancel={() => setDownloadPasswordFor(null)} ref={downloadPasswordRef}>
          <form action={setFolderDownloadPassword} onSubmit={() => { setDownloadPasswordFor(null); router.refresh(); }}>
            <div className="ce-dialog-heading">
              <div>
                <h2>{downloadPasswordFor.hasDownloadPassword ? "Download PIN" : "Set download PIN"}</h2>
                <p className="muted">Protect this set&apos;s ZIP download with a separate PIN. The gallery access password is not used here.</p>
              </div>
            </div>

            {downloadPasswordFor.downloadPassword ? (
              <div className="ce-pin-reveal">
                <div className="ce-pin-reveal-head">
                  <span>Current PIN</span>
                  <span className="ce-pin-status">PIN set</span>
                </div>
                <div className="ce-pin-value">
                  <code>{downloadPasswordFor.downloadPassword}</code>
                  <CopyButton label="Copy PIN" text={downloadPasswordFor.downloadPassword} />
                </div>
                <small>Share this PIN with the client when they need to download the complete set.</small>
              </div>
            ) : (
              <div className="ce-pin-empty">
                <span>Download protection</span>
                <strong>No PIN set</strong>
                <small>Clients cannot download the complete set until a PIN is configured.</small>
              </div>
            )}

            <input name="id" type="hidden" value={downloadPasswordFor.id} />
            <input name="gallery_id" type="hidden" value={gallery.id} />

            <label className="ce-pin-input">
              <span>{downloadPasswordFor.hasDownloadPassword ? "Change PIN" : "Create PIN"}</span>
              <input autoFocus minLength={6} name="download_password" placeholder="Enter a 6+ character PIN" type="password" />
            </label>

            {downloadPasswordFor.hasDownloadPassword ? (
              <label className="admin-checkbox ce-pin-remove">
                <input name="clear_download_password" type="checkbox" />
                <span>
                  <strong>Remove download PIN</strong>
                  <small>Clients will no longer need a PIN to download this set.</small>
                </span>
              </label>
            ) : null}

            <menu>
              <button onClick={() => setDownloadPasswordFor(null)} type="button">Cancel</button>
              <button className="admin-button" type="submit">{downloadPasswordFor.hasDownloadPassword ? "Save changes" : "Set PIN"}</button>
            </menu>
          </form>
        </dialog>
      ) : null}
      {deleteFor ? (
        <dialog className="admin-dialog" onCancel={() => setDeleteFor(null)} ref={deleteRef}>
          <form action={deleteFolder} onSubmit={() => setDeleteFor(null)}>
            <h2>Delete set</h2>
            <input name="id" type="hidden" value={deleteFor.id} />
            <input name="gallery_id" type="hidden" value={gallery.id} />
            <p className="empty">This permanently deletes the set and its photos. This cannot be undone.</p>
            <menu>
              <button onClick={() => setDeleteFor(null)} type="button">Cancel</button>
              <button className="admin-button">Delete</button>
            </menu>
          </form>
        </dialog>
      ) : null}
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
              {activeFolder ? <input name="folder_id" type="hidden" value={activeFolder.id} /> : null}
              <DeleteSelectedButton count={selected.size} />
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}