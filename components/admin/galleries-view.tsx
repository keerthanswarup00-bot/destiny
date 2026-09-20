"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Lock, Rows3, Search } from "lucide-react";

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
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    try {
      return localStorage.getItem("galleries-view") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const filtered = useMemo(
    () => items.filter(item => `${item.title} ${item.clientName ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );
  const toggleView = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("galleries-view", v);
    } catch {
      /* noop */
    }
  };
  return (
    <>
      <div className="galleries-toolbar">
        <div className="galleries-search">
          <Search size={16} strokeWidth={1.8} />
          <input aria-label="Search galleries" onChange={e => setQuery(e.target.value)} placeholder="Search galleries" value={query} />
        </div>
        <div aria-label="View" className="galleries-view-toggle" role="group">
          <button aria-label="Grid view" aria-pressed={view === "grid"} className={view === "grid" ? "active" : undefined} onClick={() => toggleView("grid")}>
            <LayoutGrid size={16} strokeWidth={1.8} />
          </button>
          <button aria-label="List view" aria-pressed={view === "list"} className={view === "list" ? "active" : undefined} onClick={() => toggleView("list")}>
            <Rows3 size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className={view === "grid" ? "gallery-card-grid" : "gallery-card-grid is-list"}>
        {filtered.map(gallery => (
          <article className={view === "list" ? "gallery-card is-list" : "gallery-card"} key={gallery.id}>
            <Link aria-label={gallery.title} className="gallery-card-cover" href={`/admin/galleries/${gallery.id}`}>
              {gallery.coverUrl ? (
                // Signed admin-only URL; next/image is a poor fit for short-lived tokens.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={gallery.coverUrl} />
              ) : (
                <span className="gallery-card-cover-empty">No cover yet</span>
              )}
            </Link>
            <div className="gallery-card-body">
              <div className="gallery-card-head">
                <Link href={`/admin/galleries/${gallery.id}`}>
                  <h3>{gallery.title}</h3>
                </Link>
                <span className={`status-pill ${gallery.status}`}>{gallery.status}</span>
              </div>
              <div className="gallery-card-meta">
                <span>{gallery.clientName || "—"}</span>
                <span>{new Date(gallery.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="gallery-card-foot">
                <span>
                  {gallery.setCount} {gallery.setCount === 1 ? "set" : "sets"} · {gallery.photoCount}{" "}
                  {gallery.photoCount === 1 ? "photo" : "photos"}
                </span>
                {gallery.hasPassword ? <Lock aria-label="Password protected" size={13} strokeWidth={1.8} /> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length ? (
        <p className="empty">No galleries match your search. {query ? `Nothing found for “${query}”.` : ""}</p>
      ) : null}
    </>
  );
}