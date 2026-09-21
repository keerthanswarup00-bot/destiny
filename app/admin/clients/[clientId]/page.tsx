import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientDetailActions, DeleteClientForm, NewGalleryButton } from "@/components/admin/client-detail-actions";
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
    db.from("clients").select("id,name,event_date,phone,notes").eq("id", clientId).maybeSingle(),
    db.from("galleries").select("id,title,status,created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();
  const galleryIds = (galleries ?? []).map(gallery => gallery.id);
  const { data: photoRows } = galleryIds.length
    ? await db.from("photos").select("gallery_id").in("gallery_id", galleryIds)
    : { data: [] as { gallery_id: string }[] };
  const galleryError = error === "invalid-gallery" || error === "gallery-create" ? message : null;
  const clientError = error === "invalid-client" || error === "client-has-galleries" ? message : null;
  const photoCounts = new Map<string, number>();
  for (const photo of photoRows ?? []) photoCounts.set(photo.gallery_id, (photoCounts.get(photo.gallery_id) ?? 0) + 1);

  return (
    <section className="admin-content">
      <Link className="back" href="/admin/clients">← Clients</Link>
      <div className="admin-title client-detail-title">
        <div>
          <p className="eyebrow">CLIENT</p>
          <h1>{client.name}</h1>
          <p className="muted">{client.event_date ?? "No date on file"}</p>
        </div>
        <ClientDetailActions client={client} clientError={clientError} galleryError={galleryError} />
      </div>
      <div className="admin-panel">
        <div className="panel-heading">
          <h2>Galleries</h2>
          <span>{galleries?.length ?? 0} total</span>
        </div>
        {galleries?.length ? galleries.map(gallery => (
          <Link className="client-gallery-row" href={`/admin/galleries/${gallery.id}`} key={gallery.id}>
            <span>
              <strong>{gallery.title}</strong>
              <small>{photoCounts.get(gallery.id) ?? 0} {(photoCounts.get(gallery.id) ?? 0) === 1 ? "photo" : "photos"}</small>
            </span>
            <span className={`status-pill ${gallery.status}`}>{gallery.status}</span>
            <span>{new Date(gallery.created_at).toLocaleDateString()}</span>
            <strong>Open →</strong>
          </Link>
        )) : (
          <div className="client-empty">
            <strong>No galleries yet</strong>
            <p>Create your first gallery for {client.name}.</p>
            <NewGalleryButton clientId={client.id} />
          </div>
        )}
      </div>
      <div className="admin-panel settings-card danger-card">
        <h2>Delete client</h2>
        <p className="empty">This removes the client and their contact details. Galleries must be deleted first.</p>
        <DeleteClientForm clientId={client.id} error={clientError} />
      </div>
    </section>
  );
}
