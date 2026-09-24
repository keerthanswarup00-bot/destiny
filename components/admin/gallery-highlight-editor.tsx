"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crop, ImageIcon, Trash2 } from "lucide-react";
import { setGalleryHighlight } from "@/app/admin/set-actions";
import { GalleryHighlightCropEditor } from "@/components/admin/gallery-highlight-crop-editor";

type HighlightPhoto = { id: string; filename: string; src: string; width: number | null; height: number | null };
type HighlightCrop = { x: number; y: number; zoom: number };

export function GalleryHighlightEditor({
  galleryId,
  folders,
  photosByFolder,
  highlight,
}: {
  galleryId: string;
  folders: { id: string; name: string }[];
  photosByFolder: Record<string, HighlightPhoto[]>;
  highlight: { id: string | null; src: string | null; crop: HighlightCrop | null };
}) {
  const [open, setOpen] = useState(false);
  const [openCrop, setOpenCrop] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    else if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  const totalPhotos = Object.values(photosByFolder).reduce((count, list) => count + list.length, 0);

  return (
    <section className="gs-card" id="settings-highlight">
      <div className="gs-card-head">
        <h2>Gallery highlight</h2>
        <p>The single photo used as the client gallery hero — shared by every set.</p>
      </div>
      <div className="gs-card-body">
        {highlight.src ? (
          <div className="gh-current">
            {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Current gallery highlight" src={highlight.src} />
          </div>
        ) : (
          <div className="gh-empty">
            <ImageIcon size={22} strokeWidth={1.4} />
            <span>No highlight selected</span>
          </div>
        )}
        <div className="gh-actions">
          <button className="admin-button" disabled={!totalPhotos} onClick={() => setOpen(true)} type="button">
            {highlight.id ? "Change highlight" : "Choose highlight"}
          </button>
          {highlight.id ? (
            <button className="admin-button is-secondary" onClick={() => setOpenCrop(true)} type="button">
              <Crop size={14} strokeWidth={1.8} /> Crop hero
            </button>
          ) : null}
          {highlight.id ? (
            <form action={setGalleryHighlight} onSubmit={() => router.refresh()}>
              <input name="id" type="hidden" value={galleryId} />
              <input name="photo_id" type="hidden" value="" />
              <button className="admin-button is-secondary gh-remove" type="submit">
                <Trash2 size={14} strokeWidth={1.8} /> Remove highlight
              </button>
            </form>
          ) : null}
        </div>
        <span className="hint">Pick any photo from any set — it becomes the full-screen cover on the client landing page.</span>
      </div>

      {openCrop && highlight.id && highlight.src ? (
        <GalleryHighlightCropEditor
          crop={highlight.crop}
          galleryId={galleryId}
          onClose={() => setOpenCrop(false)}
          photoId={highlight.id}
          url={highlight.src}
        />
      ) : null}

      {open ? (
        <dialog className="admin-dialog" onCancel={() => setOpen(false)} ref={dialogRef}>
          <form
            action={setGalleryHighlight}
            onSubmit={() => {
              setOpen(false);
              router.refresh();
            }}
          >
            <h2>Gallery highlight</h2>
            <p className="muted">Pick the ONE photo shown as the client gallery&rsquo;s hero. Photos are grouped by set for convenience.</p>
            {totalPhotos ? (
              folders.map(folder => {
                const photos = photosByFolder[folder.id] ?? [];
                if (!photos.length) return null;
                return (
                  <fieldset className="gh-group" key={folder.id}>
                    <legend>{folder.name}</legend>
                    <div className="cover-picker-grid">
                      {photos.map(photo => (
                        <label className="cover-picker-option" key={photo.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" height={photo.height ?? undefined} loading="lazy" src={photo.src} width={photo.width ?? undefined} />
                          <input defaultChecked={highlight.id === photo.id} name="photo_id" type="radio" value={photo.id} />
                          <span>Highlight</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })
            ) : (
              <p className="empty">No photos in this gallery yet.</p>
            )}
            <input name="id" type="hidden" value={galleryId} />
            <menu>
              <button onClick={() => setOpen(false)} type="button">Cancel</button>
              <button className="admin-button" disabled={!totalPhotos} type="submit">Save highlight</button>
            </menu>
          </form>
        </dialog>
      ) : null}
    </section>
  );
}