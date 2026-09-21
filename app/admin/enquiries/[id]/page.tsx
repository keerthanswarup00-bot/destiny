import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MessageCircle, Phone, Save } from "lucide-react";
import { adminDb } from "@/lib/admin-data";
import { waLink } from "@/lib/site/whatsapp";
import { updateEnquiryStatus } from "../actions";

const STATUS_LABELS = ["new", "contacted", "closed"] as const;

export default async function EnquiryDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const db = await adminDb();
  const { data: enquiry } = await db.from("contact_submissions").select("*").eq("id", id).maybeSingle();
  if (!enquiry) notFound();

  const submitted = new Date(enquiry.created_at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const outreach = `Hi ${enquiry.name},\n\nThank you for your enquiry${enquiry.event_type ? ` about your ${enquiry.event_type}` : ""}. This is Destiny Events and Photography — happy to talk through the details.`;

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">CONTENT · ENQUIRIES</p>
          <h1>{enquiry.name}</h1>
          <p className="muted">Submitted {submitted}</p>
        </div>
        <Link className="admin-button" href="/admin/enquiries">← All enquiries</Link>
      </div>

      <div className="enquiry-actions">
        {enquiry.phone ? (
          <a className="admin-button" href={`tel:${enquiry.phone.replace(/\D/g, "")}`}><Phone size={15} /> Call</a>
        ) : null}
        {enquiry.phone ? (
          <a className="admin-button" href={waLink(enquiry.phone, outreach)} rel="noopener noreferrer" target="_blank"><MessageCircle size={15} /> WhatsApp</a>
        ) : null}
        <span className="hint">Contact the client, then mark the enquiry below.</span>
      </div>

      <section className="admin-panel" style={{ marginTop: 22 }}>
        <div className="panel-heading">
          <h2>Enquiry details</h2>
          <span><span className={`status-pill ${enquiry.status}`}>{enquiry.status}</span></span>
        </div>
        <div className="enquiry-detail">
          <div><span>Name</span><strong>{enquiry.name}</strong></div>
          <div><span>Phone</span><strong>{enquiry.phone || "—"}</strong></div>
          <div><span>Event type</span><strong>{enquiry.event_type || "—"}</strong></div>
          <div><span>Event date</span><strong><CalendarDays size={13} /> {enquiry.event_date || "—"}</strong></div>
          <div><span>Source</span><strong>{enquiry.source}</strong></div>
        </div>
        {enquiry.message ? (
          <div className="enquiry-message">
            <span>Message</span>
            <p>{enquiry.message}</p>
          </div>
        ) : null}
      </section>

      <section className="admin-panel" style={{ marginTop: 22 }}>
        <div className="panel-heading"><h2>Status</h2></div>
        <div className="enquiry-status">
          {STATUS_LABELS.map(status => {
            const current = status === enquiry.status;
            return (
              <form action={updateEnquiryStatus} key={status}>
                <input type="hidden" name="id" value={enquiry.id} />
                <input type="hidden" name="status" value={status} />
                <button className={`admin-button${current ? " is-secondary" : ""}`} disabled={current} type="submit">
                  {current ? <><Save size={14} /> {status}</> : `Mark as ${status}`}
                </button>
              </form>
            );
          })}
          {saved ? <p className="saved-note">Updated.</p> : null}
          {error ? <p className="error-note">Something went wrong. Try again.</p> : null}
        </div>
        <p className="hint" style={{ padding: "0 20px 18px", margin: 0 }}>Mark an enquiry as contacted once you reply, and closed once it&apos;s resolved.</p>
      </section>
    </section>
  );
}