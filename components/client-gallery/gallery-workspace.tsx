"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { identifyGalleryViewer, togglePhotoFavorite } from "@/app/(client-gallery)/gallery/actions";
import { ClientPhotoGrid } from "@/components/client-gallery/photo-grid";

export type WorkspacePhoto = {
  id: string;
  src: string;
  fullSrc: string;
  width: number | null;
  height: number | null;
  selected: boolean;
};

type QueuedToggle = { photoId: string; next: boolean };

export function GalleryWorkspace({
  slug,
  folder,
  photos,
  identified,
  onIdentified,
  onFavoriteChange,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  identified: boolean;
  onIdentified?: () => void;
  submittedInitially?: boolean;
  onFavoriteChange?: (photoId: string, favorite: boolean) => void;
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [queuedToggle, setQueuedToggle] = useState<QueuedToggle | null>(null);
  const [email, setEmail] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const identityDialog = useRef<HTMLDialogElement>(null);

  const displayed = photos.map(photo =>
    photo.id in pending
      ? { ...photo, selected: pending[photo.id] }
      : photo,
  );

  useEffect(() => {
    const node = identityDialog.current;
    if (!node) return;
    if (identityOpen && !node.open) node.showModal();
    else if (!identityOpen && node.open) node.close();
  }, [identityOpen]);

  useEffect(() => {
    const node = identityDialog.current;
    if (!node) return;
    const handleClose = () => {
      setIdentityOpen(false);
      setQueuedToggle(null);
    };
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, []);

  async function applyToggle(photoId: string, nextFavorite: boolean) {
    if (photoId in pending) return;

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

  async function handleToggle(photoId: string) {
    const photo = displayed.find(item => item.id === photoId);
    if (!photo) return;

    const nextFavorite = !photo.selected;

    // First-time visitors identify with an email before their pick is saved.
    if (!identified) {
      setQueuedToggle({ photoId, next: nextFavorite });
      setIdentityError(null);
      setIdentityOpen(true);
      return;
    }

    await applyToggle(photoId, nextFavorite);
  }

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (identifying) return;

    const value = email.trim();
    if (!value) {
      setIdentityError("Enter your email address.");
      return;
    }

    setIdentifying(true);
    setIdentityError(null);

    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("email", value);
      const result = await identifyGalleryViewer(form);

      if (!result.ok) {
        setIdentityError(result.error ?? "Unable to save your email. Try again.");
        return;
      }

      // Keep the original click: create the session, then apply the queued pick.
      const queued = queuedToggle;
      setQueuedToggle(null);
      onIdentified?.();
      setIdentityOpen(false);
      if (queued) await applyToggle(queued.photoId, queued.next);
    } catch {
      setIdentityError("Unable to save your email. Try again.");
    } finally {
      setIdentifying(false);
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

      <dialog aria-labelledby="client-favorites-title" className="client-favorites-dialog" ref={identityDialog}>
        <form onSubmit={submitIdentity}>
          <h2 id="client-favorites-title">Favorites</h2>
          <p>Save your favorite photos and access them later using your email address.</p>
          <input
            aria-label="Your email"
            autoComplete="email"
            autoFocus
            inputMode="email"
            name="email"
            onChange={event => setEmail(event.target.value)}
            placeholder="Your email"
            required
            type="email"
            value={email}
          />
          {identityError ? (
            <p className="client-favorites-error" role="alert">
              {identityError}
            </p>
          ) : null}
          <div className="client-favorites-actions">
            <button className="client-clear-button" onClick={() => setIdentityOpen(false)} type="button">Cancel</button>
            <button className="client-submit-button" disabled={identifying} type="submit">{identifying ? "Saving…" : "Continue"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}