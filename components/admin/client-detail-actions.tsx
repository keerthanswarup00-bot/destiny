"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { deleteClient, updateClient } from "@/app/admin/crud-actions";
import { GalleryForm } from "@/components/admin/gallery-form";

function SaveClientButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save Client"}</button>;
}

function DeleteClientButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button is-danger" disabled={pending} type="submit">{pending ? "Deleting…" : "Delete client"}</button>;
}

export function ClientDetailActions({
  client,
  galleryError,
  clientError,
}: {
  client: { id: string; name: string; event_date: string | null; phone: string | null; notes: string | null };
  galleryError?: string | null;
  clientError?: string | null;
}) {
  const galleryDialog = useRef<HTMLDialogElement>(null);
  const editDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (galleryError && galleryDialog.current && !galleryDialog.current.open) galleryDialog.current.showModal();
    if (clientError && editDialog.current && !editDialog.current.open) editDialog.current.showModal();
  }, [galleryError, clientError]);

  return (
    <>
      <div className="client-detail-actions">
        <button className="admin-button" onClick={() => galleryDialog.current?.showModal()} type="button">+ New Gallery</button>
        <button className="admin-button is-secondary" onClick={() => editDialog.current?.showModal()} type="button">Edit Client</button>
      </div>
      <dialog className="admin-dialog client-dialog" id={`new-gallery-dialog-${client.id}`} onCancel={() => galleryDialog.current?.close()} ref={galleryDialog}>
        <GalleryForm clientId={client.id} error={galleryError} modal onCancel={() => galleryDialog.current?.close()} />
      </dialog>
      <dialog className="admin-dialog client-dialog" onCancel={() => editDialog.current?.close()} ref={editDialog}>
        <form action={updateClient}>
          <p className="eyebrow">EDIT CLIENT</p>
          <h2>Update client details</h2>
          {clientError ? <p className="form-error" role="alert">{clientError}</p> : null}
          <input name="id" type="hidden" value={client.id} />
          <label>Client name<input defaultValue={client.name} maxLength={200} name="name" required /></label>
          <label>Event date<input defaultValue={client.event_date ?? ""} name="date" type="date" /></label>
          <label>Phone<input defaultValue={client.phone ?? ""} maxLength={50} name="phone" /></label>
          <label>Notes<textarea defaultValue={client.notes ?? ""} maxLength={5000} name="notes" rows={4} /></label>
          <menu>
            <button onClick={() => editDialog.current?.close()} type="button">Cancel</button>
            <SaveClientButton />
          </menu>
        </form>
      </dialog>
    </>
  );
}

export function DeleteClientForm({ clientId, error }: { clientId: string; error?: string | null }) {
  return (
    <form action={deleteClient}>
      <input name="id" type="hidden" value={clientId} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <DeleteClientButton />
    </form>
  );
}

export function NewGalleryButton({ clientId }: { clientId: string }) {
  return (
    <button className="admin-button" onClick={() => (document.getElementById(`new-gallery-dialog-${clientId}`) as HTMLDialogElement | null)?.showModal()} type="button">
      + New Gallery
    </button>
  );
}
