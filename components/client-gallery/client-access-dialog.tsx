"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { submitClientAccess } from "@/app/(client-gallery)/gallery/actions";
import type { PasswordState } from "@/app/(client-gallery)/gallery/actions";

/**
 * Elevate a viewer session to client access inside an open gallery (a gallery
 * that has a client password but no viewer password).
 */
export function ClientAccessDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<PasswordState, FormData>(submitClientAccess, { error: null });

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  return (
    <>
      <button
        className="client-topbar-action client-access-button"
        onClick={() => setOpen(true)}
        title="Enter your client password"
        type="button"
      >
        <ShieldCheck size={19} strokeWidth={1.6} />
        <span>Client access</span>
      </button>
      <dialog className="client-access-dialog" onCancel={() => setOpen(false)} ref={dialog}>
        <form action={action}>
          <h2>Client access</h2>
          <p>Enter your client password to mark and submit the official photo selection.</p>
          <input name="slug" type="hidden" value={slug} />
          <input aria-label="Client password" autoComplete="current-password" autoFocus name="password" placeholder="Client password" required type="password" />
          {state.error ? <p className="client-favorites-error" role="alert">{state.error}</p> : null}
          <div className="client-favorites-actions">
            <button className="client-clear-button" onClick={() => setOpen(false)} type="button">Cancel</button>
            <button className="client-submit-button" disabled={pending} type="submit">{pending ? "Checking…" : "Continue"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}