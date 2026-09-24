import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryOverview, type GallerySet } from "@/components/client-gallery/gallery-overview";
import { GalleryShell } from "@/components/client-gallery/gallery-shell";
import { GalleryHighlight } from "@/components/public/gallery-highlight";
import { resolveGalleryAccess } from "@/lib/gallery-access";
import { currentProfile } from "@/lib/gallery-profile";
import { galleryFolders, galleryFolderPhotos, selectedPhotoIds, viewerSubmission, clientSelectedPhotoIds } from "@/lib/gallery-data";
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

  const [folders, selected] = await Promise.all([
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, profileId),
  ]);

  // Client-tier data only loads for CLIENT sessions: the official selection and
  // its submission state are never exposed to viewer sessions.
  const client = access.role === "client" && profile ? {
    selected: await clientSelectedPhotoIds(access.gallery.id, profile.id),
    submission: await viewerSubmission(access.gallery.id, profile.id),
  } : { selected: new Set<string>(), submission: null };

  const [branding, contact] = await Promise.all([getSiteBranding(), getSiteContact()]);

  // Folders stay grouped — no flattening. Each published set (ordered by
  // sort_order) keeps its own photos (ordered by sort_order) and the gallery
  // presents every set in one continuous scroll with a set heading.
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
      {highlight ? (
        <section className="client-hero">
          <GalleryHighlight url={highlight.url} width={highlight.width} height={highlight.height} crop={null} />
          <div aria-hidden="true" className="client-hero-caption">
            <span className="client-hero-title">{access.gallery.title}</span>
            <span className="client-hero-brand">{brand}</span>
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