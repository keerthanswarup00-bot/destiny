"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isActive(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Routes this app owns and can navigate to client-side.
 *
 * `/gallery` is a real route in this app, so `next/link` is correct for it. The public
 * marketing routes are a different Next.js build proxied through the same origin (see the
 * `beforeFiles` rewrites in next.config.ts). A client-side transition into another build
 * cannot work: this app's router receives that build's RSC payload and then rebuilds the
 * chunk URLs against its own `/_next/` prefix, producing requests like
 * `/_next/_next/static/chunks/...` that 404, then falls back to a full page load anyway.
 *
 * So cross-build links are plain anchors. The full document request is the only navigation
 * that reliably crosses the build boundary. This also means no prefetch RSC requests for
 * routes this app does not own.
 */
const OWNED_ROUTE = /^\/gallery(\/|$)/;

function NavLink({ href, active, children, className, ...rest }: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  if (!OWNED_ROUTE.test(href)) {
    return <a href={href} className={className} data-active={active || undefined} {...rest}>{children}</a>;
  }
  return <Link href={href} className={className} data-active={active || undefined}>{children}</Link>;
}

export function SiteHeader({ brandName, shortName, tagline, logoUrl }: { brandName: string; shortName: string; tagline: string; logoUrl: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setScrolled((window.scrollY ?? 0) > 24);
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <NavLink href="/" className="brand" aria-label={`${brandName} home`}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="brand-logo" src={logoUrl} />
        ) : (
          <>
            {(shortName || brandName).toUpperCase()}
            <span>{tagline}</span>
          </>
        )}
      </NavLink>
      <nav className="site-nav" aria-label="Primary navigation">
        <NavLink href="/" active={isActive(pathname, "/")}>Home</NavLink>
        <NavLink href="/gallery" active={isActive(pathname, "/gallery")}>Gallery</NavLink>
        <NavLink href="/contact" active={isActive(pathname, "/contact")}>Contact</NavLink>
      </nav>
    </header>
  );
}
