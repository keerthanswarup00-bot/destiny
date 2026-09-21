"use client";

import { useMemo, useState } from "react";
import { GalleryWorkspace, type WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

type GallerySet = {
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
  const [activeSet, setActiveSet] = useState(sets[0]?.slug ?? "");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(selectedIds));
  const filteredSets = useMemo(() => {
    const originals = sets.filter(set => set.slug !== "fav");
    const allPhotos = originals.flatMap(set => set.photos);
    const favorites = allPhotos.filter((photo, index, all) => favoriteIds.has(photo.id) && all.findIndex(candidate => candidate.id === photo.id) === index);
    return [...originals, { id: "favourites", name: "Fav", slug: "fav", photos: favorites }];
  }, [favoriteIds, sets]);
  const current = filteredSets.find(set => set.slug === activeSet) ?? filteredSets[0] ?? null;
  const photos = current?.photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) })) ?? [];

  if (!sets.length) return <p className="client-empty">This gallery does not have any sets yet.</p>;

  return (
    <section className="client-gallery-content" id="client-gallery-grid">
      <nav aria-label="Sets" className="client-setnav">
        <span className="client-setnav-label">Sets</span>
        {filteredSets.map(set => (
          <button
            aria-pressed={set.slug === current?.slug}
            className={`client-setnav-link${set.slug === current?.slug ? " is-active" : ""}`}
            key={set.id}
            onClick={() => setActiveSet(set.slug)}
            type="button"
          >
            {set.name}
          </button>
        ))}
      </nav>
      {current ? (
        <>
          <div className="client-set-heading">
            <div>
              <h2>{current.name}</h2>
              <p>{photos.length} {photos.length === 1 ? "photo" : "photos"}</p>
            </div>
          </div>
          {photos.length ? (
            <GalleryWorkspace
              folder={current.slug}
              key={current.id}
              photos={photos}
              slug={slug}
              onFavoriteChange={(photoId, favorite) => setFavoriteIds(previous => {
                const next = new Set(previous);
                if (favorite) next.add(photoId);
                else next.delete(photoId);
                return next;
              })}
            />
          ) : (
            <p className="client-empty">No photos in this set yet.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
