"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Search, Trash2 } from "lucide-react";
import { deleteGallery } from "@/app/admin/crud-actions";

export type GalleryViewItem = {
  id: string;
  title: string;
  status: string;
  clientName: string | null;
  createdAt: string;
  setCount: number;
  photoCount: number;
  coverUrl: string | null;
  hasPassword: boolean;
};

export function GalleriesView({ items }: { items: GalleryViewItem[] }) {
  const [query, setQuery] = useState("");
  const [deleteItem, setDeleteItem] = useState<GalleryViewItem | null>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deleteItem && deleteRef.current && !deleteRef.current.open) deleteRef.current.showModal();
    else if (!deleteItem && deleteRef.current?.open) deleteRef.current.close();
  }, [deleteItem]);
  const filtered = useMemo(
    () => items.filter(item => `${item.title} ${item.clientName ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );
  return (
    <>
      <div className="galleries-toolbar">
        <div className="galleries-search">
          <Search size={16} strokeWidth={1.8} />
          <input aria-label="Search galleries" onChange={e => setQuery(e.target.value)} placeholder="Search galleries" value={query} />
        </div>
      </div>
      <div className="gallery-list">
        {filtered.map(gallery => (
          <article className="gallery-list-row" key={gallery.id}>
            <div className="gallery-list-main">
              <Link href={`/admin/galleries/${gallery.id}`}><strong>{gallery.title}</strong></Link>
              <span>{gallery.clientName || "No client"}</span>
            </div>
            <span className="gallery-list-detail">{gallery.photoCount} {gallery.photoCount === 1 ? "photo" : "photos"}</span>
            <span className="gallery-list-detail">{new Date(gallery.createdAt).toLocaleDateString()}</span>
            <span className={`status-pill ${gallery.status}`}>{gallery.status}</span>
            {gallery.hasPassword ? <Lock aria-label="Password protected" size={14} strokeWidth={1.8} /> : <span />}
            <div className="gallery-list-actions">
              <Link className="admin-button is-secondary" href={`/admin/galleries/${gallery.id}`}>Open Gallery</Link>
              <button aria-label={`Delete ${gallery.title}`} className="icon-button icon-danger" onClick={() => setDeleteItem(gallery)} type="button">
                <Trash2 size={16} strokeWidth={1.8} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length ? (
        <p className="empty">No galleries match your search. {query ? `Nothing found for “${query}”.` : ""}</p>
      ) : null}
      <dialog className="admin-dialog" onCancel={() => setDeleteItem(null)} ref={deleteRef}>
        <form action={deleteGallery}>
          <h2>Delete this gallery?</h2>
          <p>This will permanently remove this gallery and its photos. This cannot be undone.</p>
          <input name="id" type="hidden" value={deleteItem?.id ?? ""} />
          <menu>
            <button onClick={() => setDeleteItem(null)} type="button">Cancel</button>
            <button className="admin-button is-danger" type="submit">Delete Gallery</button>
          </menu>
        </form>
      </dialog>
    </>
  );
}