import { Reveal } from "@/components/public/reveal";
import { ContactForm } from "@/components/public/contact-form";
import { getSiteContact } from "@/lib/site/site-content";
import { waLink } from "@/lib/site/whatsapp";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/site/social-links";

export const metadata = { title: "Contact", description: "Enquire with Destiny Events and Photography." };

type Row = { label: string; value: string; href?: string; external?: boolean };

export default async function Contact() {
  const contact = await getSiteContact();
  const whatsappHref = contact.whatsapp
    ? waLink(contact.whatsapp, "Hi Destiny Events & Photography, I'd like to enquire about your photography services.")
    : undefined;
  const rows: Row[] = [
    { label: "Email", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
    { label: "Phone", value: contact.phone, href: contact.phone ? `tel:${contact.phone.replaceAll(" ", "")}` : undefined },
    { label: "WhatsApp", value: contact.whatsapp, href: contact.whatsapp ? waLink(contact.whatsapp) : undefined },
    { label: "Instagram", value: INSTAGRAM_HANDLE, href: INSTAGRAM_URL, external: true },
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
        {whatsappHref ? (
          <Reveal delay={230}>
            <a className="button" href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp at 9108727795">
              Chat on WhatsApp <span>→</span>
            </a>
          </Reveal>
        ) : null}
        {rows.length ? (
          <Reveal delay={300}>
            <dl>
              {rows.map(row => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.href ? <a href={row.href} rel="noopener noreferrer" target={row.external ? "_blank" : undefined}>{row.value}</a> : row.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}
      </div>
      <Reveal delay={120} className="contact-page__form-wrap">
        <ContactForm ctaText={contact.cta_text} />
      </Reveal>
    </section>
  );
}
export const dynamic = "force-dynamic";