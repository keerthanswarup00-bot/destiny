import { notFound } from "next/navigation";
import { SetWorkspace } from "@/components/admin/set-workspace";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/admin-data";
import { GALLERY_ASSET_BUCKET } from "@/lib/admin-validation";

export default async function SetPage({ params }: { params: Promise<{ galleryId: string; folderId: string }> }) {
  const { galleryId, folderId } = await params;
  await requireAdmin();
  const db = await adminDb();
  const [
    { data: gallery },
    { data: folder },
    { data: folders },
    { data: photos },
  ] = await Promise.all([
    db.from("galleries").select("id,title,slug,status").eq("id", galleryId).maybeSingle(),
    db.from("folders").select("id,name,slug,description,published").eq("id", folderId).eq("gallery_id", galleryId).maybeSingle(),
    db.from("folders").select("id,name").eq("gallery_id", galleryId).order("sort_order").order("id"),
    db.from("photos").select("id,filename,width,height,thumbnail_path,preview_path,original_path,sort_order").eq("gallery_id", galleryId).eq("folder_id", folderId).order("sort_order").order("id"),
  ]);
  if (!gallery || !folder) notFound();

  const gridPaths = (photos ?? []).map(photo => photo.thumbnail_path || photo.preview_path || photo.original_path).filter(Boolean);
  const originalPaths = (photos ?? []).map(photo => photo.original_path).filter(Boolean);
  const [grid, originals] = await Promise.all([
    gridPaths.length ? db.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(gridPaths, 60 * 30) : Promise.resolve({ data: [] }),
    originalPaths.length ? db.storage.from(GALLERY_ASSET_BUCKET).createSignedUrls(originalPaths, 60 * 30) : Promise.resolve({ data: [] }),
  ]);
  const urlByPath = new Map((grid.data ?? []).map(item => [item.path, item.signedUrl]));
  const downloadByPath = new Map((originals.data ?? []).map(item => [item.path, item.signedUrl]));

  const photoCards = (photos ?? [])
    .map(photo => {
      const signable = photo.thumbnail_path || photo.preview_path || photo.original_path;
      return {
        id: photo.id,
        filename: photo.filename,
        width: photo.width,
        height: photo.height,
        src: urlByPath.get(signable) ?? "",
        downloadUrl: downloadByPath.get(photo.original_path) ?? "",
      };
    })
    .filter(photo => photo.src);

  return (
    <section className="admin-content">
      <SetWorkspace
        folder={{ id: folder.id, name: folder.name, slug: folder.slug, description: folder.description, published: folder.published }}
        gallery={{ id: gallery.id, title: gallery.title, slug: gallery.slug }}
        moveTargets={(folders ?? []).map(f => ({ id: f.id, name: f.name }))}
        photos={photoCards}
      />
    </section>
  );
}