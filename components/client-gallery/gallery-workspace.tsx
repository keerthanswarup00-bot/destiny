"use client";

import { useState } from "react";
import { togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";

export type WorkspacePhoto = { id: string; src: string; fullSrc: string; width: number | null; height: number | null; selected: boolean };

export function GalleryWorkspace({
  slug,
  folder,
  photos: initialPhotos,
  onFavoriteChange,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  submittedInitially?: boolean;
  onFavoriteChange?: (photoId: string, favorite: boolean) => void;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(photoId: string) {
    if (busyId) return;
    const before = photos.find(photo => photo.id === photoId)?.selected ?? false;
    setBusyId(photoId);
    setError(null);
    setPhotos(prev => prev.map(photo => (photo.id === photoId ? { ...photo, selected: !before } : photo)));
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    if (folder) form.set("folder", folder);
    const result = await togglePhotoFavorite(form);
    setBusyId(null);
    if (result.ok) {
      onFavoriteChange?.(photoId, result.selected);
      return;
    }
    setPhotos(prev => prev.map(photo => (photo.id === photoId ? { ...photo, selected: before } : photo)));
    setError(result.error);
  }

  return (
    <>
      <ClientPhotoGrid busyId={busyId} disabled={false} folder={folder} onToggle={handleToggle} photos={photos} slug={slug} />
      {error ? <p className="client-bar-error" role="alert">{error}</p> : null}
    </>
  );
}