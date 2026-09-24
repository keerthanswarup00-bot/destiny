import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryOverview, type GallerySet } from "@/components/client-gallery/gallery-overview";
import { GalleryShell } from "@/components/client-gallery/gallery-shell";
import { resolveGalleryAccess } from "@/lib/gallery-access";
import { currentProfile } from "@/lib/gallery-profile";
import { recordGalleryView } from "@/lib/gallery-views";
import { galleryClient, galleryClientHighlight, galleryFolders, galleryFolderPhotos, selectedPhotoIds, viewerSubmission, clientSelectedPhotoIds } from "@/lib/gallery-data";
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
  const profile = await currentProfile();
  const profileId = profile?.id ?? null;

  const [folders, selected, clientCard, highlightResult] = await Promise.all([
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, profileId),
    galleryClient(access.gallery.id),
    galleryClientHighlight(access.gallery.id),
  ]);

  // ONE gallery overview view is recorded per page load (admin-only analytics).
  // Never for set switches, lightbox or dialogs; failures are swallowed so the
  // gallery render is never affected.
  await recordGalleryView(access.gallery.id, profileId);

  // Client-tier data only loads for CLIENT sessions: the official selection and
  // its submission state are never exposed to viewer sessions.
  const client = access.role === "client" && profile ? {
    selected: await clientSelectedPhotoIds(access.gallery.id, profile.id),
    submission: await viewerSubmission(access.gallery.id, profile.id),
  } : { selected: new Set<string>(), submission: null };

  const [branding, contact] = await Promise.all([getSiteBranding(), getSiteContact()]);

  // Folders stay grouped — no flattening. Each published set (ordered by
  // sort_order) keeps its own photos (ordered by sort_order); the presentation
  // switches between sets via the set navigation, with the first published set
  // active on load.
  const sets: GallerySet[] = [];
  for (const folder of folders) {
    const folderPhotos = await galleryFolderPhotos(access.gallery.id, folder.slug);
    sets.push({
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      photos: folderPhotos.map(photo => ({ ...photo, selected: selected.has(photo.id), clientSelected: client.selected.has(photo.id) })),
    });
  }

  // Gallery-level highlight: the ONE photo set via the admin "Gallery
  // Highlight" editor (galleries.highlight_photo_id). It drives the full-screen
  // hero for the entire gallery — every set shares it. Folder-level covers are
  // never used as a client-facing hero; the full-screen hero uses the
  // high-resolution derivative so it never upscales a thumbnail.
  const highlight = highlightResult ? { url: (highlightResult.fullUrl ?? highlightResult.url) as string, width: highlightResult.width, height: highlightResult.height } : null;

  const brand = branding.short_name || "DESTINY";

  return (
    <>
      {highlight ? (
        <section className="client-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="client-hero-bg"
            decoding="async"
            fetchPriority="high"
            height={highlight.height ?? undefined}
            src={highlight.url}
            width={highlight.width ?? undefined}
          />
          <div aria-hidden="true" className="client-hero-scrim" />
          <div className="client-hero-content">
            <span className="client-hero-brand">{brand}</span>
            {clientCard?.name ? <p className="client-hero-title">{clientCard.name}</p> : null}
            <span className="client-hero-gallery">{access.gallery.title}</span>
            <a
              aria-label={`View the ${access.gallery.title} gallery`}
              className="client-hero-cta"
              href="#client-gallery-grid"
            >
              View gallery
            </a>
          </div>
        </section>
      ) : null}
      <main className="client-gallery-frame">
        <GalleryShell
          brand={brand}
          clientGate={access.clientGate}
          clientSelectedIds={[...client.selected]}
          identified={Boolean(profile)}
          role={access.role}
          selectedIds={[...selected]}
          sets={sets}
          slug={access.gallery.slug}
          submitted={Boolean(client.submission)}
          title={access.gallery.title}
        />
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