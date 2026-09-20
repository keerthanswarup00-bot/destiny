import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedPhoto } from "@/components/client-gallery/shared-photo";
import { clientFacingObjectPath } from "@/lib/client-media";
import { signedClientUrls } from "@/lib/gallery-data";
import { photoFromShareToken } from "@/lib/photo-share";

export const dynamic = "force-dynamic";

export default async function SharedPhotoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await photoFromShareToken(token);
  if (!shared) notFound();
  const path = clientFacingObjectPath(shared.photo, "full");
  const urls = await signedClientUrls([path]);
  const src = urls.get(path);
  if (!src) notFound();

  return (
    <main className="shared-photo-page">
      <div className="shared-photo-shell">
        <p className="client-gallery-brand">DESTINY<span>SHARED PHOTO</span></p>
        <SharedPhoto
          galleryPublished={shared.galleryPublished}
          gallerySlug={shared.gallerySlug}
          galleryTitle={shared.galleryTitle}
          src={src}
          photo={{ filename: shared.photo.filename, height: shared.photo.height, width: shared.photo.width }}
          token={token}
        />
        <p className="shared-photo-context">
          Shared from <strong>{shared.galleryTitle}</strong>. This link opens exactly one photograph.
        </p>
        <p className="shared-photo-home">
          <Link href="/">destinyphotography</Link>
        </p>
      </div>
    </main>
  );
}