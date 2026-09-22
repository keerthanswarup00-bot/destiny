"use client";

import { useState } from "react";
import { togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";

export type WorkspacePhoto = {
  id: string;
  src: string;
  fullSrc: string;
  width: number | null;
  height: number | null;
  selected: boolean;
};

export function GalleryWorkspace({
  slug,
  folder,
  photos,
  onFavoriteChange,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  submittedInitially?: boolean;
  onFavoriteChange?: (photoId: string, favorite: boolean) => void;
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const displayed = photos.map(photo =>
    photo.id in pending
      ? { ...photo, selected: pending[photo.id] }
      : photo,
  );

  async function handleToggle(photoId: string) {
    if (photoId in pending) return;

    const photo = displayed.find(item => item.id === photoId);
    if (!photo) return;

    const nextFavorite = !photo.selected;

    // Optimistic UI update immediately.
    setPending(previous => ({
      ...previous,
      [photoId]: nextFavorite,
    }));
    setError(null);

    // Keep parent/grid/preview state synchronized immediately.
    onFavoriteChange?.(photoId, nextFavorite);

    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    form.set("selected", String(nextFavorite));

    if (folder) {
      form.set("folder", folder);
    }

    try {
      const result = await togglePhotoFavorite(form);

      if (!result.ok) {
        // Roll back the optimistic change.
        onFavoriteChange?.(photoId, !nextFavorite);
        setError(result.error);
      }
    } catch {
      // Roll back on unexpected server/network failure.
      onFavoriteChange?.(photoId, !nextFavorite);
      setError("Unable to update favourites. Please try again.");
    } finally {
      setPending(previous => {
        const next = { ...previous };
        delete next[photoId];
        return next;
      });
    }
  }

  const pendingIds = new Set(Object.keys(pending));

  return (
    <>
      <ClientPhotoGrid
        busyIds={pendingIds}
        disabled={false}
        folder={folder}
        onToggle={handleToggle}
        photos={displayed}
        slug={slug}
      />

      {error ? (
        <p className="client-bar-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}