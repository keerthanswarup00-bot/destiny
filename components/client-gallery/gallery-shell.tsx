"use client";

import { useRef, useState, type Ref } from "react";
import { Heart, MoreVertical } from "lucide-react";
import { GalleryOverview, type GalleryOverviewHandle, type GallerySet } from "@/components/client-gallery/gallery-overview";
import { ClientAccessDialog } from "@/components/client-gallery/client-access-dialog";
import { GalleryIdentityProvider, useGalleryIdentity } from "@/components/client-gallery/profile-identity";

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
  const overviewRef = useRef<GalleryOverviewHandle>(null);

  return (
    <>
      <header className="client-topbar">
        <h1 className="client-topbar-title">{title}</h1>
        <div className="client-topbar-actions">
          {role === "client" ? (
            <span className="client-client-badge" title="Full client access">
              Client
            </span>
          ) : null}
          <button
            aria-label={count ? `Favourites, ${count} ${count === 1 ? "photo" : "photos"} selected` : "Favourites"}
            className={`client-topbar-action client-topbar-favorites${count > 0 ? " is-active" : ""}`}
            onClick={() => overviewRef.current?.openReview()}
            title={count ? `${count} ${count === 1 ? "favourite" : "favourites"}` : "Review favourites"}
            type="button"
          >
            <Heart size={20} strokeWidth={1.6} />
            {count > 0 ? <span className="client-topbar-count">{count}</span> : null}
          </button>
          {role !== "client" && clientGate ? <ClientAccessDialog slug={slug} /> : null}
          <button aria-label="More options" className="client-topbar-action" title="More options" type="button">
            <MoreVertical size={20} strokeWidth={1.6} />
          </button>
        </div>
        <p className="client-topbar-brand">{brand}</p>
      </header>
      <GalleryIdentityProvider initiallyIdentified={identified} slug={slug}>
        <GalleryInner
          clientMode={role === "client"}
          clientSelectedIds={clientSelectedIds}
          onCountChange={setCount}
          ref={overviewRef}
          selectedIds={selectedIds}
          sets={sets}
          slug={slug}
          submitted={submitted}
        />
      </GalleryIdentityProvider>
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
  ref,
}: {
  slug: string;
  sets: GallerySet[];
  selectedIds: string[];
  clientSelectedIds: string[];
  submitted: boolean;
  clientMode?: boolean;
  onCountChange?: (count: number) => void;
  ref?: Ref<GalleryOverviewHandle>;
}) {
  const { identified } = useGalleryIdentity();
  return (
    <GalleryOverview
      clientMode={clientMode}
      identified={identified}
      onCountChange={onCountChange}
      ref={ref}
      clientSelectedIds={clientSelectedIds}
      selectedIds={selectedIds}
      sets={sets}
      slug={slug}
      submitted={submitted}
    />
  );
}