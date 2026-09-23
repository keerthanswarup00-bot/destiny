import { notFound } from "next/navigation";
import { Heart, MoreVertical } from "lucide-react";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryOverview } from "@/components/client-gallery/gallery-overview";
import { GalleryHighlight } from "@/components/public/gallery-highlight";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolders, galleryFolderPhotos, selectedPhotoIds } from "@/lib/gallery-data";
import { getSiteBranding, getSiteContact } from "@/lib/site/site-content";
import { SiteFooter } from "@/components/public/site-footer";

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

  // Keep each published set as a grouped section: ordered by folder.sort_order,
  // photos within by photo.sort_order. Published sets containing zero photos are
  // skipped entirely — no empty sections are rendered.
  const sets = (await Promise.all(folders.map(async folder => {
    const folderPhotos = await galleryFolderPhotos(access.gallery.id, folder.slug);
    if (!folderPhotos.length) return null;
    return {
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      photos: folderPhotos.map(photo => ({ ...photo, selected: selected.has(photo.id) })),
    };
  }))).filter((set): set is NonNullable<typeof set> => set !== null);

  // Gallery highlight/cover: the first published set that has a configured
  // cover. Selection matches the pre-existing logic — explicit cover_photo_id
  // within the set, else the set's first photo — with the signed client-facing
  // URL already provided by galleryFolders.
  const cover = folders.find(folder => folder.coverUrl) ?? null;
  const highlight = cover ? { url: cover.coverUrl as string, width: cover.coverWidth, height: cover.coverHeight } : null;

  const brand = branding.short_name || "DESTINY";

  return (
    <>
      <main className="client-gallery-frame">
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
        {highlight ? (
          <GalleryHighlight url={highlight.url} width={highlight.width} height={highlight.height} crop={null} />
        ) : null}
        <GalleryOverview selectedIds={[...selected]} sets={sets} slug={access.gallery.slug} />
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