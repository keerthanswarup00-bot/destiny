"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useAnimatedDialog } from "@/components/client-gallery/use-animated-dialog";

export function GalleryShareDialog({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { dialogRef, closing } = useAnimatedDialog({ open, onClose });

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setSharing(false);
    }
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (sharing || typeof navigator.share !== "function") return;

    setSharing(true);
    try {
      await navigator.share({
        title: title || "Destiny gallery",
        url: window.location.href,
      });
      onClose();
    } catch {
      // Keep the modal open when the native share sheet is cancelled.
    } finally {
      setSharing(false);
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <dialog
      aria-describedby="client-gallery-share-sub" aria-labelledby="client-gallery-share-title"
      className={"client-favorites-dialog" + (closing ? " is-closing" : "")}
      ref={dialogRef}
    >
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <div>
          <h2 id="client-gallery-share-title">Share this gallery</h2>
          <p id="client-gallery-share-sub">Send this gallery link to family, friends, or anyone you want to share the photos with.</p>
        </div>

        <div className="client-share-link">
          <input
            aria-label="Gallery link"
            readOnly
            value={typeof window !== "undefined" ? window.location.href : ""}
          />
          <button
            aria-label={copied ? "Link copied" : "Copy gallery link"}
            className="client-share-copy"
            onClick={() => void copyLink()}
            type="button"
          >
            {copied ? <Check size={16} strokeWidth={1.8} /> : <Copy size={16} strokeWidth={1.8} />}
          </button>
        </div>

        <div className="client-favorites-actions">
          <button className="client-clear-button" onClick={onClose} type="button">
            Cancel
          </button>
          {canNativeShare ? (
            <button
              className="client-submit-button"
              disabled={sharing}
              onClick={() => void shareLink()}
              type="button"
            >
              <Share2 size={15} strokeWidth={1.8} />
              {sharing ? "Sharing..." : "Share"}
            </button>
          ) : (
            <button className="client-submit-button" onClick={() => void copyLink()} type="button">
              {copied ? "Copied" : "Copy link"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
