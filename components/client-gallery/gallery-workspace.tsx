"use client";

import { useState } from "react";
import { togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";
import { useGalleryIdentity } from "@/components/client-gallery/profile-identity";

export type WorkspacePhoto = {
  id: string;
  src: string;
  fullSrc: string;
  width: number | null;
  height: number | null;
  selected: boolean;
  clientSelected: boolean;
};

export function GalleryWorkspace({
  slug,
  folder,
  photos,
  identified,
  clientMode,
  clientSubmitted,
  onFavoriteChange,
  onClientToggle,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  identified: boolean;
  clientMode?: boolean;
  clientSubmitted?: boolean;
  onFavoriteChange?: (photoId: string, favorite: boolean) => void;
  onClientToggle?: (photoId: string, selected: boolean) => Promise<void>;
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { requestIdentity } = useGalleryIdentity();

  const displayed = photos.map(photo =>
    photo.id in pending
      ? { ...photo, selected: pending[photo.id] }
      : photo,
  );

  async function applyFavorite(photoId: string, nextFavorite: boolean) {
    if (photoId in pending) return;

    setPending(previous => ({ ...previous, [photoId]: nextFavorite }));
    setError(null);
    onFavoriteChange?.(photoId, nextFavorite);

    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    form.set("selected", String(nextFavorite));
    if (folder) form.set("folder", folder);

    try {
      const result = await togglePhotoFavorite(form);
      if (!result.ok) {
        onFavoriteChange?.(photoId, !nextFavorite);
        setError(result.error);
      }
    } catch {
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

  async function applyClientToggle(photoId: string, nextSelected: boolean) {
    if (!onClientToggle) return;
    setError(null);
    await onClientToggle(photoId, nextSelected);
  }

  async function handleFavoriteToggle(photoId: string) {
    const photo = displayed.find(item => item.id === photoId);
    if (!photo) return;
    const nextFavorite = !photo.selected;

    if (!identified) {
      requestIdentity({ kind: "favorite", photoId, next: nextFavorite });
      return;
    }

    await applyFavorite(photoId, nextFavorite);
  }

  async function handleClientToggle(photoId: string) {
    if (!clientMode || !onClientToggle || clientSubmitted) return;
    const photo = displayed.find(item => item.id === photoId);
    if (!photo) return;
    const nextSelected = !photo.clientSelected;

    if (!identified) {
      requestIdentity({ kind: "client", photoId, next: nextSelected });
      return;
    }

    await applyClientToggle(photoId, nextSelected);
  }

  const pendingIds = new Set(Object.keys(pending));

  return (
    <>
      <ClientPhotoGrid
        busyIds={pendingIds}
        clientMode={clientMode}
        clientSubmitted={clientSubmitted}
        disabled={false}
        folder={folder}
        onClientToggle={handleClientToggle}
        onToggle={handleFavoriteToggle}
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