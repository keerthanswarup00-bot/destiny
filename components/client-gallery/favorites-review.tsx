"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, ExternalLink, Heart } from "lucide-react";
import { downloadGalleryPhotos } from "@/app/(client-gallery)/gallery/actions";
import { consumePendingAction, useGalleryIdentity } from "@/components/client-gallery/profile-identity";
import type { WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

export type FavoritesReviewHandle = { download: () => void };

/**
 * Personal favourites review. Distinct from the official client selection: this
 * dialog can remove favourites and download them, but never submits anything.
 */
export const FavoritesReview = forwardRef<FavoritesReviewHandle, {
  photos: WorkspacePhoto[];
  slug: string;
  open: boolean;
  onClose: () => void;
  onToggle: (photoId: string) => void;
  onClear?: () => void;
}>(function FavoritesReview({ photos, slug, open, onClose, onToggle, onClear }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { requestIdentity, identified } = useGalleryIdentity();
  const selected = photos.filter(photo => photo.selected);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const handle = () => onClose();
    node.addEventListener("close", handle);
    return () => node.removeEventListener("close", handle);
  }, [onClose]);

  const download = useCallback(async () => {
    if (!selected.length || downloading) return;
    const photoIds = selected.map(photo => photo.id);
    setDownloading(true);
    setMessage(null);
    const form = new FormData();
    form.set("slug", slug);
    for (const id of photoIds) form.append("photo_id", id);
    const result = await downloadGalleryPhotos(form);
    setDownloading(false);
    if (result.needsIdentity) {
      requestIdentity({ kind: "download-favorites" });
      setMessage("Enter your email to download your favourites.");
      return;
    }
    if (result.error || !result.items.length) {
      setMessage(result.error ?? "The download could not be started.");
      return;
    }
    let failures = 0;
    for (const item of result.items) {
      if (!item.url || !item.filename) {
        failures += 1;
        continue;
      }
      try {
        const blob = await fetch(item.url).then(res => res.blob());
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = item.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
      } catch {
        window.open(item.url, "_blank", "noopener");
      }
    }
    setMessage(failures ? `${failures} ${failures === 1 ? "download" : "downloads"} could not be started.` : `${result.items.length} ${result.items.length === 1 ? "photo" : "photos"} downloaded.`);
  }, [downloading, requestIdentity, selected, slug]);

  useImperativeHandle(ref, () => ({ download }), [download]);

  // Re-run a favourites download that prompted the email entry once the profile is identified.
  useEffect(() => {
    const action = consumePendingAction(slug, ["download-favorites"]);
    if (action) window.setTimeout(() => { void download(); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, slug]);

  return (
    <dialog className="client-review" ref={dialog}>
      <div className="client-review-body">
        <header className="client-review-head">
          <div>
            <h2>Your favourites</h2>
            <p className="client-review-count">
              {selected.length} {selected.length === 1 ? "photo" : "photos"} saved
            </p>
          </div>
          {open ? <button aria-label="Close" className="client-review-close" onClick={onClose} type="button"><span aria-hidden="true">×</span></button> : null}
        </header>
        {selected.length ? (
          <>
            <div className="client-review-grid">
              {selected.map(photo => (
                <figure className="client-review-photo" key={photo.id}>
                  {/* Signed preview URL; next/image is a poor fit for short-lived tokens. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" loading="lazy" src={photo.src} />
                  <figcaption>
                    <a aria-label="Open full photo" href={photo.fullSrc || photo.src} rel="noreferrer" target="_blank" title="Open photo">
                      <ExternalLink size={13} strokeWidth={1.8} />
                    </a>
                    <button aria-label="Remove from favourites" onClick={() => onToggle(photo.id)} title="Remove from favourites" type="button">
                      <Heart fill="currentColor" size={13} strokeWidth={1.8} />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            <footer className="client-review-foot">
              <button className="client-clear-button" onClick={onClose} type="button">Close</button>
              {onClear ? (
                <button className="client-clear-button" onClick={onClear} type="button">Clear all</button>
              ) : null}
              <button className="client-review-button client-download-button" disabled={downloading} onClick={() => void download()} type="button">
                <Download size={14} strokeWidth={2} /> {downloading ? "Preparing…" : "Download all"}
              </button>
            </footer>
          </>
        ) : (
          <p className="client-empty">No favourites yet in this gallery.</p>
        )}
        {message ? <p aria-live="polite" className="client-bar-error is-ok" role="status">{message}</p> : null}
      </div>
    </dialog>
  );
});