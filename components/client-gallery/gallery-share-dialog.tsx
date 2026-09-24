"use client";

import { useRef, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
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
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  function handleClose() {
    setCopied(false);
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

  async function shareTo(platform: "messages" | "whatsapp" | "instagram" | "facebook") {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url || typeof window === "undefined") return;

    const text = title ? `${title} - Destiny gallery` : "Destiny gallery";
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(`${text}\n${url}`);

    if (platform === "instagram") {
      await copyLink();
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      return;
    }

    const target =
      platform === "messages"
        ? `sms:?body=${encodedText}`
        : platform === "whatsapp"
          ? `https://wa.me/?text=${encodedText}`
          : `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

    window.open(target, "_blank", "noopener,noreferrer");
  }

  return (
    <dialog
      aria-describedby="client-gallery-share-sub"
      aria-labelledby="client-gallery-share-title"
      className={"client-favorites-dialog client-share-dialog" + (closing ? " is-closing" : "")}
      ref={dialogRef}
    >
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <div>
          <h2 id="client-gallery-share-title">Share this gallery</h2>
          <p id="client-gallery-share-sub">
            Send this gallery link to family, friends, or anyone you want to share the photos with.
          </p>
        </div>

        <div className="client-share-options" aria-label="Share options">
          <button className="client-share-option" onClick={() => void shareTo("whatsapp")} type="button">
            <span className="client-share-option-icon client-share-option-whatsapp" aria-hidden="true">W</span>
            <span>WhatsApp</span>
          </button>
          <button className="client-share-option" onClick={() => void shareTo("messages")} type="button">
            <span className="client-share-option-icon"><MessageCircle size={18} strokeWidth={1.8} /></span>
            <span>Messages</span>
          </button>
          <button className="client-share-option" onClick={() => void shareTo("instagram")} type="button">
            <span className="client-share-option-icon client-share-option-instagram" aria-hidden="true">IG</span>
            <span>Instagram</span>
          </button>
          <button className="client-share-option" onClick={() => void shareTo("facebook")} type="button">
            <span className="client-share-option-icon client-share-option-facebook" aria-hidden="true">f</span>
            <span>Facebook</span>
          </button>
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
        {copied ? <p className="client-share-status" role="status">Link copied. Paste it into Instagram if needed.</p> : null}

        <div className="client-favorites-actions">
          <button className="client-clear-button" onClick={handleClose} type="button">
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
