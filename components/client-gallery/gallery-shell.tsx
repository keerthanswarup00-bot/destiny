"use client";

import { useEffect, useState, useRef, type Ref } from "react";
import { Download, Heart, MoreVertical, Play, Share2 } from "lucide-react";
import { GalleryOverview, type GalleryOverviewHandle, type GallerySet } from "@/components/client-gallery/gallery-overview";
import { ClientAccessDialog } from "@/components/client-gallery/client-access-dialog";
import { GalleryIdentityProvider, useGalleryIdentity } from "@/components/client-gallery/profile-identity";
import { GalleryDownloadDialog } from "@/components/client-gallery/gallery-download-dialog";
import { GalleryShareDialog } from "@/components/client-gallery/gallery-share-dialog";

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
  const [shareOpen, setShareOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [slideshowRequest, setSlideshowRequest] = useState(0);\n  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);\n  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [downloadSet, setDownloadSet] = useState<{ id: string; slug: string; name: string } | null>(() => {
    const firstSet = sets.find(set => set.photos.length > 0);
    return firstSet ? { id: firstSet.id, slug: firstSet.slug, name: firstSet.name } : null;
  });
  const overviewRef = useRef<GalleryOverviewHandle>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="client-topbar">
        <div className="client-topbar-head">
          <h1 className="client-topbar-title">{title}</h1>
          {role === "client" ? (
            <span className="client-client-badge" title="Full client access">Client</span>
          ) : null}
        </div>
        <div className="client-topbar-actions" ref={mobileMenuRef}>

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
            aria-label="Open gallery actions"
            aria-expanded={mobileMenuOpen}
            className="client-mobile-menu-trigger"
            onClick={() => setMobileMenuOpen(previous => !previous)}
            title="Gallery actions"
            type="button"
          >
            <MoreVertical size={20} strokeWidth={1.7} />
          </button>
          {mobileMenuOpen ? (
            <div aria-label="Gallery actions" className="client-mobile-menu" role="menu">
              <button
                className="client-mobile-menu-item"
                disabled={!downloadSet}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (downloadSet) setDownloadOpen(true);
                }}
                role="menuitem"
                type="button"
              >
                <Download size={16} strokeWidth={1.7} />
                Download
              </button>
              <button
                className="client-mobile-menu-item"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShareOpen(true);
                }}
                role="menuitem"
                type="button"
              >
                <Share2 size={16} strokeWidth={1.7} />
                Share
              </button>
              <button
                className="client-mobile-menu-item"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSlideshowRequest(previous => previous + 1);
                }}
                role="menuitem"
                type="button"
              >
                <Play size={15} strokeWidth={1.7} />
                Slideshow
              </button>
            </div>
          ) : null}
          <button
            aria-label="Download current set"
            className="client-topbar-action"
            disabled={!downloadSet}
            onClick={() => setDownloadOpen(true)}
            title={downloadSet ? `Download ${downloadSet.name}` : "Download current set"}
            type="button"
          >
            <Download size={20} strokeWidth={1.6} />
          </button>
          <button
            aria-label="Start slideshow"
            className="client-topbar-action"
            onClick={() => setSlideshowRequest(previous => previous + 1)}
            title="Start slideshow"
            type="button"
          >
            <Play size={18} strokeWidth={1.6} />
          </button>
          <button
            aria-label="Share the gallery"
            className="client-topbar-action"
            onClick={() => setShareOpen(true)}
            title="Share the gallery"
            type="button"
          >
            <Share2 size={20} strokeWidth={1.6} />
          </button>
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
          slideshowRequest={slideshowRequest}
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
          setId={downloadSet.id}
          setName={downloadSet.name}
          slug={slug}
          title={title}
        />
      ) : null}
      <GalleryShareDialog
        onClose={() => setShareOpen(false)}
        open={shareOpen}
        title={title}
      />
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
  onActiveSetChange?: (set: { id: string; slug: string; name: string }) => void;
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
