"use client";

import { useRef } from "react";
import { deleteFolder, renameFolder } from "@/app/admin/crud-actions";

export function FolderRow({
  folder,
  galleryId,
}: {
  folder: { id: string; name: string; parent_folder_id: string | null };
  galleryId: string;
}) {
  const renameDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  return (
    <div className={`folder-row${folder.parent_folder_id ? " nested" : ""}`}>
      <span>⌁</span>
      <strong>{folder.name}</strong>
      <div className="folder-actions">
        <button aria-label={`Rename ${folder.name}`} onClick={() => renameDialog.current?.showModal()} type="button">Rename</button>
        <button aria-label={`Delete ${folder.name}`} onClick={() => deleteDialog.current?.showModal()} type="button">Delete</button>
      </div>
      <dialog className="admin-dialog" ref={renameDialog}>
        <form action={renameFolder} onSubmit={() => renameDialog.current?.close()}>
          <h2>Rename folder</h2>
          <input name="id" type="hidden" value={folder.id} />
          <input name="gallery_id" type="hidden" value={galleryId} />
          <label>Name<input autoFocus defaultValue={folder.name} maxLength={200} name="name" required /></label>
          <menu>
            <button onClick={() => renameDialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button">Save</button>
          </menu>
        </form>
      </dialog>
      <dialog className="admin-dialog" ref={deleteDialog}>
        <form action={deleteFolder}>
          <h2>Delete folder</h2>
          <p>Delete &ldquo;{folder.name}&rdquo;? This cannot be undone.</p>
          <input name="id" type="hidden" value={folder.id} />
          <input name="gallery_id" type="hidden" value={galleryId} />
          <menu>
            <button onClick={() => deleteDialog.current?.close()} type="button">Cancel</button>
            <button className="admin-button">Delete</button>
          </menu>
        </form>
      </dialog>
    </div>
  );
}
