"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { Download, Heart, Share2 } from "lucide-react";
import { GalleryOverview, type GalleryOverviewHandle, type GallerySet } from "@/components/client-gallery/gallery-overview";
import { ClientAccessDialog } from "@/components/client-gallery/client-access-dialog";
import { GalleryIdentityProvider, useGalleryIdentity } from "@/components/client-gallery/profile-identity";
import { GalleryDownloadDialog } from "@/components/client-gallery/gallery-download-dialog";

export function GalleryShell({
  slug,
  title,
  brand,
  sets,
  selectedIds,
  clientSelectedIds,
  identified,
  submitted,
  role,
  clientGate,
}: {
  slug: string;
  title: string;
  brand: string;
  sets: GallerySet[];
  selectedIds: string[];
  clientSelectedIds: string[];
  identified: boolean;
  submitted: boolean;
  role: "viewer" | "client";
  clientGate: boolean;
}) {
  const [count, setCount] = useState(selectedIds.length);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSet, setDownloadSet] = useState<{ slug: string; name: string } | null>(sets[0] ? { slug: sets[0].slug, name: sets[0].name } : null);
  const overviewRef = useRef<GalleryOverviewHandle>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (shareTimer.current) clearTimeout(shareTimer.current); }, []);

  // Reuses the existing gallery share link (the gallery page URL shown in the
  // admin "Share link" field) — no new URL/token system. Web Share API when
  // available, otherwise copy the link for pasting anywhere.
  async function shareGallery() {
    if (sharing) return;
    setSharing(true);
    try {
      const url = window.location.href;
      const data = { title: title || "Destiny gallery", url };
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
        setShareNote("Link copied");
      } catch {
        setShareNote("Could not copy the link.");
      }
      if (shareTimer.current) clearTimeout(shareTimer.current);
      shareTimer.current = setTimeout(() => setShareNote(null), 2200);
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <header className="client-topbar">
        <div className="client-topbar-head">
          <h1 className="client-topbar-title">{title}</h1>
          {role === "client" ? (
            <span className="client-client-badge" title="Full client access">Client</span>
          ) : null}
        </div>
        <div className="client-topbar-actions">
          <button
            aria-label={count ? `Favourites, ${count} ${count === 1 ? "photo" : "photos"} saved` : "Your favourites"}
            className={`client-topbar-action client-topbar-favorites${count > 0 ? " is-active" : ""}`}
            onClick={() => overviewRef.current?.openReview()}
            title={count ? `${count} ${count === 1 ? "favourite" : "favourites"}` : "Review favourites"}
            type="button"
          >
            <Heart size={20} strokeWidth={1.6} />
            {count > 0 ? <span className="client-topbar-count">{count}</span> : null}
          </button>
          <button
            aria-label="Download all photos"
            className="client-topbar-action"
            onClick={() => setDownloadOpen(true)}
            title="Download all photos"
            type="button"
          >
            <Download size={20} strokeWidth={1.6} />
          </button>
          <button
            aria-label="Share the gallery"
            aria-busy={sharing}
            className="client-topbar-action"
            onClick={() => void shareGallery()}
            title="Share the gallery"
            type="button"
          >
            <Share2 size={20} strokeWidth={1.6} />
          </button>
          {shareNote ? <span aria-live="polite" className="client-topbar-note" role="status">{shareNote}</span> : null}
        </div>
        {role !== "client" && clientGate ? (
          <div className="client-topbar-gate">
            <ClientAccessDialog slug={slug} />
          </div>
        ) : null}
        <p className="client-topbar-brand">{brand}</p>
      </header>
      <GalleryIdentityProvider initiallyIdentified={identified} slug={slug}>
        <GalleryInner
          clientMode={role === "client"}
          clientSelectedIds={clientSelectedIds}
          onCountChange={setCount}
          onActiveSetChange={setDownloadSet}
          ref={overviewRef}
          selectedIds={selectedIds}
          sets={sets}
          slug={slug}
          submitted={submitted}
        />
      </GalleryIdentityProvider>
      {downloadOpen && downloadSet ? (
        <GalleryDownloadDialog
          onClose={() => setDownloadOpen(false)}
          setSlug={downloadSet.slug}
          setName={downloadSet.name}
          slug={slug}
          title={title}
        />
      ) : null}
    </>
  );
}

function GalleryInner({
  slug,
  sets,
  selectedIds,
  clientSelectedIds,
  submitted,
  clientMode,
  onCountChange,
  onActiveSetChange,
  ref,
}: {
  slug: string;
  sets: GallerySet[];
  selectedIds: string[];
  clientSelectedIds: string[];
  submitted: boolean;
  clientMode?: boolean;
  onCountChange?: (count: number) => void;
  onActiveSetChange?: (set: { slug: string; name: string }) => void;
  ref?: Ref<GalleryOverviewHandle>;
}) {
  const { identified } = useGalleryIdentity();
  return (
    <GalleryOverview
      clientMode={clientMode}
      identified={identified}
      onCountChange={onCountChange}
      onActiveSetChange={onActiveSetChange}
      ref={ref}
      clientSelectedIds={clientSelectedIds}
      selectedIds={selectedIds}
      sets={sets}
      slug={slug}
      submitted={submitted}
    />
  );
}