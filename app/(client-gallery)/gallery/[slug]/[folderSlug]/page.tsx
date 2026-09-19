import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { GalleryWorkspace } from "@/components/client-gallery/gallery-workspace";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolder, selectedPhotoIds, viewerSubmission } from "@/lib/gallery-data";

export default async function ClientFolderPage({ params }: { params: Promise<{ slug: string; folderSlug: string }> }) {
  const { slug, folderSlug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") return <GalleryGate slug={access.slug} />;
  const [folderData, selected, submission] = await Promise.all([
    galleryFolder(access.gallery.id, folderSlug),
    selectedPhotoIds(access.gallery.id, await viewerKeyHash()),
    viewerSubmission(access.gallery.id, await viewerKeyHash()),
  ]);
  if (!folderData) notFound();
  const photos = folderData.photos.map(photo => ({ ...photo, selected: selected.has(photo.id) }));

  return (
    <main className="client-gallery-frame">
      <Link className="client-back" href={`/gallery/${access.gallery.slug}`}>← {access.gallery.title}</Link>
      <h1>{folderData.folder.name}</h1>
      <p className="client-count">{photos.length} {photos.length === 1 ? "photo" : "photos"}</p>
      {photos.length ? (
        <GalleryWorkspace folder={folderData.folder.slug} photos={photos} slug={access.gallery.slug} submittedInitially={Boolean(submission)} />
      ) : (
        <p className="client-empty">This folder does not have any photographs yet.</p>
      )}
    </main>
  );
}
