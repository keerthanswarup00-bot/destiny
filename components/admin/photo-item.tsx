"use client";

import { useRef } from "react";
import { deletePhoto } from "@/app/admin/crud-actions";

export function PhotoItem({
  photo,
  galleryId,
  folderName,
}: {
  photo: { id: string; filename: string; bytes: number; previewUrl: string | null };
  galleryId: string;
  folderName: string;
}) {
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const size = photo.bytes >= 1024 * 1024 ? `${(photo.bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(photo.bytes / 1024))} KB`;

  return (
    <article className="photo-card">
      {photo.previewUrl ? (
        // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={photo.previewUrl} />
      ) : <div className="photo-card-fallback">Preview unavailable</div>}
      <div className="photo-card-meta">
        <strong>{photo.filename}</strong>
        <span>{folderName} · {size}</span>
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
            <button className="admin-button">Delete</button>
          </menu>
        </form>
      </dialog>
    </article>
  );
}
