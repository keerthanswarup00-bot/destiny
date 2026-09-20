"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { deleteFolder, renameFolder } from "@/app/admin/crud-actions";
import { moveFolder, setFolderCover, setFolderPublished } from "@/app/admin/set-actions";

type RowPhoto = { id: string; filename: string; signedUrl: string | null; width: number | null; height: number | null };

export function FolderRow({
  folder,
  galleryId,
  photos,
}: {
  folder: { id: string; name: string; slug: string; parent_folder_id: string | null; published: boolean; cover_photo_id: string | null; description: string | null };
  galleryId: string;
  photos: RowPhoto[];
}) {
  const renameDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const setCoverDialog = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const cover = photos.find(photo => photo.id === folder.cover_photo_id) ?? photos[0] ?? null;
  const [selected, setSelected] = useState<string>(folder.cover_photo_id ?? photos[0]?.id ?? "");
  const workspaceUrl = `/admin/galleries/${galleryId}/${folder.id}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <article className="set-row">
      <Link className="set-row-cover" href={workspaceUrl} tabIndex={-1}>
        {cover?.signedUrl ? (
          // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" loading="lazy" src={cover.signedUrl} />
        ) : (
          <span className="set-row-cover-empty">
            <ImagePlus size={22} strokeWidth={1.5} />
          </span>
        )}
      </Link>
      <div className="set-row-main">
        <Link className="set-row-name" href={workspaceUrl}>
          {folder.name}
        </Link>
        <span className="set-row-meta">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
          <span className={`set-pill${folder.published ? " is-published" : ""}`}>
            {folder.published ? <Eye size={12} strokeWidth={1.8} /> : <EyeOff size={12} strokeWidth={1.8} />}
            {folder.published ? "Published" : "Hidden"}
          </span>
        </span>
      </div>
      <div className="set-row-actions">
        {menuOpen ? <button aria-label="Close menu" className="menu-backdrop" onClick={closeMenu} tabIndex={-1} type="button" /> : null}
        <div className="menu-wrap">
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Actions for ${folder.name}`}
            className="icon-button"
            onClick={() => setMenuOpen(open => !open)}
            type="button"
          >
            <MoreVertical size={17} strokeWidth={1.8} />
          </button>
          {menuOpen ? (
            <div className="menu" role="menu">
              <button onClick={() => { renameDialog.current?.showModal(); closeMenu(); }} role="menuitem" type="button">
                <Pencil size={14} strokeWidth={1.8} /> Edit set
              </button>
              <button onClick={() => { setCoverDialog.current?.showModal(); closeMenu(); }} role="menuitem" type="button">
                <ImagePlus size={14} strokeWidth={1.8} /> Set cover
              </button>
              <form action={setFolderPublished} onSubmit={closeMenu}>
                <input name="id" type="hidden" value={folder.id} />
                <input name="published" type="hidden" value={folder.published ? "false" : "true"} />
                <button role="menuitem" type="submit">
                  {folder.published ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
                  {folder.published ? "Hide set" : "Publish set"}
                </button>
              </form>
              <div className="menu-divider" />
              <form action={moveFolder} onSubmit={closeMenu}>
                <input name="id" type="hidden" value={folder.id} />
                <input name="gallery_id" type="hidden" value={galleryId} />
                <input name="direction" type="hidden" value="up" />
                <button role="menuitem" type="submit">
                  <ChevronUp size={14} strokeWidth={2} /> Move up
                </button>
              </form>
              <form action={moveFolder} onSubmit={closeMenu}>
                <input name="id" type="hidden" value={folder.id} />
                <input name="gallery_id" type="hidden" value={galleryId} />
                <input name="direction" type="hidden" value="down" />
                <button role="menuitem" type="submit">
                  <ChevronDown size={14} strokeWidth={2} /> Move down
                </button>
              </form>
              <div className="menu-divider" />
              <form action={deleteFolder} onSubmit={closeMenu}>
                <input name="id" type="hidden" value={folder.id} />
                <input name="gallery_id" type="hidden" value={galleryId} />
                <button className="is-danger" role="menuitem" type="submit">
                  <Trash2 size={14} strokeWidth={1.8} /> Delete
                </button>
              </form>
            </div>
          ) : null}
        </div>
        <Link aria-label={`Manage photos in ${folder.name}`} className="set-row-open icon-button" href={workspaceUrl}>
          <ArrowRight size={16} strokeWidth={1.8} />
        </Link>
      </div>

      <dialog className="admin-dialog" ref={setCoverDialog}>
        <form action={setFolderCover} onSubmit={() => setCoverDialog.current?.close()}>
          <h2>Set cover</h2>
          <p className="muted">Pick the photo shown on this Set&rsquo;s cover.</p>
          {!photos.length ? <p className="empty">No photos in this set yet. Upload photos first.</p> : (
            <div className="cover-picker-grid">
              {photos.map(photo => (
                <label className="cover-picker-option" key={photo.id}>
                  {photo.signedUrl ? (
                    // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" height={photo.height ?? undefined} loading="lazy" src={photo.signedUrl} width={photo.width ?? undefined} />
                  ) : null}
                  <input checked={selected === photo.id} name="cover_photo_id" onChange={e => { setSelected(e.target.value); }} type="radio" value={photo.id} />
                  <span>Cover</span>
                </label>
              ))}
            </div>
          )}
          <input name="id" type="hidden" value={folder.id} />
          <menu>
            <button onClick={() => setCoverDialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button" disabled={!photos.length} type="submit">Save cover</button>
          </menu>
        </form>
      </dialog>
      <dialog className="admin-dialog" ref={renameDialog}>
        <form action={renameFolder} onSubmit={() => renameDialog.current?.close()}>
          <h2>Edit set</h2>
          <input name="id" type="hidden" value={folder.id} />
          <input name="gallery_id" type="hidden" value={galleryId} />
          <label>Name<input autoFocus defaultValue={folder.name} maxLength={200} name="name" required /></label>
          <label>Description<textarea defaultValue={folder.description ?? ""} maxLength={400} name="description" rows={2} /></label>
          <menu>
            <button onClick={() => renameDialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button">Save</button>
          </menu>
        </form>
      </dialog>
      <dialog className="admin-dialog" ref={deleteDialog}>
        <form action={deleteFolder} onSubmit={() => deleteDialog.current?.close()}>
          <h2>Delete set</h2>
          <input name="id" type="hidden" value={folder.id} />
          <input name="gallery_id" type="hidden" value={galleryId} />
          <p className="empty">This permanently deletes the set and its photos. This cannot be undone.</p>
          <menu>
            <button onClick={() => deleteDialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button">Delete</button>
          </menu>
        </form>
      </dialog>
    </article>
  );
}