"use client";

import { useState } from "react";
import { togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";

export type WorkspacePhoto = { id: string; src: string; fullSrc: string; width: number | null; height: number | null; selected: boolean };

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayed = photos.map(photo => (photo.id in pending ? { ...photo, selected: pending[photo.id] } : photo));

  async function handleToggle(photoId: string) {
    if (busyId) return;
    const before = pending[photoId] ?? displayed.find(photo => photo.id === photoId)?.selected ?? false;
    setBusyId(photoId);
    setError(null);
    setPending(previous => ({ ...previous, [photoId]: !before }));
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    if (folder) form.set("folder", folder);
    const result = await togglePhotoFavorite(form);
    setBusyId(null);
    setPending(previous => {
      const next = { ...previous };
      delete next[photoId];
      return next;
    });
    if (result.ok) {
      onFavoriteChange?.(photoId, result.selected);
      return;
    }
    setError(result.error);
  }

  return (
    <>
      <ClientPhotoGrid busyId={busyId} disabled={false} folder={folder} onToggle={handleToggle} photos={displayed} slug={slug} />
      {error ? <p className="client-bar-error" role="alert">{error}</p> : null}
    </>
  );
}