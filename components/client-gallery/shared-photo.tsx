"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { downloadSharedPhoto } from "@/app/(client-gallery)/gallery/actions";

export function SharedPhoto({
  galleryTitle,
  gallerySlug,
  galleryPublished,
  src,
  photo,
  token,
}: {
  galleryTitle: string;
  gallerySlug: string | null;
  galleryPublished: boolean;
  src: string;
  photo: { filename: string; width: number | null; height: number | null };
  token: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(text: string) {
    setNotice(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 2600);
  }

  async function share() {
    const url = window.location.href;
    const data = { title: `${galleryTitle} — a shared photograph`, url };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        // User cancelled; fall back to copying the link.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showNotice("Link copied");
    } catch {
      showNotice("Could not copy the link.");
    }
  }

  async function download() {
    if (pending) return;
    setPending(true);
    const form = new FormData();
    form.set("token", token);
    const result = await downloadSharedPhoto(form);
    setPending(false);
    if (!result.url || !result.filename) {
      showNotice(result.error ?? "Download is unavailable right now.");
      return;
    }
    const url = result.url;
    const filename = result.filename;
    showNotice("Starting download…");
    fetch(url).then(res => res.blob()).then(blob => {
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    }).catch(() => {
      window.open(url, "_blank", "noopener");
    });
  }

  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : "3 / 4";

  return (
    <div className="shared-photo-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={`Photograph from ${galleryTitle}`} className="shared-photo-image" decoding="async" height={photo.height ?? undefined} src={src} style={{ aspectRatio: ratio }} width={photo.width ?? undefined} />
      <p className="shared-photo-caption">{photo.filename}</p>
      <div className="shared-photo-actions">
        {galleryPublished && gallerySlug ? <Link className="client-submit-button is-borderless" href={`/gallery/${gallerySlug}`}>View the full gallery</Link> : null}
        <button className="client-submit-button" onClick={() => void share()} type="button">Share</button>
        <button className="client-submit-button is-secondary" disabled={pending} onClick={() => void download()} type="button">{pending ? "Preparing…" : "Download"}</button>
      </div>
      {notice ? <p aria-live="polite" className="shared-photo-notice" role="status">{notice}</p> : null}
    </div>
  );
}