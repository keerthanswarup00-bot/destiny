"use client";

import { useMemo, useState } from "react";
import { GalleryWorkspace, type WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

export function GalleryOverview({
  slug,
  photos,
  selectedIds,
}: {
  slug: string;
  photos: WorkspacePhoto[];
  selectedIds: string[];
}) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(selectedIds));

  const displayed = useMemo(
    () => photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) })),
    [favoriteIds, photos],
  );

  if (!photos.length) {
    return <p className="client-empty">There are no photos in this gallery yet.</p>;
  }

  return (
    <section className="client-gallery-content" id="client-gallery-grid">
      <GalleryWorkspace
        photos={displayed}
        slug={slug}
        onFavoriteChange={(photoId, favorite) => setFavoriteIds(previous => {
          const next = new Set(previous);
          if (favorite) next.add(photoId);
          else next.delete(photoId);
          return next;
        })}
      />
    </section>
  );
}