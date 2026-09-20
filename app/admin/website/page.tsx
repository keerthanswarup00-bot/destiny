import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function WebsitePage() {
  await requireAdmin();
  return (
    <div className="admin-content">
      <div className="admin-title">
        <div>
          <h1>Website</h1>
          <p className="muted">Your public portfolio and brand pages.</p>
        </div>
      </div>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Website editor</h2>
        </div>
        <p className="placeholder">
          The public site editor will live here. For now, view your live site at{" "}
          <Link href="/" target="_blank">destiny.local ↗</Link>.
        </p>
      </section>
    </div>
  );
}