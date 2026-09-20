"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isActive(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function SiteHeader({ brandName, tagline, logoUrl }: { brandName: string; tagline: string; logoUrl: string | null }) {
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
      <Link href="/" className="brand" aria-label={`${brandName} home`}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="brand-logo" src={logoUrl} />
        ) : (
          <>
            {brandName.toUpperCase()}
            <span>{tagline}</span>
          </>
        )}
      </Link>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/" data-active={isActive(pathname, "/")}>Home</Link>
        <Link href="/gallery" data-active={isActive(pathname, "/gallery")}>Gallery</Link>
        <Link href="/contact" data-active={isActive(pathname, "/contact")}>Contact</Link>
      </nav>
    </header>
  );
}