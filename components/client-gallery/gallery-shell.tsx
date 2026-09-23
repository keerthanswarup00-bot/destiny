"use client";

import { useRef, useState } from "react";
import { Heart, MoreVertical } from "lucide-react";
import { GalleryOverview, type GalleryOverviewHandle, type GallerySet } from "@/components/client-gallery/gallery-overview";

export function GalleryShell({
  slug,
  title,
  brand,
  sets,
  selectedIds,
  identified,
  submitted,
}: {
  slug: string;
  title: string;
  brand: string;
  sets: GallerySet[];
  selectedIds: string[];
  identified: boolean;
  submitted: boolean;
}) {
  const [count, setCount] = useState(selectedIds.length);
  const overviewRef = useRef<GalleryOverviewHandle>(null);

  return (
    <>
      <header className="client-topbar">
        <h1 className="client-topbar-title">{title}</h1>
        <div className="client-topbar-actions">
          <button
            aria-label={count ? `Favourites, ${count} ${count === 1 ? "photo" : "photos"} selected` : "Favourites"}
            className={`client-topbar-action client-topbar-favorites${count > 0 ? " is-active" : ""}`}
            onClick={() => overviewRef.current?.openReview()}
            title={count ? `${count} ${count === 1 ? "favourite" : "favourites"}` : "Review favourites"}
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
        ref={overviewRef}
        selectedIds={selectedIds}
        sets={sets}
        slug={slug}
        submitted={submitted}
      />
    </>
  );
}