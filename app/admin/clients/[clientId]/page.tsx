import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "@/app/admin/crud-actions";
import { GalleryForm } from "@/components/admin/gallery-form";
import { adminDb } from "@/lib/admin-data";
import { adminError } from "@/lib/admin-validation";

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { clientId } = await params;
  const { error } = await searchParams;
  const message = adminError(error);
  const db = await adminDb();
  const [{ data: client }, { data: galleries }] = await Promise.all([
    db.from("clients").select("id,name,email,phone,notes").eq("id", clientId).maybeSingle(),
    db.from("galleries").select("id,title,status,created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();
  const galleryError = error === "invalid-gallery" || error === "gallery-create" ? message : null;
  const clientError = error === "invalid-client" || error === "client-has-galleries" ? message : null;

  return (
    <section className="admin-content">
      <Link className="back" href="/admin/clients">← Clients</Link>
      <div className="admin-title">
        <div>
          <p className="eyebrow">CLIENT</p>
          <h1>{client.name}</h1>
          <p className="muted">{client.email ?? "No email on file"}</p>
        </div>
        <a className="admin-button" href="#gallery-form">Create gallery</a>
      </div>
      <form action={updateClient} className="admin-panel settings-card">
        <h2>Edit client</h2>
        {clientError ? <p className="form-error" role="alert">{clientError}</p> : null}
        <input name="id" type="hidden" value={client.id} />
        <label>Name<input defaultValue={client.name} maxLength={200} name="name" required /></label>
        <label>Email<input defaultValue={client.email ?? ""} name="email" type="email" /></label>
        <label>Phone<input defaultValue={client.phone ?? ""} maxLength={50} name="phone" /></label>
        <label>Notes<textarea defaultValue={client.notes ?? ""} maxLength={5000} name="notes" rows={4} /></label>
        <button className="admin-button">Save client</button>
      </form>
      <GalleryForm clientId={client.id} error={galleryError} />
      <div className="admin-panel">
        <div className="panel-heading">
          <h2>Galleries</h2>
          <span>{galleries?.length ?? 0} total</span>
        </div>
        {galleries?.length ? galleries.map(gallery => (
          <Link className="recent-row" href={`/admin/galleries/${gallery.id}`} key={gallery.id}>
            <strong>{gallery.title}</strong>
            <span>{gallery.status}</span>
            <span>{new Date(gallery.created_at).toLocaleDateString()}</span>
            <span>→</span>
          </Link>
        )) : <p className="empty">No galleries yet. Create one when you&apos;re ready.</p>}
      </div>
    </section>
  );
}
