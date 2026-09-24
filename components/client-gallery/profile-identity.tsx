"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { identifyGalleryProfile } from "@/app/(client-gallery)/gallery/actions";

/**
 * Lightweight PROFILE identity. Entering an email creates or finds a profile and
 * seals it into a signed cookie. This is identity only — it never grants a role.
 * Plus/client access still requires the correct client PIN.
 */
export type PendingProfileAction =
  | { kind: "favorite"; photoId: string; next: boolean }
  | { kind: "client"; photoId: string; next: boolean }
  | { kind: "download-photo"; photoId: string }
  | { kind: "download-selection" }
  | { kind: "download-favorites" };

const PENDING_KEY = "destiny:gallery:profile-pending";

export function savePendingAction(action: PendingProfileAction, slug: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ action, slug, at: Date.now() }));
  } catch {
    // Storage unavailable — the user simply re-triggers the action after identifying.
  }
}

/** Read (and clear) the pending action, but only when it belongs to this gallery
 *  and matches one of the kinds this component can fulfil. */
export function consumePendingAction(slug: string, kinds: PendingProfileAction["kind"][]): PendingProfileAction | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as { action?: PendingProfileAction; slug?: string } | null;
    if (!parsed?.action || parsed.slug !== slug) return null;
    if (!kinds.includes(parsed.action.kind)) return null;
    return parsed.action;
  } catch {
    return null;
  }
}

const GalleryIdentityContext = createContext<{
  identified: boolean;
  requestIdentity: (action: PendingProfileAction) => void;
} | null>(null);

export function useGalleryIdentity() {
  const context = useContext(GalleryIdentityContext);
  if (!context) throw new Error("useGalleryIdentity must be used inside GalleryIdentityProvider.");
  return context;
}

export function GalleryIdentityProvider({ slug, initiallyIdentified, children }: { slug: string; initiallyIdentified: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [identified, setIdentified] = useState(initiallyIdentified);
  const [attempt, setAttempt] = useState(0);

  const requestIdentity = useCallback((action: PendingProfileAction) => {
    savePendingAction(action, slug);
    setOpen(true);
    setAttempt(previous => previous + 1);
  }, [slug]);

  const onIdentified = useCallback(() => {
    setIdentified(true);
    setOpen(false);
  }, []);

  const value = useMemo(() => ({ identified, requestIdentity }), [identified, requestIdentity]);

  return (
    <GalleryIdentityContext.Provider value={value}>
      {children}
      <ProfileIdentityDialog key={attempt} open={open} onClose={() => setOpen(false)} onIdentified={onIdentified} />
    </GalleryIdentityContext.Provider>
  );
}

function ProfileIdentityDialog({ open, onClose, onIdentified }: { open: boolean; onClose: () => void; onIdentified: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const handleClose = () => onClose();
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, [onClose]);

  async function identify() {
    if (identifying) return;
    setIdentifying(true);
    setError(null);
    const form = new FormData();
    form.set("email", email);
    const result = await identifyGalleryProfile(form);
    setIdentifying(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onIdentified();
  }

  return (
    <dialog aria-labelledby="client-gallery-identity-title" className="client-favorites-dialog" ref={dialog}>
      <form onSubmit={event => { event.preventDefault(); void identify(); }}>
        <h2 id="client-gallery-identity-title">Save your photos</h2>
        <p>Enter your email so your favourites follow you on any device. Your email is never used for access &mdash; just to find your saved photos.</p>
        <input
          aria-label="Your email"
          autoComplete="email"
          autoFocus
          inputMode="email"
          name="email"
          onChange={event => setEmail(event.target.value)}
          placeholder="Your email"
          type="email"
          value={email}
        />
        {error ? (
          <p className="client-favorites-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="client-favorites-actions">
          <button className="client-clear-button" onClick={onClose} type="button">Cancel</button>
          <button className="client-submit-button" disabled={identifying} type="submit">{identifying ? "Saving…" : "Continue"}</button>
        </div>
      </form>
    </dialog>
  );
}