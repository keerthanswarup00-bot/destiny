import { Reveal } from "@/components/public/reveal";
import { getSiteContact } from "@/lib/site/site-content";

export const metadata = { title: "Contact", description: "Enquire with Destiny Events and Photography." };

type Row = { label: string; value: string; href?: string };

export default async function Contact() {
  const contact = await getSiteContact();
  const rows: Row[] = [
    { label: "Email", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
    { label: "Phone", value: contact.phone, href: contact.phone ? `tel:${contact.phone.replaceAll(" ", "")}` : undefined },
    { label: "WhatsApp", value: contact.whatsapp, href: contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}` : undefined },
    { label: "Instagram", value: contact.instagram, href: contact.instagram ? `https://instagram.com/${contact.instagram.replace(/^@/, "")}` : undefined },
    { label: "Based in", value: contact.location },
    { label: "Studio", value: contact.address },
    { label: "Hours", value: contact.hours },
  ].filter(row => row.value);
  return (
    <section className="contact-page">
      <div className="contact-page__intro">
        <Reveal><p className="eyebrow">CONTACT</p></Reveal>
        <Reveal delay={90}><h1>{contact.heading}</h1></Reveal>
        {contact.description ? <Reveal delay={170}><p>{contact.description}</p></Reveal> : null}
        {rows.length ? (
          <Reveal delay={240}>
            <dl>
              {rows.map(row => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.href ? <a href={row.href} rel="noopener noreferrer">{row.value}</a> : row.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}
      </div>
      <Reveal delay={120} className="contact-page__form-wrap">
        <form className="contact-form">
          <label>Name<input name="name" autoComplete="name" /></label>
          <label>Email<input name="email" type="email" autoComplete="email" /></label>
          <label>Tell us about your event<textarea name="message" rows={6} /></label>
          <button className="button" type="submit">{contact.cta_text} <span>→</span></button>
          <p className="form-note">Enquiries are not sent until email delivery is configured.</p>
        </form>
      </Reveal>
    </section>
  );
}
export const dynamic = "force-dynamic";
