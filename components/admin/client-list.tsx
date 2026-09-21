"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/app/admin/crud-actions";

type ClientRow = {
  id: string;
  name: string;
  event_date: string | null;
  phone: string | null;
  created_at: string;
  galleryCount: number;
  publishedGalleryCount: number;
};

function CreateClientButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button" disabled={pending} type="submit">{pending ? "Creating…" : "Create Client"}</button>;
}

export function ClientList({ clients, error }: { clients: ClientRow[]; error?: string | null }) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (error && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [error]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(client => client.name.toLowerCase().includes(q) || (client.phone ?? "").toLowerCase().includes(q));
  }, [clients, query]);

  return (
    <>
      <div className="clients-toolbar">
        <div>
          <p className="eyebrow">CLIENT LIST</p>
          <span className="muted">{filtered.length} {filtered.length === 1 ? "client" : "clients"}</span>
        </div>
        <div className="clients-toolbar-actions">
          <input aria-label="Search clients" className="search clients-search" onChange={event => setQuery(event.target.value)} placeholder="Search clients…" type="search" value={query} />
          <button className="admin-button" onClick={() => dialog.current?.showModal()} type="button">+ New Client</button>
        </div>
      </div>
      <div className="client-table">
        <div className="table-row table-head">
          <span>Client</span><span>Event date</span><span>Phone</span><span>Galleries</span><span />
        </div>
        {filtered.map(client => (
          <div className="client-row" key={client.id}>
            <Link className="client-row-name" href={`/admin/clients/${client.id}`}><strong>{client.name}</strong></Link>
            <span>{client.event_date ?? "—"}</span>
            <span>{client.phone ?? "—"}</span>
            <span>{client.galleryCount} {client.galleryCount === 1 ? "gallery" : "galleries"}{client.publishedGalleryCount ? ` · ${client.publishedGalleryCount} live` : ""}</span>
            <Link className="client-open" href={`/admin/clients/${client.id}`}>Open →</Link>
          </div>
        ))}
      </div>
      {!filtered.length ? <p className="empty">{query ? "No clients match that search." : "No clients yet. Add your first client to start organizing galleries."}</p> : null}
      <dialog className="admin-dialog client-dialog" onCancel={() => dialog.current?.close()} ref={dialog}>
        <form action={createClient}>
          <p className="eyebrow">NEW CLIENT</p>
          <h2>Add a client</h2>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <label>Client name<input name="name" required /></label>
          <label>Event date<input name="date" type="date" /></label>
          <label>Phone<input name="phone" /></label>
          <label>Notes<textarea name="notes" rows={4} /></label>
          <menu>
            <button onClick={() => dialog.current?.close()} type="button">Cancel</button>
            <CreateClientButton />
          </menu>
        </form>
      </dialog>
    </>
  );
}