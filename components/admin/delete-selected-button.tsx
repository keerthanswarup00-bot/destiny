"use client";

import { useFormStatus } from "react-dom";

/** Submit button for the bulk-delete confirmation form; shows a pending state. */
export function DeleteSelectedButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button is-danger" disabled={pending} type="submit">
      {pending ? "Deleting…" : `Delete ${count} ${count === 1 ? "Photo" : "Photos"}`}
    </button>
  );
}