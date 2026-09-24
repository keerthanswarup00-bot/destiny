"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { identifyGalleryProfile } from "@/app/(client-gallery)/gallery/actions";
import { useAnimatedDialog } from "@/components/client-gallery/use-animated-dialog";

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
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const { dialogRef, closing } = useAnimatedDialog({ open, onClose });

  async function identify() {
    if (identifying || !email.trim()) return;
    setIdentifying(true);
    setError(null);
    const form = new FormData();
    form.set("email", email);
    form.set("marketing_optin", optIn ? "true" : "false");
    const result = await identifyGalleryProfile(form);
    if (!result.ok) {
      setIdentifying(false);
      setError(result.error);
      return;
    }
    // Success: the profile cookie is set server-side; close automatically and
    // let the provider replay the original action that asked for the email.
    onIdentified();
  }

  return (
    <dialog aria-describedby="client-gallery-identity-sub" aria-labelledby="client-gallery-identity-title" className={`client-favorites-dialog${closing ? " is-closing" : ""}`} ref={dialogRef}>
      <form onSubmit={event => { event.preventDefault(); void identify(); }}>
        <h2 id="client-gallery-identity-title">Save your photos</h2>
        <p id="client-gallery-identity-sub">Enter your email so your favourites follow you on any device. Your email is used for identification only &mdash; it never grants access to your gallery.</p>
        <input
          aria-label="Your email"
          autoComplete="email"
          autoFocus
          disabled={identifying}
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
        <label className="client-optin">
          <input checked={optIn} name="marketing_optin" onChange={event => setOptIn(event.target.checked)} type="checkbox" />
          <span><strong>Keep me updated</strong> You can email me when my selection is ready.</span>
        </label>
        <div className="client-favorites-actions">
          <button className="client-clear-button" disabled={identifying} onClick={onClose} type="button">Cancel</button>
          <button className="client-submit-button" disabled={identifying || !email.trim()} type="submit">{identifying ? "Saving…" : "Continue"}</button>
        </div>
      </form>
    </dialog>
  );
}