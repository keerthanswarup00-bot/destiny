"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Reveal } from "@/components/public/reveal";

type GalleryHighlightCrop = { x: number; y: number; zoom: number };

/**
 * Public Website Gallery Highlight banner.
 *
 * Non-destructive crop: the original full-resolution image is delivered as-is
 * and the stored normalized { x, y, zoom } crop is reproduced purely with a CSS
 * transform. The transform maps the cover-fit image so that the covered point
 * `x, y` is centered and the magnification `zoom` is applied:
 *   translate((0.5 - x * zoom) * 100%, (0.5 - y * zoom) * 100%) scale(zoom)
 * with transform-origin top-left (CSS applies scale first, then translate, so
 * the translate stays in container units and the centered point is exact).
 *
 * Clicking the banner opens a full-screen viewer that shows the same
 * high-resolution original, uncropped and aspect-ratio preserved, on a black
 * background.
 */
export function GalleryHighlight({
  url,
  crop,
}: {
  url: string;
  width: number | null;
  height: number | null;
  crop: GalleryHighlightCrop | null;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const transform = crop && crop.zoom >= 1
    ? `translate(${(0.5 - crop.x * crop.zoom) * 100}%, ${(0.5 - crop.y * crop.zoom) * 100}%) scale(${crop.zoom})`
    : undefined;

  return (
    <Reveal as="div" className="gallery-highlight__wrap">
      <button
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-label="Open featured photograph in a full-screen viewer"
        className="gallery-highlight"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        title="View full photograph"
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="gallery-highlight__img"
          decoding="async"
          fetchPriority="high"
          src={url}
          style={transform ? { transform, transformOrigin: "0 0" } : undefined}
        />
        <span className="gallery-highlight__shade" />
        <span className="gallery-highlight__label">Selected work</span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <GalleryHighlightViewer onClose={() => setOpen(false)} triggerRef={triggerRef} url={url} />,
        document.body,
      ) : null}
    </Reveal>
  );
}

function GalleryHighlightViewer({
  url,
  onClose,
  triggerRef,
}: {
  url: string;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [triggerRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      aria-label="Featured photograph"
      aria-modal="true"
      className="gallery-viewer"
      onClick={onClose}
      role="dialog"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Featured photograph from the gallery"
        className="gallery-viewer__img"
        onClick={(event) => event.stopPropagation()}
        src={url}
      />
      <button
        ref={closeButtonRef}
        aria-label="Close viewer"
        className="gallery-viewer__close"
        onClick={onClose}
        title="Close viewer"
        type="button"
      >
        <X size={20} strokeWidth={1.6} />
      </button>
    </div>
  );
}