"use client";

import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
import { clearPhotoSelection, togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { GalleryWorkspace, type WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";
import { SelectionBar } from "@/components/client-gallery/selection-bar";
import { SelectionReview } from "@/components/client-gallery/selection-review";

export type GallerySet = {
  id: string;
  name: string;
  slug: string;
  photos: WorkspacePhoto[];
};

export type GalleryOverviewHandle = {
  openReview: () => void;
};

export function GalleryOverview({
  slug,
  sets,
  selectedIds,
  identified,
  submitted,
  onCountChange,
  ref,
}: {
  slug: string;
  sets: GallerySet[];
  selectedIds: string[];
  identified: boolean;
  submitted: boolean;
  onCountChange?: (count: number) => void;
  ref?: Ref<GalleryOverviewHandle>;
}) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(selectedIds));
  const [identifiedState, setIdentifiedState] = useState(identified);
  const [submittedState, setSubmittedState] = useState(submitted);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCountChange?.(favoriteIds.size);
  }, [favoriteIds, onCountChange]);

  useImperativeHandle(ref, () => ({ openReview: () => setReviewOpen(true) }), []);

  // Only sets that actually contain photos are rendered; empty published sets
  // never produce empty grids, and the whole gallery flows in one continuous
  // scroll with no tab switching.
  const visibleSets = useMemo(() => sets.filter(set => set.photos.length > 0), [sets]);

  // Gallery-wide selection: every selected photo across every set feeds the
  // sticky selection bar and the review dialog.
  const allPhotos = useMemo(
    () => visibleSets.flatMap(set => set.photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) }))),
    [visibleSets, favoriteIds],
  );
  const selectedPhotos = useMemo(() => allPhotos.filter(photo => photo.selected), [allPhotos]);

  function updateFavorite(photoId: string, favorite: boolean) {
    setFavoriteIds(previous => {
      const next = new Set(previous);
      if (favorite) next.add(photoId);
      else next.delete(photoId);
      return next;
    });
    setError(null);
  }

  // Server-backed toggle used by the review dialog: optimistic locally, rolled
  // back whenever the server rejects the change.
  async function applyFavorite(photoId: string, favorite: boolean) {
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    form.set("selected", String(favorite));
    updateFavorite(photoId, favorite);
    try {
      const result = await togglePhotoFavorite(form);
      if (!result.ok) {
        updateFavorite(photoId, !favorite);
        setError(result.error);
      }
    } catch {
      updateFavorite(photoId, !favorite);
      setError("Unable to update favourites. Please try again.");
    }
  }

  async function handleClear() {
    const form = new FormData();
    form.set("slug", slug);
    try {
      const result = await clearPhotoSelection(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } catch {
      setError("The selection could not be cleared. Try again.");
      return;
    }
    setFavoriteIds(new Set());
    setSubmittedState(false);
    setReviewOpen(false);
    setError(null);
  }

  function handleSubmitted() {
    setSubmittedState(true);
    setReviewOpen(false);
    setError(null);
  }

  if (!visibleSets.length) {
    return <p className="client-empty">There are no photos in this gallery yet.</p>;
  }

  return (
    <div className="client-gallery-content" id="client-gallery-grid">
      {visibleSets.map(set => (
        <section className="client-set" key={set.id}>
          <h2 className="client-set-title">{set.name}</h2>
          <GalleryWorkspace
            folder={set.slug}
            identified={identifiedState}
            onFavoriteChange={updateFavorite}
            onIdentified={() => setIdentifiedState(true)}
            photos={set.photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) }))}
            slug={slug}
            submitted={submittedState}
          />
        </section>
      ))}
      <SelectionBar
        count={selectedPhotos.length}
        error={error}
        onCleared={() => void handleClear()}
        onReview={selectedPhotos.length > 0 ? () => setReviewOpen(true) : undefined}
        onSubmitted={handleSubmitted}
        photoIds={selectedPhotos.length > 0 ? selectedPhotos.map(photo => photo.id) : undefined}
        slug={slug}
        submitted={submittedState}
      />
      <SelectionReview
        folder={undefined}
        onClose={() => setReviewOpen(false)}
        onSubmitted={handleSubmitted}
        onToggle={photoId => { void applyFavorite(photoId, false); }}
        open={reviewOpen}
        photos={allPhotos}
        slug={slug}
        submitted={submittedState}
      />
    </div>
  );
}