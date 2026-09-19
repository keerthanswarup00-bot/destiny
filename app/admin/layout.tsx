import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import "./admin.css";
export default async function Layout({ children }: { children: React.ReactNode }) { await requireAdmin(); return <AdminShell>{children}</AdminShell>; }
