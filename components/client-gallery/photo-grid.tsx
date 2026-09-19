"use client";

import { useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import { downloadGalleryPhoto, shareGalleryPhoto } from "@/app/(client-gallery)/gallery/actions";
import type { WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

export function ClientPhotoGrid({
  slug,
  folder,
  photos,
  onToggle,
  busyId,
  disabled,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  onToggle: (photoId: string) => void;
  busyId: string | null;
  disabled: boolean;
}) {
  const [index, setIndex] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = index >= 0 ? photos[index] : null;
  const slides = photos.map(photo => ({ src: photo.fullSrc || photo.src, width: photo.width ?? undefined, height: photo.height ?? undefined, alt: "" }));

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  function showNotice(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }

  async function shareCurrent() {
    if (!current) return;
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", current.id);
    const result = await shareGalleryPhoto(form);
    if (!result.url) {
      showNotice(result.error ?? "A share link could not be created.");
      return;
    }
    const data = { title: "Destiny gallery photo", text: "A photograph from a Destiny gallery", url: result.url };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        // User cancelled or share failed; fall back to copying the link.
      }
    }
    try {
      await navigator.clipboard.writeText(result.url);
      showNotice("Link copied");
    } catch {
      showNotice("Could not copy the link.");
    }
  }

  async function downloadCurrent() {
    if (!current) return;
    const form = new FormData();
    form.set("slug", slug);
    form.set("photo_id", current.id);
    const result = await downloadGalleryPhoto(form);
    if (!result.url) {
      showNotice(result.error ?? "Download is unavailable right now.");
      return;
    }
    showNotice("Starting download…");
    fetch(result.url).then(res => res.blob()).then(blob => {
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    }).catch(() => {
      window.open(result.url, "_blank", "noopener");
    });
  }

  return (
    <>
      <div className="client-photo-grid">
        {photos.map((photo, i) => {
          const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : "3 / 4";
          const busy = busyId === photo.id;
          return (
            <figure className="client-photo" key={photo.id} style={{ aspectRatio: ratio }}>
              <button aria-label="View photo" className="client-photo-open" onClick={() => setIndex(i)} type="button">
                {/* Signed preview URL; next/image is a poor fit for short-lived tokens. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" height={photo.height ?? undefined} loading="lazy" src={photo.src} width={photo.width ?? undefined} />
              </button>
              <button
                aria-label={photo.selected ? "Remove from selection" : "Add to selection"}
                aria-pressed={photo.selected}
                className={`client-heart${photo.selected ? " is-selected" : ""}`}
                disabled={disabled || busy}
                onClick={() => onToggle(photo.id)}
                type="button"
              >♥</button>
            </figure>
          );
        })}
      </div>
      <Lightbox
        close={() => setIndex(-1)}
        index={index}
        labels={{
          Close: "Close",
          Next: "Next photo",
          Previous: "Previous photo",
          "Photo gallery": "Photo gallery",
          "{index} of {total}": "{index} of {total}",
        }}
        counter={{ separator: " / " }}
        on={{ view: ({ index: nextIndex }) => setIndex(nextIndex) }}
        open={index >= 0}
        plugins={[Counter, Fullscreen]}
        render={{
          controls: () => (notice ? <span aria-live="polite" className="client-lightbox-notice" role="status">{notice}</span> : null),
        }}
        slides={slides}
        toolbar={{
          buttons: [
            <button
              aria-label={current?.selected ? "Remove from selection" : "Add to selection"}
              aria-pressed={current?.selected}
              className={`client-lightbox-action yarl__button${current?.selected ? " is-selected" : ""}`}
              disabled={disabled || Boolean(current && busyId === current.id)}
              key="select"
              onClick={() => { if (current) onToggle(current.id); }}
              type="button"
            >♥</button>,
            <button aria-label="Share photo" className="client-lightbox-action yarl__button" disabled={!current} key="share" onClick={() => void shareCurrent()} type="button">↗</button>,
            <button aria-label="Download photo" className="client-lightbox-action yarl__button" disabled={!current} key="download" onClick={() => void downloadCurrent()} type="button">↓</button>,
            "close",
          ],
        }}
      />
    </>
  );
}