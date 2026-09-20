import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { getSiteBranding } from "@/lib/site/site-content";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const FALLBACK_TITLE = "Destiny Events and Photography";
const FALLBACK_DESCRIPTION = "Intentional photography for celebrations, events, and the moments between.";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getSiteBranding();
  const title = branding.brand_name || FALLBACK_TITLE;
  const mentioned = branding.short_name ? `${branding.short_name} ${branding.tagline ? `· ${branding.tagline}` : ""}` : null;
  return {
    title: { default: mentioned ? `${title} — ${mentioned}` : title, template: `%s | ${title}` },
    description: branding.tagline || FALLBACK_DESCRIPTION,
    openGraph: {
      title: title,
      description: mentioned || FALLBACK_DESCRIPTION,
      siteName: title,
      type: "website",
      images: branding.socialImageUrl ? [{ url: branding.socialImageUrl, width: 1200, height: 630, alt: title }] : undefined,
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const branding = await getSiteBranding();
  const favicon = branding.faviconUrl;
  return (
    <html lang="en" className={instrument.variable}>
      <head>
        {favicon ? <link rel="icon" href={favicon} sizes="any" /> : null}
        {branding.socialImageUrl ? <meta content={branding.socialImageUrl} property="og:image" /> : null}
      </head>
      <body>{children}</body>
    </html>
  );
}