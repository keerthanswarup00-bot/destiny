"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveGalleryHighlightCrop } from "@/app/admin/set-actions";

type HighlightCrop = { x: number; y: number; zoom: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;

function clampCenter(value: number, zoom: number) {
  const edge = 0.5 / zoom;
  return Math.min(1 - edge, Math.max(edge, value));
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * Admin crop editor for the client-gallery hero highlight. Identical formula to
 * the Website Gallery crop editor: the ORIGINAL image renders cover-fit inside
 * a 16/9 frame and the stored normalized { x, y, zoom } crop is replayed with a
 * CSS transform — nothing is ever written to the original file. Saving writes
 * only galleries.highlight_crop metadata (saveGalleryHighlightCrop).
 */
export function GalleryHighlightCropEditor({
  galleryId,
  photoId,
  url,
  crop,
  onClose,
}: {
  galleryId: string;
  photoId: string;
  url: string;
  crop: HighlightCrop | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(crop?.zoom ?? MIN_ZOOM);
  const [x, setX] = useState(crop?.x ?? 0.5);
  const [y, setY] = useState(crop?.y ?? 0.5);
  const view = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: number; baseX: number; baseY: number; startX: number; startY: number; width: number; height: number } | null>(null);
  const router = useRouter();

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

  function adjustZoom(steps: number) {
    const next = clampZoom(zoom * Math.pow(ZOOM_STEP, steps));
    if (next === zoom) return;
    const edge = 0.5 / next;
    setZoom(next);
    setX(current => Math.min(1 - edge, Math.max(edge, current)));
    setY(current => Math.min(1 - edge, Math.max(edge, current)));
  }

  const transform = `translate(${(0.5 - x * zoom) * 100}%, ${(0.5 - y * zoom) * 100}%) scale(${zoom})`;

  return (
    <dialog className="admin-dialog crop-editor" onCancel={onClose} ref={dialog}>
      <form
        action={saveGalleryHighlightCrop}
        onSubmit={() => {
          onClose();
          router.refresh();
        }}
      >
        <h2>Crop highlight</h2>
        <p>Pan and zoom to frame the hero&rsquo;s 16/9 region. The original image is never modified.</p>
        <div className="gallery-highlight-editor">
          <div
            aria-label="Highlight crop area. Drag to pan."
            className="crop-view"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            ref={view}
            role="application"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="crop-view__img"
              draggable={false}
              src={url}
              style={{ transform, transformOrigin: "0 0" }}
            />
          </div>
          <div className="crop-controls">
            <button onClick={() => adjustZoom(-1)} type="button">−</button>
            <output>{zoom.toFixed(1)}×</output>
            <button onClick={() => adjustZoom(1)} type="button">+</button>
            <button onClick={() => { setZoom(MIN_ZOOM); setX(0.5); setY(0.5); }} type="button">Reset</button>
          </div>
        </div>
        <input name="id" type="hidden" value={galleryId} />
        <input name="x" type="hidden" value={String(Math.round(x * 10000) / 10000)} />
        <input name="y" type="hidden" value={String(Math.round(y * 10000) / 10000)} />
        <input name="zoom" type="hidden" value={String(Math.round(zoom * 100) / 100)} />
        <menu>
          <button onClick={onClose} type="button">Cancel</button>
          <button className="admin-button" type="submit">Save crop</button>
        </menu>
      </form>
    </dialog>
  );
}