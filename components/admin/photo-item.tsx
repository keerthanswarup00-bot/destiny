"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { deletePhoto, movePhotoToFolder } from "@/app/admin/crud-actions";

function DeletePhotoButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button is-danger" disabled={pending} type="submit">{pending ? "Deleting…" : "Delete"}</button>;
}

export function PhotoItem({
  photo,
  galleryId,
  folderName,
  folderId,
  folders,
}: {
  photo: { id: string; filename: string; bytes: number; previewUrl: string | null };
  galleryId: string;
  folderName: string;
  folderId: string;
  folders: { id: string; name: string }[];
}) {
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const size = photo.bytes >= 1024 * 1024 ? `${(photo.bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(photo.bytes / 1024))} KB`;

  return (
    <article className="photo-card">
      {photo.previewUrl ? (
        // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
        <a href={photo.previewUrl} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={photo.previewUrl} />
        </a>
      ) : <div className="photo-card-fallback">Preview unavailable</div>}
      <div className="photo-card-meta">
        <strong>{photo.filename}</strong>
        <span>{folderName} · {size}</span>
        <form action={movePhotoToFolder} className="photo-move-form">
          <input name="id" type="hidden" value={photo.id} />
          <input name="gallery_id" type="hidden" value={galleryId} />
          <select aria-label="Move photo to set" defaultValue={folderId} name="folder_id">
            {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <button aria-label={`Move ${photo.filename} to chosen set`} type="submit">Move</button>
        </form>
        <button onClick={() => deleteDialog.current?.showModal()} type="button">Delete</button>
      </div>
      <dialog className="admin-dialog" ref={deleteDialog}>
        <form action={deletePhoto}>
          <h2>Delete photo</h2>
          <p>Delete &ldquo;{photo.filename}&rdquo; from storage? This cannot be undone.</p>
          <input name="id" type="hidden" value={photo.id} />
          <input name="gallery_id" type="hidden" value={galleryId} />
          <menu>
            <button onClick={() => deleteDialog.current?.close()} type="button">Cancel</button>
            <DeletePhotoButton />
          </menu>
        </form>
      </dialog>
    </article>
  );
}