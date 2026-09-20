import Link from "next/link";
import { adminDb } from "@/lib/admin-data";
import { adminError } from "@/lib/admin-validation";
import { createClient } from "../crud-actions";
import { ClientList } from "@/components/admin/client-list";

export default async function Clients({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = adminError(error);
  const db = await adminDb();
  const { data } = await db.from("clients").select("id,name,event_date,phone,created_at").order("created_at", { ascending: false });
  const clients = data ?? [];

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <p className="eyebrow">FOLDERS</p>
          <h1>Clients</h1>
        </div>
        <a className="admin-button" href="#client-form">New Folder</a>
      </div>
      <form action={createClient} className="admin-panel settings-card" id="client-form">
        <h2>New folder</h2>
        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <label>Folder / client name<input name="name" required /></label>
        <label>Date<input name="date" type="date" /></label>
        <label>Phone<input name="phone" /></label>
        <label>Notes<textarea name="notes" /></label>
        <button className="admin-button">Create folder</button>
      </form>
      <div className="admin-panel table-panel">
        <div className="panel-heading">
          <h2>Folders</h2>
          <span>{clients.length} {clients.length === 1 ? "folder" : "folders"}</span>
        </div>
        <ClientList clients={clients} />
      </div>
    </section>
  );
}