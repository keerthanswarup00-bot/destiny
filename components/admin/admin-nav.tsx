"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GalleryHorizontalEnd,
  House,
  FolderOpen,
  Phone,
  Palette,
  Shapes,
  PanelsTopLeft,
  Users,
  Settings,
  UserRound,
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/admin/actions";

type NavLink = { label: string; href: string; icon: typeof House };

const groups: { label: string; links: NavLink[] }[] = [
  {
    label: "Dashboard",
    links: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Website",
    links: [
      { label: "Home", href: "/admin/website/home", icon: House },
      { label: "Gallery", href: "/admin/website/gallery", icon: GalleryHorizontalEnd },
      { label: "Contact", href: "/admin/website/contact", icon: Phone },
      { label: "Branding", href: "/admin/website/branding", icon: PanelsTopLeft },
      { label: "Appearance", href: "/admin/website/appearance", icon: Palette },
    ],
  },
  {
    label: "Content",
    links: [
      { label: "Gallery Sets", href: "/admin/galleries", icon: FolderOpen },
      { label: "Clients", href: "/admin/clients", icon: Users },
    ],
  },
  {
    label: "System",
    links: [{ label: "Settings", href: "/admin/settings", icon: Settings }],
  },
];

function isActive(path: string, href: string): boolean {
  if (href === "/admin") return path === "/admin";
  return path.startsWith(href);
}

export function AdminNav({ collapsed }: { collapsed: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin">
      {groups.map((group) => (
        <div className="admin-nav-group" key={group.label}>
          <span className="admin-nav-label">{group.label}</span>
          {group.links.map(({ label, href, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "active" : undefined}
                href={href}
                key={href}
                title={collapsed ? label : undefined}
              >
                <Icon className="nav-icon" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminBottomNav({ collapsed }: { collapsed: boolean }) {
  const path = usePathname();
  return (
    <div className="admin-bottom">
      <Link
        aria-current={path === "/admin/settings" ? "page" : undefined}
        className={path === "/admin/settings" ? "active" : undefined}
        href="/admin/settings"
        title={collapsed ? "Account" : undefined}
      >
        <UserRound className="nav-icon" size={18} strokeWidth={1.8} />
        <span>Account</span>
      </Link>
      <form action={signOut}>
        <button title={collapsed ? "Log out" : undefined} type="submit">
          <LogOut className="nav-icon" size={18} strokeWidth={1.8} />
          <span>Log out</span>
        </button>
      </form>
    </div>
  );
}