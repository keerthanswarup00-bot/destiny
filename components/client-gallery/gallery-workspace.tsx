"use client";

import { useState } from "react";
import { clearPhotoSelection, togglePhotoSelection } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";
import { SelectionBar } from "@/components/client-gallery/selection-bar";
import { SelectionReview } from "@/components/client-gallery/selection-review";

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
  const [reviewOpen, setReviewOpen] = useState(false);

  const count = photos.reduce((total, photo) => total + (photo.selected ? 1 : 0), 0);
  const selectedIds = photos.filter(photo => photo.selected).map(photo => photo.id);

  async function handleToggle(photoId: string) {
    if (submitted || busyId) return;
    const before = photos.find(photo => photo.id === photoId)?.selected ?? false;
    setBusyId(photoId);
    setError(null);
    setPhotos(prev => prev.map(photo => (photo.id === photoId ? { ...photo, selected: !before } : photo)));
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", photoId);
    if (folder) form.set("folder", folder);
    const result = await togglePhotoSelection(form);
    setBusyId(null);
    if (result.ok) return;
    setPhotos(prev => prev.map(photo => (photo.id === photoId ? { ...photo, selected: before } : photo)));
    if (result.submitted) setSubmitted(true);
    setError(result.error);
  }

  async function handleClear() {
    if (submitted || busyId || !count) return;
    setError(null);
    setBusyId("__clear");
    const form = new FormData();
    form.set("slug", slug);
    if (folder) form.set("folder", folder);
    const result = await clearPhotoSelection(form);
    setBusyId(null);
    if (result.ok) {
      setPhotos(prev => prev.map(photo => ({ ...photo, selected: false })));
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <ClientPhotoGrid busyId={busyId === "__clear" ? null : busyId} disabled={submitted} folder={folder} onToggle={handleToggle} photos={photos} slug={slug} />
      <SelectionBar count={count} error={error} folder={folder} onCleared={() => void handleClear()} onReview={count > 0 ? () => setReviewOpen(true) : undefined} onSubmitted={() => { setSubmitted(true); setError(null); }} photoIds={count > 0 ? selectedIds : undefined} slug={slug} submitted={submitted} />
      <SelectionReview
        folder={folder}
        onClose={() => setReviewOpen(false)}
        onSubmitted={() => setSubmitted(true)}
        onToggle={handleToggle}
        open={reviewOpen}
        photos={photos}
        slug={slug}
        submitted={submitted}
      />
    </>
  );
}