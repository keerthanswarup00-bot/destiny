import { GalleryCreateDialog } from "@/components/admin/gallery-create-dialog";
import { GalleriesView } from "@/components/admin/galleries-view";
import { adminDb } from "@/lib/admin-data";
import { adminError } from "@/lib/admin-validation";
import { galleryOverviews } from "@/lib/gallery-data";

export default async function Galleries({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const db = await adminDb();

  const { data: galleries } = await db.from("galleries").select("id,title,slug,status,client_id,created_at,password_hash,client_password_hash").order("created_at", { ascending: false });

  const [{ data: clients }, overviews] = await Promise.all([
    db.from("clients").select("id,name").order("name"),
    galleryOverviews(galleries?.map(gallery => gallery.id) ?? []),
  ]);
  const clientNames = new Map((clients ?? []).map(client => [client.id, client.name]));

  const items = (galleries ?? []).map(gallery => {
    const overview = overviews.get(gallery.id);
    return {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      status: gallery.status,
      clientName: clientNames.get(gallery.client_id) ?? null,
      photoCount: overview?.photoCount ?? 0,
      hasPassword: Boolean(gallery.password_hash || gallery.client_password_hash),
    };
  });

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">GALLERIES</p>
          <h1>Galleries</h1>
          <p className="muted">Create a gallery, upload photos, and share it with your client.</p>
        </div>
        <div className="galleries-actions">
          <GalleryCreateDialog clients={clients ?? []} error={adminError(error)} />
        </div>
      </div>
      <GalleriesView items={items} />
    </section>
  );
}