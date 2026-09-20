"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ label = "Copy link", text }: { label?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="admin-button is-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      type="button"
    >
      {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.8} />}
      {copied ? "Copied" : label}
    </button>
  );
}