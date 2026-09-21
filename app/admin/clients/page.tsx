import { adminDb } from "@/lib/admin-data";
import { adminError } from "@/lib/admin-validation";
import { ClientList } from "@/components/admin/client-list";

export default async function Clients({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = adminError(error);
  const db = await adminDb();
  const [{ data: clientRows }, { data: galleryRows }] = await Promise.all([
    db.from("clients").select("id,name,event_date,phone,created_at").order("created_at", { ascending: false }),
    db.from("galleries").select("client_id,status"),
  ]);
  const galleryStats = new Map<string, { total: number; published: number }>();
  for (const gallery of galleryRows ?? []) {
    const current = galleryStats.get(gallery.client_id) ?? { total: 0, published: 0 };
    current.total += 1;
    if (gallery.status === "published") current.published += 1;
    galleryStats.set(gallery.client_id, current);
  }
  const clients = (clientRows ?? []).map(client => ({
    ...client,
    galleryCount: galleryStats.get(client.id)?.total ?? 0,
    publishedGalleryCount: galleryStats.get(client.id)?.published ?? 0,
  }));

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">STUDIO MANAGEMENT</p>
          <h1>Clients</h1>
        </div>
      </div>
      <div className="admin-panel table-panel">
        <ClientList clients={clients} error={message} />
      </div>
    </section>
  );
}