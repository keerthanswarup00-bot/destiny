import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { HomeSelectionBar } from "@/components/client-gallery/home-selection-bar";
import { FolderCover } from "@/components/client-gallery/folder-cover";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolders, galleryClient, selectedPhotoIds, viewerSubmission } from "@/lib/gallery-data";

export default async function ClientGalleryHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") return <GalleryGate slug={access.slug} />;
  const [folders, selected, submission, client] = await Promise.all([
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, await viewerKeyHash()),
    viewerSubmission(access.gallery.id, await viewerKeyHash()),
    galleryClient(access.gallery.id),
  ]);

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
            {folders.length ? <a className="client-hero-cta" href="#client-folder-grid">View gallery</a> : null}
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
      {folders.length ? (
        <>
          <nav aria-label="Sets" className="client-setnav">
            <span className="client-setnav-label">Overview</span>
            {folders.map(folder => (
              <Link className="client-setnav-link" href={`/gallery/${access.gallery.slug}/${folder.slug}`} key={folder.id}>
                {folder.name}
              </Link>
            ))}
          </nav>
          <div className="client-folder-grid" id="client-folder-grid">
            {folders.map((folder, index) => (
              <Link className="client-folder" href={`/gallery/${access.gallery.slug}/${folder.slug}`} key={folder.id}>
                <div
                  className="client-folder-cover"
                  style={folder.coverWidth && folder.coverHeight ? { aspectRatio: `${folder.coverWidth} / ${folder.coverHeight}` } : undefined}
                >
                  {folder.coverUrl ? (
                    <FolderCover alt={`${folder.name} — highlight image`} fallback={String(index + 1).padStart(2, "0")} height={folder.coverHeight} src={folder.coverUrl} width={folder.coverWidth} />
                  ) : (
                    <span className="client-folder-blank">{String(index + 1).padStart(2, "0")}</span>
                  )}
                </div>
                <div className="client-folder-info">
                  <span className="client-folder-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="client-folder-text">
                    <strong>{folder.name}</strong>
                    <span className="client-folder-meta">{folder.photoCount} {folder.photoCount === 1 ? "photo" : "photos"}</span>
                  </span>
                  <span aria-hidden="true" className="client-folder-arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="client-empty">This gallery does not have any sets yet.</p>
      )}
      <HomeSelectionBar count={selected.size} slug={access.gallery.slug} submitted={Boolean(submission)} />
    </main>
  );
}