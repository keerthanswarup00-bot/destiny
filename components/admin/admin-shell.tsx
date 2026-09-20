"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, PanelLeftClose, ExternalLink } from "lucide-react";
import { AdminNav, AdminBottomNav } from "@/components/admin/admin-nav";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("admin-shell-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("admin-shell-collapsed", next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  const isEditor = /^\/admin\/galleries\/[^/]+(?:\/)?$/.test(path);
  return (
    <div className={`admin-shell${collapsed ? " is-collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          DESTINY<span>STUDIO ADMIN</span>
        </Link>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="collapse-toggle"
          onClick={toggle}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <AdminNav collapsed={collapsed} />
        <AdminBottomNav collapsed={collapsed} />
      </aside>
      <main className="admin-main">
        {!isEditor ? (
          <header className="admin-header">
            <span>STUDIO MANAGEMENT</span>
            <Link href="/" target="_blank">
              View site <ExternalLink size={13} strokeWidth={1.8} />
            </Link>
          </header>
        ) : null}
        {children}
      </main>
    </div>
  );
}