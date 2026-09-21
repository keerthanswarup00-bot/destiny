import Link from "next/link";
import { Images } from "lucide-react";
import { adminDb } from "@/lib/admin-data";
import { galleryOverviews } from "@/lib/gallery-data";

export default async function PhotosPage() {
  const db = await adminDb();
  const { data: galleries } = await db
    .from("galleries")
    .select("id,title,status,client_id,created_at")
    .order("created_at", { ascending: false });
  const [{ data: clients }, overviews] = await Promise.all([
    db.from("clients").select("id,name").order("name"),
    galleryOverviews(galleries?.map(gallery => gallery.id) ?? []),
  ]);
  const clientNames = new Map((clients ?? []).map(client => [client.id, client.name]));

  const rows = (galleries ?? []).map(gallery => {
    const overview = overviews.get(gallery.id);
    return {
      id: gallery.id,
      title: gallery.title,
      status: gallery.status,
      clientName: clientNames.get(gallery.client_id) ?? null,
      setCount: overview?.setCount ?? 0,
      photoCount: overview?.photoCount ?? 0,
      coverUrl: overview?.coverUrl ?? null,
    };
  });

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">CONTENT</p>
          <h1>Photos</h1>
          <p className="muted">Every collection and its photos, grouped by gallery set. Open a set to upload, arrange, and manage its photos and cover.</p>
        </div>
        <p className="hint">{rows.length} galleries</p>
      </div>
      {rows.length ? (
        <div className="photos-grid">
          {rows.map(gallery => (
            <Link className="photo-card" href={`/admin/galleries/${gallery.id}`} key={gallery.id}>
              <div className="photo-card__cover">
                {gallery.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={gallery.coverUrl} />
                ) : (
                  <span><Images size={20} /></span>
                )}
                <span className={`status-pill ${gallery.status}`}>{gallery.status}</span>
              </div>
              <div className="photo-card__body">
                <strong>{gallery.title}</strong>
                <span>{gallery.clientName ?? "—"}</span>
                <p>{gallery.photoCount} photos{gallery.setCount ? ` · ${gallery.setCount} sets` : ""}</p>
                <em>Open photos →</em>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="admin-panel"><p className="empty">No galleries yet. Create a collection in Gallery Sets to start managing photos.</p></div>
      )}
    </section>
  );
}