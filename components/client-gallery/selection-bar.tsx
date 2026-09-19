"use client";

import { useRef, useState, useTransition } from "react";
import { submitPhotoSelection } from "@/app/(client-gallery)/gallery/actions";

export function SelectionBar({
  slug,
  folder,
  count,
  submitted,
  error,
  onSubmitted,
}: {
  slug: string;
  folder?: string;
  count: number;
  submitted: boolean;
  error: string | null;
  onSubmitted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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
          <button className="client-submit-button" disabled={pending} onClick={() => dialog.current?.showModal()} type="button">
            {pending ? "Submitting…" : "Submit selection"}
          </button>
        ) : null}
      </p>
      {error ? <p className="client-bar-error" role="alert">{error}</p> : null}
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