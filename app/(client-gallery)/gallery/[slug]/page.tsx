import { notFound } from "next/navigation";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryOverview } from "@/components/client-gallery/gallery-overview";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolders, galleryFolderPhotos, galleryClient, selectedPhotoIds } from "@/lib/gallery-data";

export default async function ClientGalleryHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") return <GalleryGate slug={access.slug} />;
  const [folders, selected, client] = await Promise.all([
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, await viewerKeyHash()),
    galleryClient(access.gallery.id),
  ]);
  const sets = await Promise.all(folders.map(async folder => ({
    id: folder.id,
    name: folder.name,
    slug: folder.slug,
    photos: (await galleryFolderPhotos(access.gallery.id, folder.slug)).map(photo => ({ ...photo, selected: selected.has(photo.id) })),
  })));
  const favouritePhotos = sets.flatMap(set => set.photos).filter((photo, index, all) => selected.has(photo.id) && all.findIndex(candidate => candidate.id === photo.id) === index);
  if (favouritePhotos.length) sets.push({ id: "favourites", name: "Fav", slug: "fav", photos: favouritePhotos });

  const eventLine = client
    ? [client.name, client.event_date ? new Date(client.event_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null].filter(Boolean).join(" · ")
    : null;

  const hero = folders.find(folder => folder.coverUrl);
  const heroImage = hero?.coverUrl ?? null;

  return (
    <main className="client-gallery-frame">
      {heroImage ? (
        <header className="client-hero has-cover">
          {/* Signed preview URL; next/image is a poor fit for short-lived tokens. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="client-hero-image" decoding="async" src={heroImage} width={hero?.coverWidth ?? undefined} height={hero?.coverHeight ?? undefined} />
          <div className="client-hero-shade" />
          <div className="client-hero-inner">
            <p className="client-gallery-brand">DESTINY<span>PRIVATE GALLERY</span></p>
            <h1>{access.gallery.title}</h1>
            {eventLine ? <p className="client-event">{eventLine}</p> : null}
            {access.gallery.description ? <p className="client-hero-lede">{access.gallery.description}</p> : null}
            {folders.length ? <a className="client-hero-cta" href="#client-gallery-grid">View gallery</a> : null}
          </div>
        </header>
      ) : (
        <header className="client-hero">
          <p className="client-gallery-brand">DESTINY<span>PRIVATE GALLERY</span></p>
          <h1>{access.gallery.title}</h1>
          {eventLine ? <p className="client-event">{eventLine}</p> : null}
          {access.gallery.description ? <p className="lede">{access.gallery.description}</p> : null}
        </header>
      )}
      <GalleryOverview selectedIds={[...selected]} sets={sets} slug={access.gallery.slug} />
    </main>
  );
}