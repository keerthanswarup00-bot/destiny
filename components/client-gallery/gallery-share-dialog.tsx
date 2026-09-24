"use client";

import { useRef, useState } from "react";
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
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  function handleClose() {
    setCopied(false);
    setSharing(false);
    onClose();
  }

  const { dialogRef, closing } = useAnimatedDialog({ open, onClose: handleClose });

  function syncLinkInput(node: HTMLInputElement | null) {
    linkInputRef.current = node;
    if (node && typeof window !== "undefined") {
      node.value = window.location.href;
    }
  }

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (sharing || typeof navigator === "undefined") return;

    const url = window.location.href;
    if (typeof navigator.share !== "function") {
      await copyLink();
      return;
    }

    setSharing(true);
    try {
      await navigator.share({
        title: title || "Destiny gallery",
        url,
      });
      handleClose();
    } catch {
      // Keep the modal open when the native share sheet is cancelled.
    } finally {
      setSharing(false);
    }
  }

  return (
    <dialog
      aria-describedby="client-gallery-share-sub"
      aria-labelledby="client-gallery-share-title"
      className={"client-favorites-dialog" + (closing ? " is-closing" : "")}
      ref={dialogRef}
    >
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <div>
          <h2 id="client-gallery-share-title">Share this gallery</h2>
          <p id="client-gallery-share-sub">
            Send this gallery link to family, friends, or anyone you want to share the photos with.
          </p>
        </div>

        <div className="client-share-link">
          <input
            aria-label="Gallery link"
            readOnly
            ref={syncLinkInput}
            defaultValue=""
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
          <button className="client-clear-button" onClick={handleClose} type="button">
            Cancel
          </button>
          <button
            className="client-submit-button"
            disabled={sharing}
            onClick={() => void shareLink()}
            type="button"
          >
            <Share2 size={15} strokeWidth={1.8} />
            {sharing ? "Sharing..." : "Share"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
