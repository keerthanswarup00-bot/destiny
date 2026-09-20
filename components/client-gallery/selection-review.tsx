"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Heart, Send } from "lucide-react";
import { submitPhotoSelection } from "@/app/(client-gallery)/gallery/actions";
import type { WorkspacePhoto } from "@/components/client-gallery/gallery-workspace";

export function SelectionReview({
  photos,
  slug,
  folder,
  submitted,
  open,
  onClose,
  onToggle,
  onSubmitted,
}: {
  photos: WorkspacePhoto[];
  slug: string;
  folder?: string;
  submitted: boolean;
  open: boolean;
  onClose: () => void;
  onToggle: (photoId: string) => void;
  onSubmitted: (count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
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

  async function submit() {
    if (pending || submitted || !selected.length) return;
    setPending(true);
    const form = new FormData();
    form.set("slug", slug);
    if (folder) form.set("folder", folder);
    const result = await submitPhotoSelection(form);
    setPending(false);
    if (result.ok) {
      setDone(`${result.count} ${result.count === 1 ? "photo" : "photos"} have been sent to the photographer.`);
      onSubmitted(result.count);
    } else {
      setDone(result.error);
    }
  }

  return (
    <dialog className="client-review" ref={dialog}>
      {done ? (
        <div className="client-review-success" aria-live="polite">
          <h2>Selection submitted</h2>
          <p>{done}</p>
          <button className="client-submit-button" onClick={() => dialog.current?.close()} type="button">Done</button>
        </div>
      ) : (
        <div className="client-review-body">
          <header className="client-review-head">
            <div>
              <h2>Your selection</h2>
              <p className="client-review-count">
                {selected.length} {selected.length === 1 ? "photo" : "photos"} selected
              </p>
            </div>
            {open ? <button aria-label="Close" className="client-review-close" onClick={onClose} type="button"><span aria-hidden="true">×</span></button> : null}
          </header>
          {selected.length ? (
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
                    <button aria-label="Remove from selection" onClick={() => onToggle(photo.id)} title="Remove from selection" type="button">
                      <Heart fill="currentColor" size={13} strokeWidth={1.8} />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="client-empty">Nothing selected in this set.</p>
          )}
          <footer className="client-review-foot">
            <button className="client-clear-button" onClick={onClose} type="button">Close</button>
            {selected.length ? (
              <button className="client-submit-button" disabled={pending || submitted} onClick={() => void submit()} type="button">
                <Send size={14} strokeWidth={1.8} /> {pending ? "Submitting…" : "Submit selection"}
              </button>
            ) : null}
          </footer>
        </div>
      )}
    </dialog>
  );
}