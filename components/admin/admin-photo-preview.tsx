"use client";

import { useEffect } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type AdminPhotoPreviewPhoto = {
  id: string;
  filename: string;
  width: number | null;
  height: number | null;
  src: string;
};

export function AdminPhotoPreview({
  photos,
  index,
  onClose,
  onChange,
}: {
  photos: AdminPhotoPreviewPhoto[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const photo = photos[index] ?? null;

  useEffect(() => {
    if (!photo) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(Math.max(0, index - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onChange(Math.min(photos.length - 1, index + 1));
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [index, onChange, onClose, photo, photos.length]);

  if (!photo) return null;

  const canGoPrevious = index > 0;
  const canGoNext = index < photos.length - 1;
  const dimensions = photo.width && photo.height ? `${photo.width} × ${photo.height}` : null;

  return (
    <div
      aria-label="Photo preview"
      aria-modal="true"
      className="admin-photo-preview"
      role="dialog"
    >
      <button
        aria-label="Close photo preview"
        className="admin-photo-preview-close"
        onClick={onClose}
        type="button"
      >
        <X size={21} strokeWidth={1.7} />
      </button>

      <button
        aria-label="Previous photo"
        className="admin-photo-preview-nav admin-photo-preview-prev"
        disabled={!canGoPrevious}
        onClick={() => onChange(index - 1)}
        type="button"
      >
        <ArrowLeft size={22} strokeWidth={1.6} />
      </button>

      <div className="admin-photo-preview-stage">
        <div className="admin-photo-preview-image-wrap">
          {/* Signed admin-only URL; next/image is a poor fit for short-lived tokens. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={photo.filename}
            className="admin-photo-preview-image"
            src={photo.src}
          />
        </div>

        <div className="admin-photo-preview-meta">
          <strong title={photo.filename}>{photo.filename}</strong>
          <span>
            {index + 1} / {photos.length}
            {dimensions ? ` · ${dimensions}` : ""}
          </span>
        </div>
      </div>

      <button
        aria-label="Next photo"
        className="admin-photo-preview-nav admin-photo-preview-next"
        disabled={!canGoNext}
        onClick={() => onChange(index + 1)}
        type="button"
      >
        <ArrowRight size={22} strokeWidth={1.6} />
      </button>
    </div>
  );
}
