"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Download, ExternalLink, Heart } from "lucide-react";
import { consumePendingAction, useGalleryIdentity } from "@/components/client-gallery/profile-identity";
import { useAnimatedDialog } from "@/components/client-gallery/use-animated-dialog";
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
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const { requestIdentity, identified } = useGalleryIdentity();
  const selected = photos.filter(photo => photo.selected);
  const grouped = selected.reduce<Map<string, WorkspacePhoto[]>>((groups, photo) => {
    const name = photo.setName?.trim() || "Favourites";
    const existing = groups.get(name);
    if (existing) existing.push(photo);
    else groups.set(name, [photo]);
    return groups;
  }, new Map());
  const { dialogRef, closing } = useAnimatedDialog({ open, onClose });

  const download = useCallback(async () => {
    if (downloading) return;
    if (!selected.length) {
      setStatus({ kind: "info", text: "Add a few favourites first, then download them here." });
      return;
    }
    if (!identified) {
      requestIdentity({ kind: "download-favorites" });
      setStatus({ kind: "info", text: "Enter your email to download your favourites." });
      return;
    }

    setDownloading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/gallery/${encodeURIComponent(slug)}/favorites.zip`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "The download could not be started.");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `favourites-${slug}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setStatus({ kind: "info", text: "Your favourites ZIP is downloading." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "The download could not be started." });
    } finally {
      setDownloading(false);
    }
  }, [downloading, identified, requestIdentity, selected.length, slug]);

  useImperativeHandle(ref, () => ({ download }), [download]);

  // Re-run a favourites download that prompted the email entry once the profile is identified.
  useEffect(() => {
    const action = consumePendingAction(slug, ["download-favorites"]);
    if (action) window.setTimeout(() => { void download(); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, slug]);

  return (
    <dialog className={`client-review${closing ? " is-closing" : ""}`} ref={dialogRef}>
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
            <div className="client-review-groups">
              {[...grouped.entries()].map(([setName, group]) => (
                <section className="client-review-group" key={setName}>
                  <header className="client-review-group-head">
                    <h3>{setName}</h3>
                    <span>{group.length} {group.length === 1 ? "photo" : "photos"}</span>
                  </header>
                  <div className="client-review-grid">
                    {group.map(photo => (
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
                </section>
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
          <div className="client-review-empty">
            <span aria-hidden="true" className="client-review-empty-icon"><Heart size={22} strokeWidth={1.4} /></span>
            <p className="client-review-empty-title">No favourites yet</p>
            <p className="client-review-empty-sub">Tap the heart on any photo to save it here.</p>
          </div>
        )}
        {status ? (
          <p aria-live="polite" className={`client-bar-error${status.kind === "info" ? " is-ok" : ""}`} role="status">{status.text}</p>
        ) : null}
      </div>
    </dialog>
  );
});