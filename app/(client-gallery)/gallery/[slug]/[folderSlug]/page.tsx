import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryWorkspace } from "@/components/client-gallery/gallery-workspace";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolder, galleryFolders, selectedPhotoIds, viewerSubmission } from "@/lib/gallery-data";

export default async function ClientFolderPage({ params }: { params: Promise<{ slug: string; folderSlug: string }> }) {
  const { slug, folderSlug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") return <GalleryGate slug={access.slug} />;
  const [folderData, folders, selected, submission] = await Promise.all([
    galleryFolder(access.gallery.id, folderSlug),
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, await viewerKeyHash()),
    viewerSubmission(access.gallery.id, await viewerKeyHash()),
  ]);
  if (!folderData) notFound();
  const photos = folderData.photos.map(photo => ({ ...photo, selected: selected.has(photo.id) }));

  return (
    <main className="client-gallery-frame">
      <p className="client-gallery-brand">DESTINY<span>PRIVATE GALLERY</span></p>
      <Link className="client-back" href={`/gallery/${access.gallery.slug}`}>← {access.gallery.title}</Link>
      <nav aria-label="Sets" className="client-setnav">
        <Link className="client-setnav-link" href={`/gallery/${access.gallery.slug}`}>Overview</Link>
        {folders.map(folder => (
          <Link
            aria-current={folder.slug === folderSlug ? "page" : undefined}
            className={`client-setnav-link${folder.slug === folderSlug ? " is-active" : ""}`}
            href={`/gallery/${access.gallery.slug}/${folder.slug}`}
            key={folder.id}
          >
            {folder.name}
          </Link>
        ))}
      </nav>
      <h1>{folderData.folder.name}</h1>
      {folderData.folder.description ? <p className="lede client-set-description">{folderData.folder.description}</p> : null}
      <p className="client-count">
        {photos.length} {photos.length === 1 ? "photo" : "photos"}
        {selected.size > 0 ? <span className="client-selection-pill">♥ {selected.size} selected</span> : null}
      </p>
      {photos.length ? (
        <>
          <p className="client-hint">Tap the <span aria-hidden="true" className="heart">♥</span> on your favourites, then submit your selection when you&apos;re ready.</p>
          <GalleryWorkspace folder={folderData.folder.slug} photos={photos} slug={access.gallery.slug} submittedInitially={Boolean(submission)} />
        </>
      ) : (
        <p className="client-empty">This folder does not have any photographs yet.</p>
      )}
    </main>
  );
}