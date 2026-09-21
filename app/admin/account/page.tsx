import { LogOut } from "lucide-react";
import { signOut } from "@/app/admin/actions";

export default function AccountPage() {
  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">SYSTEM</p>
          <h1>Account</h1>
          <p className="muted">Manage your studio administrator session.</p>
        </div>
      </div>
      <div className="admin-panel settings-card account-card">
        <h2>Studio administrator</h2>
        <form action={signOut}>
          <button className="admin-button is-secondary" type="submit"><LogOut size={15} /> Log out</button>
        </form>
      </div>
    </section>
  );
}
