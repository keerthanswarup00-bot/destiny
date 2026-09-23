"use client";

import { useEffect, useMemo, useState } from "react";
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
  identified,
  onCountChange,
}: {
  slug: string;
  sets: GallerySet[];
  selectedIds: string[];
  identified: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(selectedIds));
  const [identifiedState, setIdentifiedState] = useState(identified);

  useEffect(() => {
    onCountChange?.(favoriteIds.size);
  }, [favoriteIds, onCountChange]);

  // Only sets that actually contain photos are reachable; empty published sets
  // are omitted so navigation never points at an empty grid.
  const visibleSets = useMemo(() => sets.filter(set => set.photos.length > 0), [sets]);

  // Default to a "Highlights" set when one exists, otherwise the first set.
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (!visibleSets.length) return null;
    return visibleSets.find(set => set.name.toLowerCase() === "highlights")?.id ?? visibleSets[0].id;
  });

  const active = useMemo(() => visibleSets.find(set => set.id === activeId) ?? null, [visibleSets, activeId]);

  if (!visibleSets.length) {
    return <p className="client-empty">There are no photos in this gallery yet.</p>;
  }

  return (
    <section className="client-gallery-content" id="client-gallery-grid">
      <nav aria-label="Gallery sets" className="client-set-nav">
        {visibleSets.map(set => (
          <button
            aria-current={set.id === activeId ? "true" : undefined}
            className={`client-set-tab${set.id === activeId ? " is-active" : ""}`}
            key={set.id}
            onClick={() => setActiveId(set.id)}
            type="button"
          >
            {set.name}
          </button>
        ))}
      </nav>
      {active ? (
        <GalleryWorkspace
          folder={active.slug}
          identified={identifiedState}
          onFavoriteChange={(photoId, favorite) => setFavoriteIds(previous => {
            const next = new Set(previous);
            if (favorite) next.add(photoId);
            else next.delete(photoId);
            return next;
          })}
          onIdentified={() => setIdentifiedState(true)}
          photos={active.photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) }))}
          slug={slug}
        />
      ) : null}
    </section>
  );
}