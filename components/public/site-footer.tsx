import Link from "next/link";

const EXPLORE = [
  { label: "Home", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
];

export function SiteFooter({
  brandName,
  tagline,
  blurb,
  email,
  phone,
  location,
  instagram,
}: {
  brandName: string;
  tagline: string;
  blurb: string;
  email: string;
  phone: string;
  location: string;
  instagram: string;
}) {
  const contacts = [email ? { label: "Email", href: `mailto:${email}` } : null, phone ? { label: `${phone}`, href: `tel:${phone.replaceAll(" ", "")}` } : null, instagram ? { label: `${instagram}`, href: `https://instagram.com/${instagram.replace(/^@/, "")}` } : null].filter((entry): entry is { label: string; href: string } => Boolean(entry));
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <div className="brand">
            {brandName.toUpperCase()}
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
            <a href={contact.href} key={contact.href} rel="noopener noreferrer">{contact.label}</a>
          ))}
          {location ? <p className="site-footer__loc">{location}</p> : null}
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        <p>Designed with intention.</p>
      </div>
    </footer>
  );
}