"use client";

import { useState } from "react";
import { Heart, MoreVertical } from "lucide-react";
import { GalleryOverview, type GallerySet } from "@/components/client-gallery/gallery-overview";

export function GalleryShell({
  slug,
  title,
  brand,
  sets,
  selectedIds,
  identified,
}: {
  slug: string;
  title: string;
  brand: string;
  sets: GallerySet[];
  selectedIds: string[];
  identified: boolean;
}) {
  const [count, setCount] = useState(selectedIds.length);

  return (
    <>
      <header className="client-topbar">
        <h1 className="client-topbar-title">{title}</h1>
        <div className="client-topbar-actions">
          <button
            aria-label={count ? `Favourites, ${count} ${count === 1 ? "photo" : "photos"} selected` : "Favourites"}
            className={`client-topbar-action client-topbar-favorites${count > 0 ? " is-active" : ""}`}
            title={count ? `${count} ${count === 1 ? "favourite" : "favourites"}` : "Favourites"}
            type="button"
          >
            <Heart size={20} strokeWidth={1.6} />
            {count > 0 ? <span className="client-topbar-count">{count}</span> : null}
          </button>
          <button aria-label="More options" className="client-topbar-action" title="More options" type="button">
            <MoreVertical size={20} strokeWidth={1.6} />
          </button>
        </div>
        <p className="client-topbar-brand">{brand}</p>
      </header>
      <GalleryOverview
        identified={identified}
        onCountChange={setCount}
        selectedIds={selectedIds}
        sets={sets}
        slug={slug}
      />
    </>
  );
}