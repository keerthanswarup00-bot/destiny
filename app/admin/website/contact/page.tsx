import { Mail, Save } from "lucide-react";
import { WebsiteTabs } from "@/components/admin/website-tabs";
import { getSiteContact } from "@/lib/site/site-content";
import { saveContact } from "@/app/admin/website/actions";

export default async function WebsiteContactPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const contact = await getSiteContact();
  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Contact</h1>
          <p className="muted">Your public contact page — how clients reach you.</p>
        </div>
      </div>
      <WebsiteTabs />
      {saved ? <p className="saved-note" style={{ marginBottom: 14 }}>Saved.</p> : null}
      <section className="admin-panel">
        <div className="panel-heading"><h2>Contact details</h2></div>
        <form action={saveContact} className="ws-form">
          <div className="field-row">
            <div className="field"><span>Studio name</span><input defaultValue={contact.studio_name} name="studio_name" type="text" /></div>
            <div className="field"><span>Email</span><input defaultValue={contact.email} name="email" type="text" /></div>
          </div>
          <div className="field-row">
            <div className="field"><span>Phone</span><input defaultValue={contact.phone} name="phone" type="text" /></div>
            <div className="field"><span>WhatsApp</span><input defaultValue={contact.whatsapp} name="whatsapp" type="text" /></div>
          </div>
          <div className="field-row">
            <div className="field"><span>Instagram / social handle</span><input defaultValue={contact.instagram} name="instagram" type="text" /></div>
            <div className="field"><span>Location line</span><input defaultValue={contact.location} name="location" type="text" /></div>
          </div>
          <div className="field-row">
            <div className="field"><span>Address</span><textarea defaultValue={contact.address} name="address" rows={2} /></div>
            <div className="field"><span>Studio hours</span><input defaultValue={contact.hours} name="hours" type="text" /></div>
          </div>
          <div className="field"><span>Page heading</span><input defaultValue={contact.heading} name="heading" type="text" /></div>
          <div className="field"><span>Description</span><textarea defaultValue={contact.description} name="description" rows={3} /></div>
          <div className="field"><span>Form button label</span><input defaultValue={contact.cta_text} name="cta_text" type="text" /></div>
          <div className="form-actions"><button className="admin-button" type="submit"><Save size={15} /> Save contact</button><span className="hint">Enquiries from the public form are saved and opened in WhatsApp via the number above.</span></div>
        </form>
      </section>
      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="panel-heading"><h2><Mail size={16} /> Live page check</h2></div>
        <p className="placeholder">Your contact page renders from these details at <a href="/contact" rel="noopener noreferrer" target="_blank">/contact ↗</a>.</p>
      </section>
    </div>
  );
}