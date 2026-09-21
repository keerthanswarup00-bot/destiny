import type { CSSProperties } from "react";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getSiteBranding, getSiteContact, getSiteThemeCssVars } from "@/lib/site/site-content";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [vars, branding, contact] = await Promise.all([getSiteThemeCssVars(), getSiteBranding(), getSiteContact()]);
  const themeStyle = { ...vars } as CSSProperties;
  return (
    <div className="site" style={themeStyle}>
      <SiteHeader brandName={branding.brand_name} shortName={branding.short_name} tagline={branding.tagline} logoUrl={branding.logoUrl} />
      <main className="site-main">{children}</main>
      <SiteFooter
        brandName={branding.brand_name}
        shortName={branding.short_name}
        tagline={branding.tagline}
        blurb={contact.description || "Intentional photography for celebrations, events, and the moments in between."}
        email={contact.email}
        phone={contact.phone}
        whatsapp={contact.whatsapp}
        location={contact.location}
        instagram={contact.instagram}
      />
    </div>
  );
}