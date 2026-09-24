"use client";

import { useState } from "react";
import { useAnimatedDialog } from "@/components/client-gallery/use-animated-dialog";

export function GalleryDownloadDialog({
  slug, title, setId, setSlug, setName, onClose,
}: { slug: string; title: string; setId: string; setSlug: string; setName: string; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dialogRef, closing } = useAnimatedDialog({ open: true, onClose });

  async function downloadAll() {
    if (pending) return;
    if (!pin.trim()) { setError("Enter the download PIN."); return; }
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("pin", pin);
      form.set("set_id", setId);
      form.set("set_slug", setSlug);
      const response = await fetch("/api/gallery/" + encodeURIComponent(slug) + "/download.zip", { method: "POST", body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setError(payload?.error || "The set download could not be started. Check the PIN and try again.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || ((title || "gallery").replace(/[^a-z0-9_-]+/gi, "-") + "-" + (setName || "photos").replace(/[^a-z0-9_-]+/gi, "-") + ".zip");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("The download could not be started. Please try again.");
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
          <p id="client-gallery-download-sub">Enter the PIN for this set to download every photo in this set as one ZIP file.</p>
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
