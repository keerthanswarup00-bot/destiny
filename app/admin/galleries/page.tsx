import Link from "next/link";
import { GalleryForm } from "@/components/admin/gallery-form";
import { adminDb } from "@/lib/admin-data";
import { adminError } from "@/lib/admin-validation";

export default async function Galleries({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const db = await adminDb();
  const [{ data: galleries }, { data: clients }] = await Promise.all([
    db.from("galleries").select("id,title,status,client_id,created_at").order("created_at", { ascending: false }),
    db.from("clients").select("id,name").order("name"),
  ]);
  const clientNames = new Map((clients ?? []).map(client => [client.id, client.name]));

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">GALLERIES</p>
          <h1>Galleries</h1>
        </div>
        <a className="admin-button" href="#gallery-form">Create gallery</a>
      </div>
      {clients?.length ? (
        <GalleryForm clients={clients} error={adminError(error)} from="galleries" />
      ) : (
        <div className="admin-panel settings-card">
          <h2>Create gallery</h2>
          <p className="empty">Create a client before adding a gallery.</p>
          <Link className="admin-button" href="/admin/clients">Add client</Link>
        </div>
      )}
      <div className="admin-panel table-panel">
        <div className="table">
          <div className="table-row table-head"><span>Gallery</span><span>Client</span><span>Status</span><span>Created</span><span /></div>
          {(galleries ?? []).map(gallery => (
            <div className="table-row" key={gallery.id}>
              <Link href={`/admin/galleries/${gallery.id}`}><strong>{gallery.title}</strong></Link>
              <span>{clientNames.get(gallery.client_id) ?? "—"}</span>
              <span>{gallery.status}</span>
              <span>{new Date(gallery.created_at).toLocaleDateString()}</span>
              <Link href={`/admin/galleries/${gallery.id}`}>Open →</Link>
            </div>
          ))}
        </div>
        {!galleries?.length ? <p className="empty">No galleries yet. Create a gallery to start adding folders.</p> : null}
      </div>
    </section>
  );
}
