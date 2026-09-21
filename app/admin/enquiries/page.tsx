import Link from "next/link";
import { adminDb } from "@/lib/admin-data";

export default async function EnquiriesPage() {
  const db = await adminDb();
  const { data } = await db
    .from("contact_submissions")
    .select("id,name,phone,event_type,event_date,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">CONTENT</p>
          <h1>Enquiries</h1>
          <p className="muted">Contact-form submissions from the website. Reach out, then mark each as contacted or closed.</p>
        </div>
        <p className="hint">{rows.length} shown</p>
      </div>
      <div className="admin-panel">
        <div className="panel-heading">
          <h2>Website enquiries</h2>
          <span className="hint">newest first</span>
        </div>
        {rows.length ? (
          rows.map(enquiry => (
            <Link className="enquiry-row" href={`/admin/enquiries/${enquiry.id}`} key={enquiry.id}>
              <strong>{enquiry.name}</strong>
              <span>{enquiry.phone || "—"}</span>
              <span>{enquiry.event_type ?? "—"}</span>
              <span>{enquiry.event_date ?? "—"}</span>
              <span>{new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
              <span><span className={`status-pill ${enquiry.status}`}>{enquiry.status}</span></span>
              <span>→</span>
            </Link>
          ))
        ) : (
          <p className="empty">No enquiries yet. Submissions from the contact form will appear here.</p>
        )}
      </div>
    </section>
  );
}