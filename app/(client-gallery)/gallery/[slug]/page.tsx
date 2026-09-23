import { notFound } from "next/navigation";

import type { Metadata } from "next";
import { headers } from "next/headers";
import { Heart, MoreVertical } from "lucide-react";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryOverview, type GallerySet } from "@/components/client-gallery/gallery-overview";
import { GalleryHighlight } from "@/components/public/gallery-highlight";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolders, galleryFolderPhotos, selectedPhotoIds } from "@/lib/gallery-data";
import { GALLERY_SOCIAL_DESCRIPTION, GALLERY_SOCIAL_IMAGE_LONG_EDGE, galleryCoverImagePath, gallerySocialCover, requestHost, siteOrigin, socialCoverImageSize } from "@/lib/gallery-social";
import { getSiteBranding, getSiteContact } from "@/lib/site/site-content";
import { SiteFooter } from "@/components/public/site-footer";

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * Social/link-preview metadata (WhatsApp, Facebook, Messenger, iMessage,
 * Twitter/X, ...) for shared gallery links. og:image always points at the
 * controlled public cover route serving ONLY the gallery highlight photo — the
 * private gallery itself is never opened up for the crawler.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const headerList = await headers();
  const origin = siteOrigin(requestHost(headerList));
  const url = `${origin}/gallery/${slug}`;

  const cover = await gallerySocialCover(slug, "full");
  const title = (cover?.title?.trim() || slug).trim();
  const description = GALLERY_SOCIAL_DESCRIPTION;

  let images: OgImage[] | undefined;
  if (cover?.path) {
    const size = socialCoverImageSize(cover, GALLERY_SOCIAL_IMAGE_LONG_EDGE);
    images = [{
      url: `${origin}${galleryCoverImagePath(slug)}`,
      width: size?.width,
      height: size?.height,
      alt: title,
    }];
  } else {
    const branding = await getSiteBranding();
    if (branding.socialImageUrl) {
      images = [{ url: branding.socialImageUrl, width: 1200, height: 630, alt: title }];
    }
  }

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: title,
      type: "website",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images ? images.map(image => image.url) : undefined,
    },
  };
}

export default async function ClientGalleryHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") {
    const [branding, contact] = await Promise.all([getSiteBranding(), getSiteContact()]);
    return (
      <>
        <GalleryGate slug={access.slug} />
        <SiteFooter
          brandName={branding.brand_name}
          shortName={branding.short_name}
          tagline={branding.tagline}
          blurb={contact.description || "Intentional photography for celebrations, events, and the moments in between."}
          email={contact.email}
          phone={contact.phone}
          whatsapp={contact.whatsapp}
          location={contact.location}
          instagram={contact.instagram}
        />
      </>
    );
  }
  const [folders, selected, branding, contact] = await Promise.all([
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, await viewerKeyHash()),
    getSiteBranding(),
    getSiteContact(),
  ]);

  // Folders stay grouped — no flattening. Each published set (ordered by
  // sort_order) keeps its own photos (ordered by sort_order) and drives the
  // set navigation; one set is shown at a time.
  const sets: GallerySet[] = [];
  for (const folder of folders) {
    const folderPhotos = await galleryFolderPhotos(access.gallery.id, folder.slug);
    sets.push({
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      photos: folderPhotos.map(photo => ({ ...photo, selected: selected.has(photo.id) })),
    });
  }

  // Gallery highlight/cover: the first published set that has a configured
  // cover. Selection matches the pre-existing logic — explicit cover_photo_id
  // within the set, else the set's first photo — with the signed client-facing
  // URLs already provided by galleryFolders. The full-screen viewer uses the
  // high-resolution derivative (coverFullUrl) so it never upscales a thumbnail.
  const cover = folders.find(folder => folder.coverUrl) ?? null;
  const highlight = cover ? { url: (cover.coverFullUrl ?? cover.coverUrl) as string, width: cover.coverWidth, height: cover.coverHeight } : null;

  const brand = branding.short_name || "DESTINY";

  return (
    <>
      <main className="client-gallery-frame">
        {highlight ? (
          <GalleryHighlight url={highlight.url} width={highlight.width} height={highlight.height} crop={null} />
        ) : null}
        <header className="client-topbar">
          <h1 className="client-topbar-title">{access.gallery.title}</h1>
          <div className="client-topbar-actions">
            <button aria-label="Favourites" className="client-topbar-action" title="Favourites" type="button">
              <Heart size={20} strokeWidth={1.6} />
            </button>
            <button aria-label="More options" className="client-topbar-action" title="More options" type="button">
              <MoreVertical size={20} strokeWidth={1.6} />
            </button>
          </div>
          <p className="client-topbar-brand">{brand}</p>
        </header>
        <GalleryOverview sets={sets} selectedIds={[...selected]} slug={access.gallery.slug} />
      </main>
      <SiteFooter
        brandName={branding.brand_name}
        shortName={branding.short_name}
        tagline={branding.tagline}
        blurb={contact.description || "Intentional photography for celebrations, events, and the moments in between."}
        email={contact.email}
        phone={contact.phone}
        whatsapp={contact.whatsapp}
        location={contact.location}
        instagram={contact.instagram}
      />
    </>
  );
}