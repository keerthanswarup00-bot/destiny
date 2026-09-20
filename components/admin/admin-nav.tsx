"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Images,
  Globe,
  Settings,
  UserRound,
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/admin/actions";

const links = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Collections", href: "/admin/galleries", icon: Images },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "Website", href: "/admin/website", icon: Globe },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminNav({ collapsed }: { collapsed: boolean }) {
  const path = usePathname();
  return (
    <nav>
      {links.map(({ label, href, icon: Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
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