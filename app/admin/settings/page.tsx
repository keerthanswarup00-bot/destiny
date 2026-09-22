import Link from "next/link";

const sections = [
  { label: "GENERAL", title: "General website information", description: "Studio identity and core website details.", href: "/admin/website/branding" },
  { label: "HOME", title: "Homepage content", description: "Hero, principles, selected stories, and CTA.", href: "/admin/website/home" },
  { label: "GALLERY", title: "Public website gallery", description: "Manage portfolio galleries and featured work.", href: "/admin/website/gallery" },
  { label: "CONTACT", title: "Contact details", description: "Contact page, WhatsApp, Instagram, and enquiry settings.", href: "/admin/website/contact" },
  { label: "BRANDING", title: "Brand identity", description: "Logo, short name, and social presentation.", href: "/admin/website/branding" },
  { label: "WATERMARK", title: "Client Gallery watermark", description: "Protect client photos with your logo on upload.", href: "/admin/settings/watermark" },
  { label: "APPEARANCE", title: "Visual theme", description: "Manage the existing public-site visual settings.", href: "/admin/website/appearance" },
];

export default function Settings() {
  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Website settings</h1>
          <p className="muted">Manage the public Destiny website from one place.</p>
        </div>
      </div>
      <div className="settings-directory">
        {sections.map(section => (
          <Link className="settings-directory-item" href={section.href} key={section.label}>
            <span className="eyebrow">{section.label}</span>
            <strong>{section.title}</strong>
            <span>{section.description}</span>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
