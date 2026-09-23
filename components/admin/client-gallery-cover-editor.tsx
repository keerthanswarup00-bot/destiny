"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setFolderCover } from "@/app/admin/set-actions";

type CoverCrop = { x: number; y: number; zoom: number };
type CoverPhoto = { id: string; width: number | null; height: number | null; src: string };

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;
const ZOOM_SLIDER_STEP = 0.05;

function clampCenter(value: number, zoom: number) {
  const edge = 0.5 / zoom;
  return Math.min(1 - edge, Math.max(edge, value));
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * Admin crop editor for a Client Gallery Set cover/highlight.
 *
 * Replaces the tall film-strip radio picker. The editor renders the chosen
 * source photo cover-fit inside a fixed 16/9 crop viewport (the stature of
 * the client gallery hero) and replays the normalized { x, y, zoom } crop with
 * the exact CSS transform the hero viewport uses - nothing is ever written to
 * the original photo. Dragging pans, the wheel/slider/buttons zoom, and pan is
 * clamped so the cover-fit image never reveals an empty edge at any hero
 * aspect ratio. Saving persists the crop on folders.cover_crop alongside the
 * existing cover_photo_id source selection.
 */
export function ClientGalleryCoverEditor({
  folderId,
  photos,
  currentCoverPhotoId,
  currentCrop,
  onClose,
}: {
  folderId: string;
  photos: CoverPhoto[];
  currentCoverPhotoId: string | null;
  currentCrop: CoverCrop | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const view = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: number; baseX: number; baseY: number; startX: number; startY: number; width: number; height: number } | null>(null);
  const initialPhotoId = currentCoverPhotoId && photos.some(photo => photo.id === currentCoverPhotoId) ? currentCoverPhotoId : (photos[0]?.id ?? "");
  const [photoId, setPhotoId] = useState(initialPhotoId);
  const [zoom, setZoom] = useState(currentCrop?.zoom ?? MIN_ZOOM);
  const [x, setX] = useState(currentCrop?.x ?? 0.5);
  const [y, setY] = useState(currentCrop?.y ?? 0.5);
  const photo = photos.find(option => option.id === photoId) ?? null;

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);

  useEffect(() => {
    const element = view.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const next = clampZoom(zoom * Math.exp(-event.deltaY * 0.0015));
      if (next === zoom) return;
      const edge = 0.5 / next;
      setZoom(next);
      setX(current => Math.min(1 - edge, Math.max(edge, current)));
      setY(current => Math.min(1 - edge, Math.max(edge, current)));
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoom]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id: event.pointerId,
      baseX: x,
      baseY: y,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = (event.clientX - state.startX) / state.width;
    const dy = (event.clientY - state.startY) / state.height;
    setX(clampCenter(state.baseX - dx / zoom, zoom));
    setY(clampCenter(state.baseY - dy / zoom, zoom));
  }

  function onPointerEnd() {
    drag.current = null;
  }

  function applyZoom(next: number) {
    if (next === zoom) return;
    const edge = 0.5 / next;
    setZoom(next);
    setX(current => Math.min(1 - edge, Math.max(edge, current)));
    setY(current => Math.min(1 - edge, Math.max(edge, current)));
  }

  function adjustZoom(steps: number) {
    applyZoom(clampZoom(zoom * Math.pow(ZOOM_STEP, steps)));
  }

  function reset() {
    applyZoom(MIN_ZOOM);
    setX(0.5);
    setY(0.5);
  }

  function selectPhoto(id: string) {
    if (id === photoId) return;
    setPhotoId(id);
    setX(0.5);
    setY(0.5);
    setZoom(MIN_ZOOM);
  }

  const transform = `translate(${(0.5 - x * zoom) * 100}%, ${(0.5 - y * zoom) * 100}%) scale(${zoom})`;

  return (
    <dialog className="admin-dialog crop-editor" onCancel={onClose} ref={dialog}>
      <form action={setFolderCover} onSubmit={() => { onClose(); router.refresh(); }}>
        <h2>Edit highlight</h2>
        <p>Choose the source photo, then pan and zoom to frame the client gallery hero. The original photo is never modified.</p>
        {photos.length ? (
          <>
            <div aria-label="Source photo" className="cover-source-strip" role="radiogroup">
              {photos.map(option => (
                <label className="cover-source-option" key={option.id}>
                  {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" loading="lazy" src={option.src} />
                  <input checked={photoId === option.id} name="cover-source" onChange={() => selectPhoto(option.id)} type="radio" value={option.id} />
                  <span>Source</span>
                </label>
              ))}
            </div>
            <div className="gallery-highlight-editor">
              <div
                aria-label="Crop area. Drag to pan, scroll to zoom."
                className="crop-view"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                ref={view}
                role="application"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="crop-view__img"
                    draggable={false}
                    src={photo.src}
                    style={{ transform, transformOrigin: "0 0" }}
                  />
                ) : null}
              </div>
              <div className="crop-controls">
                <button aria-label="Zoom out" onClick={() => adjustZoom(-1)} type="button">−</button>
                <input aria-label="Zoom" className="crop-zoom-slider" max={MAX_ZOOM} min={MIN_ZOOM} onChange={event => applyZoom(Number(event.target.value))} step={ZOOM_SLIDER_STEP} type="range" value={zoom} />
                <output>{zoom.toFixed(1)}×</output>
                <button aria-label="Zoom in" onClick={() => adjustZoom(1)} type="button">+</button>
                <button onClick={reset} type="button">Reset</button>
              </div>
            </div>
          </>
        ) : (
          <p className="empty">No photos in this set yet. Upload photos first.</p>
        )}
        <input name="id" type="hidden" value={folderId} />
        <input name="cover_photo_id" type="hidden" value={photo?.id ?? ""} />
        <input name="x" type="hidden" value={String(Math.round(x * 10000) / 10000)} />
        <input name="y" type="hidden" value={String(Math.round(y * 10000) / 10000)} />
        <input name="zoom" type="hidden" value={String(Math.round(zoom * 100) / 100)} />
        <menu>
          <button onClick={onClose} type="button">Cancel</button>
          <button className="admin-button" disabled={!photo} type="submit">Save highlight</button>
        </menu>
      </form>
    </dialog>
  );
}