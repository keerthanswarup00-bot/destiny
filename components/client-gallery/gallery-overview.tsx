"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { clearClientSelection, clearPhotoSelection, toggleClientSelection, togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { GalleryWorkspace, type WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";
import { consumePendingAction } from "@/components/client-gallery/profile-identity";
import { SelectionBar } from "@/components/client-gallery/selection-bar";
import { SelectionReview } from "@/components/client-gallery/selection-review";
import { FavoritesReview } from "@/components/client-gallery/favorites-review";

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
  clientSelectedIds,
  identified,
  submitted,
  clientMode,
  onCountChange,
  ref,
}: {
  slug: string;
  sets: GallerySet[];
  selectedIds: string[];
  clientSelectedIds: string[];
  identified: boolean;
  submitted: boolean;
  clientMode?: boolean;
  onCountChange?: (count: number) => void;
  ref?: Ref<GalleryOverviewHandle>;
}) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(selectedIds));
  const [clientSelectionIds, setClientSelectionIds] = useState(() => new Set(clientSelectedIds));
  const [submittedState, setSubmittedState] = useState(submitted);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [clientReviewOpen, setClientReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCountChange?.(favoriteIds.size);
  }, [favoriteIds, onCountChange]);

  // Re-apply the action that triggered the email entry once the profile is
  // identified. The pending action is consumed (cleared) in the same read, so
  // this only fires once per flip of the identified state.
  const replayDone = useRef(false);
  useEffect(() => {
    if (!identified || replayDone.current) return;
    replayDone.current = true;
    const action = consumePendingAction(slug, ["favorite", "client"]);
    if (!action) return;
    if (action.kind === "favorite") {
      void applyFavorite(action.photoId, action.next);
    } else if (action.kind === "client") {
      void toggleClient(action.photoId, action.next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, slug]);

  useImperativeHandle(ref, () => ({ openReview: () => setFavoritesOpen(true) }), []);

  // Only sets that actually contain photos are rendered; empty published sets
  // never produce empty grids, and the whole gallery flows in one continuous
  // scroll with no tab switching.
  const visibleSets = useMemo(() => sets.filter(set => set.photos.length > 0), [sets]);

  const allPhotos = useMemo(
    () => visibleSets.flatMap(set => set.photos.map(photo => ({ ...photo, selected: favoriteIds.has(photo.id) }))),
    [visibleSets, favoriteIds],
  );
  const favouritePhotos = useMemo(() => allPhotos.filter(photo => photo.selected), [allPhotos]);

  const clientPhotos = useMemo(
    () => visibleSets.flatMap(set => set.photos.map(photo => ({
      ...photo,
      selected: clientSelectionIds.has(photo.id),
      clientSelected: clientSelectionIds.has(photo.id),
    }))),
    [visibleSets, clientSelectionIds],
  );
  const selectedClientPhotos = useMemo(() => clientPhotos.filter(photo => photo.selected), [clientPhotos]);

  function updateFavorite(photoId: string, favorite: boolean) {
    setFavoriteIds(previous => {
      const next = new Set(previous);
      if (favorite) next.add(photoId);
      else next.delete(photoId);
      return next;
    });
    setError(null);
  }

  function updateClientSelection(photoId: string, selected: boolean) {
    setClientSelectionIds(previous => {
      const next = new Set(previous);
      if (selected) next.add(photoId);
      else next.delete(photoId);
      return next;
    });
    setError(null);
  }

  // Server-backed favourite toggle used by the review dialog: optimistic
  // locally, rolled back whenever the server rejects the change.
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

  async function handleClearFavorites() {
    const form = new FormData();
    form.set("slug", slug);
    try {
      const result = await clearPhotoSelection(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } catch {
      setError("Your favourites could not be cleared. Try again.");
      return;
    }
    setFavoriteIds(new Set());
    setFavoritesOpen(false);
    setError(null);
  }

  // Official client selection: optimistic locally, server-backed, and locked
  // by submission exactly like the reviewer flow expects.
  async function toggleClient(photoId: string, nextSelected: boolean) {
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    form.set("selected", String(nextSelected));
    updateClientSelection(photoId, nextSelected);
    try {
      const result = await toggleClientSelection(form);
      if (!result.ok) {
        updateClientSelection(photoId, !nextSelected);
        setError(result.error);
      }
    } catch {
      updateClientSelection(photoId, !nextSelected);
      setError("Unable to update the selection. Please try again.");
    }
  }

  async function handleClearClientSelection() {
    const form = new FormData();
    form.set("slug", slug);
    try {
      const result = await clearClientSelection(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } catch {
      setError("The selection could not be cleared. Try again.");
      return;
    }
    setClientSelectionIds(new Set());
    setSubmittedState(false);
    setClientReviewOpen(false);
    setError(null);
  }

  function handleSubmitted() {
    setSubmittedState(true);
    setClientReviewOpen(false);
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
            clientMode={clientMode}
            clientSubmitted={submittedState}
            folder={set.slug}
            identified={identified}
            onClientToggle={(photoId, next) => toggleClient(photoId, next)}
            onFavoriteChange={updateFavorite}
            photos={set.photos.map(photo => ({
              ...photo,
              selected: favoriteIds.has(photo.id),
              clientSelected: clientSelectionIds.has(photo.id),
            }))}
            slug={slug}
          />
        </section>
      ))}
      {clientMode ? (
        <>
          <SelectionBar
            count={selectedClientPhotos.length}
            error={error}
            onCleared={() => void handleClearClientSelection()}
            onReview={selectedClientPhotos.length > 0 ? () => setClientReviewOpen(true) : undefined}
            onSubmitted={handleSubmitted}
            photoIds={selectedClientPhotos.length > 0 ? selectedClientPhotos.map(photo => photo.id) : undefined}
            slug={slug}
            submitted={submittedState}
          />
          <SelectionReview
            folder={undefined}
            onClose={() => setClientReviewOpen(false)}
            onSubmitted={handleSubmitted}
            onToggle={photoId => { void toggleClient(photoId, false); }}
            open={clientReviewOpen}
            photos={clientPhotos}
            slug={slug}
            submitted={submittedState}
          />
        </>
      ) : null}
      <FavoritesReview
        onClear={() => void handleClearFavorites()}
        onClose={() => setFavoritesOpen(false)}
        onToggle={photoId => { void applyFavorite(photoId, false); }}
        open={favoritesOpen}
        photos={allPhotos}
        slug={slug}
      />
    </div>
  );
}