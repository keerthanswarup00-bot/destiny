"use client";

import { useEffect, useRef } from "react";
import { GalleryForm } from "@/components/admin/gallery-form";
import Link from "next/link";

type ClientOption = { id: string; name: string };

export function GalleryCreateDialog({
  clients,
  error,
}: {
  clients: ClientOption[];
  error?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (error && ref.current && !ref.current.open) ref.current.showModal();
  }, [error]);

  return (
    <>
      <button className="admin-button gallery-create-trigger" onClick={() => ref.current?.showModal()} type="button">
        + New Gallery
      </button>
      <dialog className="admin-dialog gallery-create-dialog" onCancel={() => ref.current?.close()} ref={ref}>
        {clients.length ? (
          <GalleryForm clients={clients} error={error} from="galleries" modal onCancel={() => ref.current?.close()} />
        ) : (
          <div className="gallery-no-clients">
            <h2>Create your first client</h2>
            <p>Galleries are connected to a client record.</p>
            <Link className="admin-button" href="/admin/clients#client-form">Create client</Link>
            <button className="subtle-button" onClick={() => ref.current?.close()} type="button">Cancel</button>
          </div>
        )}
      </dialog>
    </>
  );
}
