"use client";

import { useRef } from "react";
import { deleteWebsiteGalleryImage, updateWebsiteGalleryImageCategory } from "@/app/admin/website/actions";

export function WebsiteGalleryCard({
  id,
  filename,
  previewUrl,
  bytes,
  category,
  selected,
  onSelected,
}: {
  id: string;
  filename: string;
  previewUrl: string;
  bytes: number;
  category: string | null;
  selected: boolean;
  onSelected: () => void;
}) {
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const size = bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <article className="photo-card">
      {previewUrl ? (
        // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
        <a href={previewUrl} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={previewUrl} />
        </a>
      ) : <div className="photo-card-fallback">Preview unavailable</div>}
      <div className="photo-card-meta">
        <label className="website-gallery-select"><input checked={selected} onChange={onSelected} type="checkbox" /> Select</label>
        <strong>{filename}</strong>
        <span>{size} · on public gallery</span>
        <form action={updateWebsiteGalleryImageCategory} className="website-gallery-category-edit">
          <input name="id" type="hidden" value={id} />
          <label>
            <span className="visually-hidden">Category for {filename}</span>
            <select defaultValue={category ?? ""} name="category">
              <option value="">Uncategorized</option>
              <option value="wedding">Wedding</option>
              <option value="events">Events</option>
              <option value="portraits">Portraits</option>
              <option value="celebrations">Celebrations</option>
            </select>
          </label>
          <button type="submit">Save category</button>
        </form>
        <button onClick={() => deleteDialog.current?.showModal()} type="button">Delete</button>
      </div>
      <dialog className="admin-dialog" ref={deleteDialog}>
        <form action={deleteWebsiteGalleryImage}>
          <h2>Delete image</h2>
          <p>Remove &ldquo;{filename}&rdquo; from the website gallery? This cannot be undone.</p>
          <input name="id" type="hidden" value={id} />
          <menu>
            <button onClick={() => deleteDialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button">Delete</button>
          </menu>
        </form>
      </dialog>
    </article>
  );
}