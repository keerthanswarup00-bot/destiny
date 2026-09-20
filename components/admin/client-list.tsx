"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ClientRow = { id: string; name: string; event_date: string | null; phone: string | null; created_at: string };

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(client => client.name.toLowerCase().includes(q) || (client.phone ?? "").toLowerCase().includes(q));
  }, [clients, query]);

  return (
    <>
      <input aria-label="Search clients" className="search" onChange={event => setQuery(event.target.value)} placeholder="Search by name or phone…" type="search" value={query} />
      <div className="table">
        <div className="table-row table-head">
          <span>Folder / Client</span><span>Date</span><span>Phone</span><span>Created</span><span />
        </div>
        {filtered.map(client => (
          <div className="table-row" key={client.id}>
            <Link href={`/admin/clients/${client.id}`}><strong>{client.name}</strong></Link>
            <span>{client.event_date ?? "—"}</span>
            <span>{client.phone ?? "—"}</span>
            <span>{new Date(client.created_at).toLocaleDateString()}</span>
            <Link href={`/admin/clients/${client.id}`}>Open →</Link>
          </div>
        ))}
      </div>
      {!filtered.length ? <p className="empty">{query ? "No folders match that search." : "No folders yet. Create your first folder to start organizing collections."}</p> : null}
    </>
  );
}