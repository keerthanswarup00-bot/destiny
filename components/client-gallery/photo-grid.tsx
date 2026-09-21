"use client";

import { useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import { Download, Heart, Share2 } from "lucide-react";
import { downloadGalleryPhoto, shareGalleryPhoto } from "@/app/(client-gallery)/gallery/actions";
import { JustifiedPhotoGrid, type JustifiedPhoto } from "@/components/gallery/justified-photo-grid";
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
    if (!result.url || !result.filename) {
      showNotice(result.error ?? "Download is unavailable right now.");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  const renderOverlay = (photo: JustifiedPhoto) => {
    const item = photos.find(p => p.id === photo.id);
    if (!item) return null;
    const busy = busyId === item.id;
    return (
      <button
        aria-label={item.selected ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={item.selected}
        className={`client-heart${item.selected ? " is-selected" : ""}`}
        disabled={disabled || busy}
        onClick={() => onToggle(item.id)}
        title={item.selected ? "Remove from favourites" : "Add to favourites"}
        type="button"
      >
        {item.selected ? <Heart fill="currentColor" size={16} strokeWidth={1.6} /> : <Heart size={16} strokeWidth={1.6} />}
      </button>
    );
  };

  return (
    <>
      <JustifiedPhotoGrid onPhotoClick={setIndex} overlay={renderOverlay} photos={photos} />
      <Lightbox
        className="gallery-lightbox"
        close={() => setIndex(-1)}
        index={index}
        labels={{
          Close: "Close",
          Next: "Next photo",
          Previous: "Previous photo",
          "Photo gallery": "Photo gallery",
          "{index} of {total}": "{index} of {total}",
        }}
        on={{ view: ({ index: nextIndex }) => setIndex(nextIndex) }}
        open={index >= 0}
        plugins={[Slideshow]}
        render={{
          controls: () => (notice ? <span aria-live="polite" className="client-lightbox-notice" role="status">{notice}</span> : null),
        }}
        slideshow={{ autoplay: false, delay: 3500 }}
        slides={slides}
        toolbar={{
          buttons: [
            <span className="client-lightbox-counter" key="counter">{index >= 0 ? index + 1 : 0} / {photos.length}</span>,
            <span className="client-lightbox-spacer" key="spacer" />,
            <button
              aria-label={current?.selected ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={current?.selected}
              className={`client-lightbox-action yarl__button${current?.selected ? " is-selected" : ""}`}
              disabled={disabled || Boolean(current && busyId === current.id)}
              key="select"
              onClick={() => { if (current) onToggle(current.id); }}
              title={current?.selected ? "Remove from favourites" : "Add to favourites"}
              type="button"
            >
              {current?.selected ? <Heart fill="currentColor" size={18} strokeWidth={1.6} /> : <Heart size={18} strokeWidth={1.6} />}
            </button>,
            <button aria-label="Download photo" className="client-lightbox-action yarl__button" disabled={!current} key="download" onClick={() => void downloadCurrent()} title="Download photo" type="button"><Download size={17} strokeWidth={1.6} /></button>,
            <button aria-label="Share photo" className="client-lightbox-action yarl__button" disabled={!current} key="share" onClick={() => void shareCurrent()} title="Share photo" type="button"><Share2 size={17} strokeWidth={1.6} /></button>,
            "slideshow",
            "fullscreen",
            "close",
          ],
        }}
      />
    </>
  );
}