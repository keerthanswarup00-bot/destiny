import Link from "next/link";
import { displayPhone, waLink } from "@/lib/site/whatsapp";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/site/social-links";

const EXPLORE = [
  { label: "Home", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
];

export function SiteFooter({
  brandName,
  shortName,
  tagline,
  blurb,
  email,
  phone,
  whatsapp,
  location,
  instagram,
}: {
  brandName: string;
  shortName: string;
  tagline: string;
  blurb: string;
  email: string;
  phone: string;
  whatsapp: string;
  location: string;
  instagram: string;
}) {
  const contacts = [
    email ? { label: "Email", href: `mailto:${email}` } : null,
    phone ? { label: `${displayPhone(phone)}`, href: `tel:${phone.replaceAll(" ", "")}` } : null,
    whatsapp ? { label: `${displayPhone(whatsapp)}`, href: waLink(whatsapp) } : null,
    { label: `Instagram ${INSTAGRAM_HANDLE}`, href: INSTAGRAM_URL, external: true },
  ].filter((entry): entry is { label: string; href: string; external?: boolean } => Boolean(entry));
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <div className="brand">
            {(shortName || brandName).toUpperCase()}
            <span>{tagline}</span>
          </div>
          <p className="site-footer__blurb">{blurb}</p>
        </div>
        <nav className="site-footer__col" aria-label="Footer navigation">
          <h3>Explore</h3>
          {EXPLORE.map(link => (
            <Link href={link.href} key={link.href}>{link.label}</Link>
          ))}
        </nav>
        <div className="site-footer__col">
          <h3>Contact</h3>
          {contacts.map(contact => (
            <a href={contact.href} key={contact.href} rel="noopener noreferrer" target={contact.external ? "_blank" : undefined}>{contact.label}</a>
          ))}
          {location ? <p className="site-footer__loc">{location}</p> : null}
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        <p className="site-footer__credit">Website by <a href="https://www.aryanswaroop.com/" target="_blank" rel="noopener noreferrer">Aryan Swaroop ↗</a></p>
      </div>
    </footer>
  );
}