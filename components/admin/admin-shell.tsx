import Link from "next/link";
import { signOut } from "@/app/admin/actions";

const links = [["Overview", "/admin"], ["Clients", "/admin/clients"], ["Galleries", "/admin/galleries"], ["Settings", "/admin/settings"]];

export function AdminShell({ children }: { children: React.ReactNode }) { return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/admin" className="brand">DESTINY<span>STUDIO ADMIN</span></Link><nav>{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav><div className="admin-bottom"><button>Account</button><form action={signOut}><button>Log out</button></form></div></aside><main className="admin-main"><header className="admin-header"><span>STUDIO MANAGEMENT</span><Link href="/" target="_blank">View site ↗</Link></header>{children}</main></div>; }
