"use client";

import { useState } from "react";

export function GalleryDownloadDialog({ slug, title, onClose }: { slug: string; title: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadAll() {
    if (pending) return;
    if (!email.trim() || !pin.trim()) {
      setError("Enter your email and PIN.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("email", email);
      form.set("pin", pin);

      const response = await fetch("/api/gallery/" + encodeURIComponent(slug) + "/download.zip", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setError(payload?.error || "The download could not be started. Check your email and PIN.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || ((title || "gallery").replace(/[^a-z0-9_-]+/gi, "-") + "-photos.zip");
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
    <dialog className="client-favorites-dialog" open>
      <form
        onSubmit={event => {
          event.preventDefault();
          void downloadAll();
        }}
      >
        <h2>Download all photos</h2>
        <p>Enter your email and gallery PIN to download all photos as one ZIP file.</p>
        <input
          aria-label="Your email"
          autoComplete="email"
          autoFocus
          disabled={pending}
          onChange={event => setEmail(event.target.value)}
          placeholder="Your email"
          type="email"
          value={email}
        />
        <input
          aria-label="Gallery PIN"
          autoComplete="current-password"
          disabled={pending}
          inputMode="numeric"
          onChange={event => setPin(event.target.value)}
          placeholder="Gallery PIN"
          type="password"
          value={pin}
        />
        {error ? <p className="client-favorites-error" role="alert">{error}</p> : null}
        <div className="client-favorites-actions">
          <button className="client-clear-button" disabled={pending} onClick={onClose} type="button">Cancel</button>
          <button className="client-submit-button" disabled={pending} type="submit">
            {pending ? "Preparing…" : "Download all"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
