"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { createFolder } from "@/app/admin/crud-actions";

export function AddSetDialog({ galleryId, highlighted = false }: { galleryId: string; highlighted?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className={highlighted ? "admin-button is-highlight" : "admin-button"} onClick={() => dialog.current?.showModal()} type="button">
        <Plus size={15} strokeWidth={2} /> Add set
      </button>
      <dialog className="admin-dialog" ref={dialog}>
        <form action={createFolder} onSubmit={() => dialog.current?.close()}>
          <h2>Add set</h2>
          <input name="gallery_id" type="hidden" value={galleryId} />
          <label>Name<input autoFocus maxLength={200} name="name" placeholder="e.g. Ceremony" required /></label>
          <label>Description <span className="optional">optional</span><textarea maxLength={400} name="description" placeholder="A short note about this set" rows={2} /></label>
          <menu>
            <button onClick={() => dialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button">Create set</button>
          </menu>
        </form>
      </dialog>
    </>
  );
}