"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import Lightbox, { isImageSlide } from "yet-another-react-lightbox";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import { Check, Download, Heart, Share2 } from "lucide-react";
import { downloadGalleryPhoto, shareGalleryPhoto } from "@/app/(client-gallery)/gallery/actions";
import { JustifiedPhotoGrid, type JustifiedPhoto } from "@/components/gallery/justified-photo-grid";
import { ClientZoomableSlide } from "@/components/client-gallery/zoomable-slide";
import { consumePendingAction, useGalleryIdentity } from "@/components/client-gallery/profile-identity";
import type { WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

export type ClientPhotoGridHandle = { openSlideshow: () => void };

export function ClientPhotoGrid({
  slug,
  folder,
  photos,
  onToggle,
  onClientToggle,
  busyIds,
  disabled,
  clientMode,
  clientSubmitted,
  slideshowRequest,
  ref,
}: {
  slug: string;
  folder?: string;
  photos: WorkspacePhoto[];
  onToggle: (photoId: string) => void;
  onClientToggle?: (photoId: string) => void;
  busyIds: Set<string>;
  disabled: boolean;
  clientMode?: boolean;
  clientSubmitted?: boolean;
  slideshowRequest?: number;
  ref?: Ref<ClientPhotoGridHandle>;
}) {
  const [index, setIndex] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { requestIdentity, identified } = useGalleryIdentity();
  useImperativeHandle(ref, () => ({ openSlideshow: () => setIndex(0) }), []);

  const current = index >= 0 ? photos[index] : null;
  const slides = photos.map(photo => ({ src: photo.fullSrc || photo.src, width: photo.width ?? undefined, height: photo.height ?? undefined, alt: "" }));

  useEffect(() => {
    if (slideshowRequest && photos.length > 0) setIndex(0);
  }, [slideshowRequest, photos.length]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // Re-run a download that prompted the email entry once the profile is identified.
  useEffect(() => {
    const action = consumePendingAction(slug, ["download-photo"]);
    if (action && action.kind === "download-photo") void downloadPhoto(action.photoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, slug]);

  function showNotice(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }

  async function sharePhoto(photoId: string) {
    if (actionBusy === photoId) return;
    setActionBusy(photoId);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("photo_id", photoId);
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
    } finally {
      setActionBusy(null);
    }
  }

  function shareCurrent() {
    if (!current) return;
    void sharePhoto(current.id);
  }

  async function downloadPhoto(photoId: string) {
    if (actionBusy === photoId) return;
    setActionBusy(photoId);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("photo_id", photoId);
      const result = await downloadGalleryPhoto(form);
      if (result.needsIdentity) {
        requestIdentity({ kind: "download-photo", photoId });
        showNotice("Enter your email to download full-size photos.");
        return;
      }
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
    } finally {
      setActionBusy(null);
    }
  }

  function downloadCurrent() {
    if (!current) return;
    void downloadPhoto(current.id);
  }

  const renderOverlay = (photo: JustifiedPhoto) => {
    const item = photos.find(p => p.id === photo.id);
    if (!item) return null;
    const busy = busyIds.has(item.id);
    return (
      <div className="client-photo-actions">
        <span className={`client-photo-veil${item.selected ? " is-selected" : ""}`}>
          <button
            aria-label={item.selected ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={item.selected}
            className={`client-photo-action client-heart${item.selected ? " is-selected" : ""}`}
            disabled={busy}
            onClick={() => onToggle(item.id)}
            title={item.selected ? "Remove from favourites" : "Add to favourites"}
            type="button"
          >
            {item.selected ? <Heart fill="currentColor" size={16} strokeWidth={1.6} /> : <Heart size={16} strokeWidth={1.6} />}
          </button>
        </span>
        {clientMode ? (
          <span className={`client-photo-veil${item.clientSelected ? " is-selected" : ""}`}>
            <button
              aria-label={item.clientSelected ? "Remove from client selection" : "Add to client selection"}
              aria-pressed={item.clientSelected}
              className={`client-photo-action client-photo-select${item.clientSelected ? " is-selected" : ""}`}
              disabled={busy || Boolean(clientSubmitted)}
              onClick={() => onClientToggle?.(item.id)}
              title={item.clientSelected ? "Remove from client selection" : "Add to client selection"}
              type="button"
            >
              {item.clientSelected ? <Check fill="currentColor" size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
            </button>
          </span>
        ) : null}
        <span className="client-photo-veil">
          <button aria-label="Download photo" className="client-photo-action" disabled={disabled || actionBusy === item.id} onClick={() => void downloadPhoto(item.id)} title="Download photo" type="button"><Download size={16} strokeWidth={1.6} /></button>
          <button aria-label="Share photo" className="client-photo-action" disabled={disabled || actionBusy === item.id} onClick={() => void sharePhoto(item.id)} title="Share photo" type="button"><Share2 size={16} strokeWidth={1.6} /></button>
        </span>
      </div>
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
          slide: ({ slide, offset, rect }) => isImageSlide(slide) ? (
            <ClientZoomableSlide rect={rect} slide={slide} slideOffset={offset} />
          ) : undefined,
        }}
        slideshow={{ autoplay: index >= 0 && slideshowRequest > 0, delay: 3500 }}
        slides={slides}
        toolbar={{
          buttons: [
            <span className="client-lightbox-counter" key="counter">{index >= 0 ? index + 1 : 0} / {photos.length}</span>,
            <span className="client-lightbox-spacer" key="spacer" />,
            <button
              aria-label={current?.selected ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={current?.selected}
              className={`client-lightbox-action yarl__button${current?.selected ? " is-selected" : ""}`}
              disabled={Boolean(current && busyIds.has(current.id))}
              key="select"
              onClick={() => { if (current) onToggle(current.id); }}
              title={current?.selected ? "Remove from favourites" : "Add to favourites"}
              type="button"
            >
              {current?.selected ? <Heart fill="currentColor" size={18} strokeWidth={1.6} /> : <Heart size={18} strokeWidth={1.6} />}
            </button>,
            ...(clientMode && current ? [
              <button
                aria-label={current.clientSelected ? "Remove from client selection" : "Add to client selection"}
                aria-pressed={current.clientSelected}
                className={`client-lightbox-action client-lightbox-select yarl__button${current.clientSelected ? " is-selected" : ""}`}
                disabled={Boolean(clientSubmitted)}
                key="client-select"
                onClick={() => { if (current) onClientToggle?.(current.id); }}
                title={current.clientSelected ? "Remove from client selection" : "Add to client selection"}
                type="button"
              >
                {current.clientSelected ? <Check fill="currentColor" size={18} strokeWidth={2} /> : <Check size={18} strokeWidth={2} />}
              </button>,
            ] : []),
            <button aria-label="Download photo" className="client-lightbox-action yarl__button" disabled={!current || actionBusy === current?.id} key="download" onClick={() => void downloadCurrent()} title="Download photo" type="button"><Download size={17} strokeWidth={1.6} /></button>,
            <button aria-label="Share photo" className="client-lightbox-action yarl__button" disabled={!current || actionBusy === current?.id} key="share" onClick={() => void shareCurrent()} title="Share photo" type="button"><Share2 size={17} strokeWidth={1.6} /></button>,
            "slideshow",
            "fullscreen",
            "close",
          ],
        }}
      />
    </>
  );
}