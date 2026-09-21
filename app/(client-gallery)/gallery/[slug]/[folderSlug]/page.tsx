import { notFound, redirect } from "next/navigation";
import { GalleryGate } from "@/components/client-gallery/gallery-gate";
import { resolveGalleryAccess } from "@/lib/gallery-access";

export default async function ClientFolderPage({ params }: { params: Promise<{ slug: string; folderSlug: string }> }) {
  const { slug } = await params;
  const access = await resolveGalleryAccess(slug);
  if (access.state === "unavailable") notFound();
  if (access.state === "password") return <GalleryGate slug={access.slug} />;
  redirect(`/gallery/${access.gallery.slug}`);
}
