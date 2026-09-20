import Link from "next/link";
import { adminDb, dashboardCounts } from "@/lib/admin-data";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening.";
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

export default async function AdminOverview() {
  const [counts, db] = await Promise.all([dashboardCounts(), adminDb()]);
  const [{ data: clients }, { data: submissions }, { data: galleries }] = await Promise.all([
    db.from("clients").select("id,name,event_date,created_at").order("created_at", { ascending: false }).limit(5),
    db.from("selection_submissions").select("id,photo_count,status,submitted_at,galleries(id,title)").order("submitted_at", { ascending: false }).limit(5),
    db.from("galleries").select("id,title,status,client_id,created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const clientRows = clients ?? [];
  const submissionRows = submissions ?? [];
  const galleryRows = galleries ?? [];
  const { data: allClients } = await db.from("clients").select("id,name");
  const clientName = new Map((allClients ?? []).map(client => [client.id, client.name]));
  const stats = [["Clients", counts[0]], ["Active galleries", counts[1]], ["Photos", counts[2]], ["Pending selections", counts[3]]];

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>{greeting()}</h1>
        </div>
        <div className="quick-actions">
          <Link className="admin-button" href="/admin/clients">Add client</Link>
          <Link className="admin-button is-secondary" href="/admin/galleries">Add gallery</Link>
        </div>
      </div>
      <div className="stat-grid">
        {stats.map(([label, value]) => <article key={label}><p>{label}</p><strong>{value}</strong></article>)}
      </div>
      <div className="admin-panel">
        <div className="panel-heading"><h2>Recent galleries</h2><Link href="/admin/galleries">View all →</Link></div>
        {galleryRows.length ? galleryRows.map(gallery => (
          <Link className="recent-row" href={`/admin/galleries/${gallery.id}`} key={gallery.id}>
            <strong>{gallery.title}</strong>
            <span>{clientName.get(gallery.client_id) ?? "—"}</span>
            <span><span className={`status-pill ${gallery.status}`}>{gallery.status}</span></span>
            <span>→</span>
          </Link>
        )) : <p className="empty">No galleries yet. Create one to start sharing with clients.</p>}
      </div>
      <div className="admin-panel">
        <div className="panel-heading"><h2>Recent clients</h2><Link href="/admin/clients">View all →</Link></div>
        {clientRows.length ? clientRows.map(client => (
          <Link className="recent-row" href={`/admin/clients/${client.id}`} key={client.id}>
            <strong>{client.name}</strong>
            <span>{client.event_date ?? "—"}</span>
            <span>{new Date(client.created_at).toLocaleDateString()}</span>
            <span>→</span>
          </Link>
        )) : <p className="empty">No clients yet. Create your first client to start organizing galleries.</p>}
      </div>
      <div className="admin-panel">
        <div className="panel-heading"><h2>Recent selections</h2><Link href="/admin/galleries">View all →</Link></div>
        {submissionRows.length ? submissionRows.map(submission => {
          const gallery = Array.isArray(submission.galleries) ? submission.galleries[0] : submission.galleries;
          return (
            <Link className="recent-row" href={gallery?.id ? `/admin/galleries/${gallery.id}#submitted-selections` : "/admin/galleries"} key={submission.id}>
              <strong>{gallery?.title ?? "Unknown gallery"}</strong>
              <span>{submission.photo_count} {submission.photo_count === 1 ? "photo" : "photos"}</span>
              <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
              <span>→</span>
            </Link>
          );
        }) : <p className="empty">No selections yet. Clients submit their favourites from a published gallery link.</p>}
      </div>
    </section>
  );
}