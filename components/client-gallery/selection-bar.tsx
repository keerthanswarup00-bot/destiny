"use client";

import { useRef, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { downloadGalleryPhotos, submitPhotoSelection } from "@/app/(client-gallery)/gallery/actions";

export function SelectionBar({
  slug,
  folder,
  count,
  submitted,
  error,
  photoIds,
  onSubmitted,
  onCleared,
  onReview,
}: {
  slug: string;
  folder?: string;
  count: number;
  submitted: boolean;
  error: string | null;
  photoIds?: string[];
  onSubmitted: () => void;
  onCleared?: () => void;
  onReview?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [clearing, setClearing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function submit() {
    const form = new FormData();
    form.set("slug", slug);
    if (folder) form.set("folder", folder);
    startTransition(async () => {
      const result = await submitPhotoSelection(form);
      dialog.current?.close();
      if (result.ok) {
        onSubmitted();
        setMessage(`${result.count} ${result.count === 1 ? "photo" : "photos"} have been sent to the photographer.`);
      } else {
        setMessage(result.error);
      }
    });
  }

  async function clear() {
    if (!onCleared) return;
    setClearing(true);
    await onCleared();
    setClearing(false);
  }

  async function download() {
    if (!photoIds?.length || downloading) return;
    setDownloading(true);
    setNotice(null);
    const form = new FormData();
    form.set("slug", slug);
    for (const id of photoIds) form.append("photo_id", id);
    const result = await downloadGalleryPhotos(form);
    setDownloading(false);
    if (result.error || !result.items.length) {
      setNotice(result.error ?? "The download could not be started.");
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
    setNotice(failures ? `${failures} ${failures === 1 ? "download" : "downloads"} could not be started.` : `${result.items.length} ${result.items.length === 1 ? "photo" : "photos"} downloaded.`);
  }

  if (submitted) {
    return (
      <p className="client-selection-bar is-submitted" aria-live="polite">
        <strong>Selection submitted</strong>
        <span>{message ?? `${count} ${count === 1 ? "photo" : "photos"} have been sent to the photographer.`}</span>
      </p>
    );
  }

  return (
    <>
      <p className="client-selection-bar" aria-live="polite">
        <span>{count} {count === 1 ? "photo" : "photos"} selected</span>
        {count > 0 ? (
          <>
            <button aria-label="Clear selection" className="client-clear-button" disabled={pending || clearing} onClick={() => void clear()} type="button">
              {clearing ? "Clearing…" : "Clear"}
            </button>
            {onReview ? (
              <button className="client-review-button" disabled={pending || clearing} onClick={onReview} type="button">
                Review selection
              </button>
            ) : null}
            {photoIds?.length ? (
              <button className="client-review-button client-download-button" disabled={pending || clearing || downloading} onClick={() => void download()} type="button">
                <Download size={14} strokeWidth={2} /> {downloading ? "Preparing…" : "Download"}
              </button>
            ) : null}
            <button className="client-submit-button" disabled={pending || clearing} onClick={() => dialog.current?.showModal()} type="button">
              {pending ? "Submitting…" : "Submit selection"}
            </button>
          </>
        ) : null}
      </p>
      {error ? <p className="client-bar-error" role="alert">{error}</p> : null}
      {notice ? <p aria-live="polite" className="client-bar-error is-ok" role="status">{notice}</p> : null}
      <dialog className="client-submit-dialog" ref={dialog}>
        <form method="dialog">
          <h2>Submit {count} selected {count === 1 ? "photo" : "photos"}?</h2>
          <p>Your selection will be sent to the photographer.</p>
          <menu>
            <button onClick={() => dialog.current?.close()} type="button">Cancel</button>
            <button className="client-submit-button" disabled={pending} onClick={submit} type="button">{pending ? "Submitting…" : "Submit selection"}</button>
          </menu>
        </form>
      </dialog>
    </>
  );
}