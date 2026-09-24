import "server-only";

import { cookies } from "next/headers";
import { hashViewerToken, PROFILE_COOKIE, PROFILE_MAX_AGE, readProfileIdentity, signProfileIdentity, signViewerIdentity } from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";

export type GalleryProfile = { id: string; email: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalize an email to the canonical store form (trim + lowercase). */
export function normalizeProfileEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidProfileEmail(email: string) {
  return EMAIL_PATTERN.test(email) && email.length <= 254;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * The identity for the current visitor from the signed profile cookie. Identity
 * is NOT authorization: roles still come from the per-gallery PIN cookies.
 */
export async function currentProfile(): Promise<GalleryProfile | null> {
  try {
    const jar = await cookies();
    const token = jar.get(PROFILE_COOKIE)?.value;
    if (!token) return null;
    const read = readProfileIdentity(token);
    if (!read) return null;
    const { data } = await galleryDb().from("profiles").select("id,email").eq("id", read.profileId).maybeSingle();
    if (!data) return null;
    return { id: data.id, email: data.email };
  } catch {
    return null;
  }
}

/** Create or fetch the lightweight profile for a normalized email. */
export async function upsertProfile(email: string): Promise<GalleryProfile | null> {
  try {
    const db = galleryDb();
    const { data: existing } = await db.from("profiles").select("id,email").eq("email", email).maybeSingle();
    if (existing) return { id: existing.id, email: existing.email };
    const { data, error } = await db.from("profiles").insert({ email }).select("id,email").maybeSingle();
    if (!error && data) return { id: data.id, email: data.email };
    // Unique-race: another request created the profile first.
    const { data: existingAfter } = await db.from("profiles").select("id,email").eq("email", email).maybeSingle();
    return existingAfter ? { id: existingAfter.id, email: existingAfter.email } : null;
  } catch {
    return null;
  }
}

/** Seal the profile identity into an httpOnly signed cookie for this visitor. */
export async function setProfileCookie(profileId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + PROFILE_MAX_AGE;
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, signProfileIdentity(profileId, expiresAt), cookieOptions(PROFILE_MAX_AGE));
}

/**
 * Deterministic, best-effort adoption of LEGACY cookie-identity favourties and
 * submissions for a profile.
 *
 * Before profiles, a viewer identity was a signed cookie derived from the email:
 *   token = idv1.<sha256("viewer-email:v1:"+email)>.<hmac>
 *   viewer_key_hash = sha256(token)
 * That value is reproducible from the same email + the same
 * GALLERY_ACCESS_SECRET, so only rows produced by THIS email can be adopted —
 * never another person's. Rows whose hash does not match (different email, or a
 * rotated secret) are preserved with profile_id left NULL and admin-managed.
 */
export async function claimLegacyProfileRows(profile: GalleryProfile) {
  try {
    const legacyViewerKeyHash = hashViewerToken(signViewerIdentity(profile.email));
    const db = galleryDb();
    await db
      .from("selections")
      .update({ profile_id: profile.id })
      .is("profile_id", null)
      .eq("viewer_key_hash", legacyViewerKeyHash);
    await db
      .from("selection_submissions")
      .update({ profile_id: profile.id })
      .is("profile_id", null)
      .eq("selection_session_hash", legacyViewerKeyHash);
  } catch {
    // Best-effort: adoption must never break gallery access.
  }
}