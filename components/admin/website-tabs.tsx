"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Home", href: "/admin/website/home" },
  { label: "Gallery", href: "/admin/website/gallery" },
  { label: "Contact", href: "/admin/website/contact" },
  { label: "Branding", href: "/admin/website/branding" },
  { label: "Appearance", href: "/admin/website/appearance" },
];

export function WebsiteTabs() {
  const path = usePathname();
  return (
    <nav className="admin-tabs">
      {tabs.map(({ label, href }) => (
        <Link aria-current={path === href ? "page" : undefined} className={path === href ? "active" : undefined} href={href} key={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}