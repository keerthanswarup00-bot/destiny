"use client";

import { useState } from "react";
import { GalleryWorkspace, type WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

export type GallerySet = {
  id: string;
  name: string;
  slug: string;
  photos: WorkspacePhoto[];
};

export function GalleryOverview({
  slug,
  sets,
  selectedIds,
}: {
  slug: string;
  sets: GallerySet[];
  selectedIds: string[];
}) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(selectedIds));

  if (!sets.length) {
    return <p className="client-empty">There are no photos in this gallery yet.</p>;
  }

  return (
    <div className="client-gallery-content" id="client-gallery-grid">
      {sets.map(set => (
        <section className="client-set" key={set.id}>
          <h2 className="client-set-title">{set.name}</h2>
          <GalleryWorkspace
            folder={set.slug}
            photos={set.photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) }))}
            slug={slug}
            onFavoriteChange={(photoId, favorite) => setFavoriteIds(previous => {
              const next = new Set(previous);
              if (favorite) next.add(photoId);
              else next.delete(photoId);
              return next;
            })}
          />
        </section>
      ))}
    </div>
  );
}