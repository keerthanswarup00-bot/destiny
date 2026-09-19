"use client";

import { useState } from "react";
import { togglePhotoSelection } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";
import { SelectionBar } from "@/components/client-gallery/selection-bar";

export type WorkspacePhoto = { id: string; src: string; fullSrc: string; width: number | null; height: number | null; selected: boolean };

export function GalleryWorkspace({
  slug,
  folder,
  photos: initialPhotos,
  submittedInitially,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  submittedInitially: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [submitted, setSubmitted] = useState(submittedInitially);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = photos.reduce((total, photo) => total + (photo.selected ? 1 : 0), 0);

  async function handleToggle(photoId: string) {
    if (submitted || busyId) return;
    setBusyId(photoId);
    setError(null);
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    if (folder) form.set("folder", folder);
    const result = await togglePhotoSelection(form);
    setBusyId(null);
    if (result.ok) {
      const selected = result.selected;
      setPhotos(prev => prev.map(photo => (photo.id === photoId ? { ...photo, selected } : photo)));
    } else {
      if (result.submitted) setSubmitted(true);
      setError(result.error);
    }
  }

  return (
    <>
      <ClientPhotoGrid busyId={busyId} disabled={submitted} folder={folder} onToggle={handleToggle} photos={photos} slug={slug} />
      <SelectionBar count={count} error={error} folder={folder} onSubmitted={() => { setSubmitted(true); setError(null); }} slug={slug} submitted={submitted} />
    </>
  );
}