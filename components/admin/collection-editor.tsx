"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { CopyButton } from "@/components/admin/copy-button";
import {
  deleteFolder,
  deletePhotos,
  movePhotos,
  renameFolder,
} from "@/app/admin/crud-actions";
import {
  moveFolder,
  setFolderCover,
  setFolderPublished,
  setGalleryStatus,
} from "@/app/admin/set-actions";
import { uploadClientGalleryFiles } from "@/components/admin/client-gallery-upload";

function DeletePhotosButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button is-danger" disabled={pending} type="submit">{pending ? "Deleting…" : "Delete"}</button>;
}

type EditorFolder = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  published: boolean;
  coverPhotoId: string | null;
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
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string>(folders[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreMenuFor, setMoreMenuFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<EditorFolder | null>(null);
  const [coverFor, setCoverFor] = useState<EditorFolder | null>(null);
  const [deleteFor, setDeleteFor] = useState<EditorFolder | null>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLDialogElement>(null);
  const coverRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (renameFor && renameRef.current && !renameRef.current.open) renameRef.current.showModal();
    else if (!renameFor && renameRef.current?.open) renameRef.current.close();
  }, [renameFor]);
  useEffect(() => {
    if (coverFor && coverRef.current && !coverRef.current.open) coverRef.current.showModal();
    else if (!coverFor && coverRef.current?.open) coverRef.current.close();
  }, [coverFor]);
  useEffect(() => {
    if (deleteFor && deleteRef.current && !deleteRef.current.open) deleteRef.current.showModal();
    else if (!deleteFor && deleteRef.current?.open) deleteRef.current.close();
  }, [deleteFor]);

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

  const switchSet = (id: string) => {
    setActiveId(id);
    setSelected(new Set());
    setSearch("");
    setMoreMenuFor(null);
  };

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () => setSelected(new Set());

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !activeFolder) return;
    setUploading(files.length);
    setUploadError(null);
    setDragOver(false);
    try {
      const result = await uploadClientGalleryFiles(files, { galleryId: gallery.id, folderId: activeFolder.id });
      if (!result.ok) setUploadError(result.message);
    } catch (uploadError) {
      setUploadError(uploadError instanceof Error && uploadError.message ? uploadError.message : "Upload failed. Please try again.");
    } finally {
      setUploading(0);
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
              <span>{new Date(gallery.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
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
          <button className="admin-button ce-primary-upload" onClick={() => fileInput.current?.click()} type="button">
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
                          <button onClick={() => { setCoverFor(folder); setMoreMenuFor(null); }} role="menuitem" type="button">
                            <ImagePlus size={14} strokeWidth={1.8} /> Highlight image
                          </button>
                          {coversByFolder?.[folder.id] ? (
                            <form action={setFolderCover} onSubmit={() => setMoreMenuFor(null)}>
                              <input name="id" type="hidden" value={folder.id} />
                              <input name="cover_photo_id" type="hidden" value="" />
                              <button role="menuitem" type="submit">
                                <X size={14} strokeWidth={2} /> Remove highlight
                              </button>
                            </form>
                          ) : null}
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
                  Uploading {uploading} {uploading === 1 ? "photo" : "photos"}…
                </div>
              ) : null}
              {uploadError ? <p className="form-error" role="alert">{uploadError}</p> : null}
              {!uploading && dragOver ? (
                <div
                  className="upload-zone is-dragging"
                  onDragLeave={() => setDragOver(false)}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDrop={e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); }}
                >
                  <strong>Drop photos here to upload</strong>
                </div>
              ) : null}

              {photos.length ? (
                <>
                  <div className="ws-toolbar" aria-live="polite">
                    {none ? (
                      <>
                        {visible.length !== photos.length ? (
                          <span className="ce-filtered-hint">{visible.length} of {photos.length} shown</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <strong className="ws-selected-count">{selected.size} selected</strong>
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
                        {singleId ? (
                          <form action={setFolderCover} onSubmit={() => router.refresh()}>
                            <input name="id" type="hidden" value={activeFolder.id} />
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

                  {visible.length ? (
                    <div className="ws-photo-grid ce-photo-grid">
                      {visible.map(photo => (
                        <label className={`ws-photo${selected.has(photo.id) ? " is-selected" : ""}`} key={photo.id}>
                          {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" loading="lazy" src={photo.src} />
                          <input checked={selected.has(photo.id)} onChange={() => toggle(photo.id)} type="checkbox" />
                          <span className="ws-photo-check"><Check size={13} strokeWidth={3} /></span>
                        </label>
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
                onChange={e => uploadFiles(e.target.files)}
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
      {coverFor ? (
        <dialog className="admin-dialog" onCancel={() => setCoverFor(null)} ref={coverRef}>
          <form action={setFolderCover} onSubmit={() => { setCoverFor(null); router.refresh(); }}>
            <h2>Highlight image</h2>
            <p className="muted">Pick the photo shown on this Set&rsquo;s highlight.</p>
            {(photosByFolder[coverFor.id] ?? []).length ? (
              <div className="cover-picker-grid">
                {(photosByFolder[coverFor.id] ?? []).map(photo => (
                  <label className="cover-picker-option" key={photo.id}>
                    {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" height={photo.height ?? undefined} loading="lazy" src={photo.src} width={photo.width ?? undefined} />
                    <input defaultChecked={coverFor.coverPhotoId === photo.id} name="cover_photo_id" type="radio" value={photo.id} />
                    <span>Highlight</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="empty">No photos in this set yet.</p>
            )}
            <input name="id" type="hidden" value={coverFor.id} />
            <menu>
              <button onClick={() => setCoverFor(null)} type="button">Cancel</button>
              <button className="admin-button" disabled={!((photosByFolder[coverFor.id] ?? []).length)} type="submit">Save highlight</button>
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
          <p>Delete {selected.size} {selected.size === 1 ? "photo" : "photos"}? This can&apos;t be undone.</p>
          <div>
            <button className="admin-button is-secondary" onClick={() => setConfirmDelete(false)} type="button">Cancel</button>
            <form action={deletePhotos} onSubmit={() => setConfirmDelete(false)}>
              {[...selected].map(id => <input key={id} name="ids" type="hidden" value={id} />)}
              <input name="gallery_id" type="hidden" value={gallery.id} />
              {activeFolder ? <input name="folder_id" type="hidden" value={activeFolder.id} /> : null}
              <DeletePhotosButton />
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}