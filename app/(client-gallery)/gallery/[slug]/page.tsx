import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { HomeSelectionBar } from "@/components/client-gallery/home-selection-bar";
import { resolveGalleryAccess, viewerKeyHash } from "@/lib/gallery-access";
import { galleryFolders, selectedPhotoIds, viewerSubmission } from "@/lib/gallery-data";

export default async function ClientGalleryHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") return <GalleryGate slug={access.slug} />;
  const [folders, selected, submission] = await Promise.all([
    galleryFolders(access.gallery.id),
    selectedPhotoIds(access.gallery.id, await viewerKeyHash()),
    viewerSubmission(access.gallery.id, await viewerKeyHash()),
  ]);

  return (
    <main className="client-gallery-frame">
      <p className="client-gallery-brand">DESTINY<span>PRIVATE GALLERY</span></p>
      <h1>{access.gallery.title}</h1>
      {access.gallery.description ? <p className="lede">{access.gallery.description}</p> : null}
      {!folders.length ? (
        <p className="client-empty">This gallery does not have any folders yet.</p>
      ) : (
        <div className="client-folder-grid">
          {folders.map(folder => (
            <Link className="client-folder" href={`/gallery/${access.gallery.slug}/${folder.slug}`} key={folder.id}>
              <div className="client-folder-cover">
                {folder.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" height={folder.coverHeight ?? undefined} src={folder.coverUrl} width={folder.coverWidth ?? undefined} />
                ) : null}
              </div>
              <strong>{folder.name}</strong>
              <span>{folder.photoCount} {folder.photoCount === 1 ? "photo" : "photos"}</span>
            </Link>
          ))}
        </div>
      )}
      <HomeSelectionBar count={selected.size} slug={access.gallery.slug} submitted={Boolean(submission)} />
    </main>
  );
}
