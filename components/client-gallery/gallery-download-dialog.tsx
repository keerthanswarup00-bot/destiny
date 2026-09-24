"use client";

import { useState } from "react";
import { useAnimatedDialog } from "@/components/client-gallery/use-animated-dialog";

export function GalleryDownloadDialog({
  slug, title, setId, setName, onClose,
}: { slug: string; title: string; setId: string; setName: string; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dialogRef, closing } = useAnimatedDialog({ open: true, onClose });

  async function requestDownload() {
    const form = new FormData();
    form.set("pin", pin);

    const response = await fetch(
      "/api/gallery/" + encodeURIComponent(slug) + "/sets/" + encodeURIComponent(setId) + "/download.zip",
      { method: "POST", body: form },
    );
    const payload = await response.json().catch(() => null) as {
      status?: "ready" | "preparing";
      url?: string;
      filename?: string;
      error?: string;
    } | null;

    if (response.status === 202 || payload?.status === "preparing") return null;

    if (!response.ok) {
      throw new Error(payload?.error || "The set download could not be started. Check the PIN and try again.");
    }

    if (!payload?.url) {
      throw new Error(payload?.error || "The set download could not be prepared. Please try again.");
    }

    return payload;
  }

  async function downloadAll() {
    if (pending) return;
    if (!pin.trim()) {
      setError("Enter the download PIN.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      let payload = await requestDownload();

      if (!payload) {
        for (let attempt = 0; attempt < 90; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          payload = await requestDownload();
          if (payload) break;
        }
      }

      if (!payload) {
        throw new Error("The set is still being prepared. Please try again in a moment.");
      }

      const anchor = document.createElement("a");
      anchor.href = payload.url!;
      anchor.download = payload.filename || (
        (title || "gallery").replace(/[^a-z0-9_-]+/gi, "-") +
        "-" +
        (setName || "photos").replace(/[^a-z0-9_-]+/gi, "-") +
        ".zip"
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "The download could not be started. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      aria-describedby="client-gallery-download-sub"
      aria-labelledby="client-gallery-download-title"
      className={"client-favorites-dialog" + (closing ? " is-closing" : "")}
      ref={dialogRef}
    >
      <form onSubmit={event => { event.preventDefault(); void downloadAll(); }}>
        <div>
          <h2 id="client-gallery-download-title">Download {setName}</h2>
          <p id="client-gallery-download-sub">
            Enter the PIN for this set to download every photo in this set as one ZIP file.
          </p>
        </div>
        <input
          aria-label="Set download PIN"
          autoComplete="current-password"
          autoFocus
          disabled={pending}
          inputMode="numeric"
          onChange={event => { setPin(event.target.value); if (error) setError(null); }}
          placeholder="Download PIN"
          type="password"
          value={pin}
        />
        {error ? <p className="client-favorites-error" role="alert">{error}</p> : null}
        <div className="client-favorites-actions">
          <button className="client-clear-button" disabled={pending} onClick={onClose} type="button">Cancel</button>
          <button className="client-submit-button" disabled={pending || !pin.trim()} type="submit">
            {pending ? "Preparing…" : "Download set"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
