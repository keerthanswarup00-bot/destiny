import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function accessSecret() {
  const secret = process.env.GALLERY_ACCESS_SECRET;
  if (!secret) throw new Error("Missing GALLERY_ACCESS_SECRET.");
  return secret;
}

export function fingerprintPassword(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export type GalleryRole = "viewer" | "client";

export type GalleryAccessRead = { ok: boolean; role: GalleryRole };

/** Sign an access cookie for one gallery at the given role. The role is part of
 *  the signed payload, so a client cookie can never be re-read as viewer (or
 *  vice-versa) without the secret. */
export function signGalleryAccess(galleryId: string, role: GalleryRole, fingerprint: string, expiresAt: number) {
  const payload = `v1.${galleryId}.${role}.${fingerprint}.${expiresAt}`;
  const signature = createHmac("sha256", accessSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Verify an access cookie. Returns the granted role, or ok:false when the
 *  token is missing/malformed/expired or does not match the gallery and the
 *  fingerprint for the role it claims.
 *
 *  Legacy 5-part viewer tokens (`v1.<gallery>.<fingerprint>.<expiresAt>.<sig>`)
 *  are still accepted as viewer so existing sessions survive the format change;
 *  a viewer token only validates against the viewer fingerprint. */
export function readGalleryAccess(token: string, galleryId: string, fingerprint: string, clientFingerprint?: string): GalleryAccessRead {
  const parts = token.split(".");
  if (parts[0] !== "v1") return { ok: false, role: "viewer" };
  let role: GalleryRole;
  let tokenGallery: string;
  let tokenFingerprint: string;
  let expValue: string;
  let signature: string;
  if (parts.length === 5) {
    role = "viewer";
    [, tokenGallery, tokenFingerprint, expValue, signature] = parts;
  } else if (parts.length === 6) {
    const [, galleryValue, roleValue, fingerprintValue, expiryValue, sigValue] = parts;
    if (roleValue !== "viewer" && roleValue !== "client") return { ok: false, role: "viewer" };
    role = roleValue;
    tokenGallery = galleryValue;
    tokenFingerprint = fingerprintValue;
    expValue = expiryValue;
    signature = sigValue;
  } else {
    return { ok: false, role: "viewer" };
  }
  if (tokenGallery !== galleryId) return { ok: false, role };
  const expectedFingerprint = role === "client" ? clientFingerprint : fingerprint;
  if (!expectedFingerprint || tokenFingerprint !== expectedFingerprint) return { ok: false, role };
  const expiresAt = Number(expValue);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return { ok: false, role };
  // Legacy 5-part tokens were signed before roles existed, so their payload has
  // no role segment. Rebuilding with the role segment would invalidate every
  // pre-existing viewer session.
  const payload = parts.length === 5
    ? `v1.${tokenGallery}.${tokenFingerprint}.${expValue}`
    : `v1.${tokenGallery}.${role}.${tokenFingerprint}.${expValue}`;
  const expected = createHmac("sha256", accessSecret()).update(payload).digest("base64url");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return { ok: false, role };
  if (!timingSafeEqual(actual, wanted)) return { ok: false, role };
  return { ok: true, role };
}

export function hashIp(ip: string) {
  return createHash("sha256").update(`${accessSecret()}:ip:${ip}`).digest("hex");
}

export function hashViewerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Stable viewer token derived from the client's email. Deterministic per email so
 *  the same client always maps back to the same favourites for a gallery. The email
 *  itself is never stored — only an HMAC-sealed digest. */
export function signViewerIdentity(email: string) {
  const normalized = email.trim().toLowerCase();
  const digest = createHash("sha256").update(`viewer-email:v1:${normalized}`).digest("base64url");
  const signature = createHmac("sha256", accessSecret()).update(`viewer-identity:v1:${digest}`).digest("base64url");
  return `idv1.${digest}.${signature}`;
}

export function photoShareToken(photoId: string) {
  return createHmac("sha256", accessSecret()).update(`photo-share:v1:${photoId}`).digest("base64url");
}

export function accessCookieName(galleryId: string) {
  return `ga_${galleryId}`;
}

export const ACCESS_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Lightweight PROFILE cookie. This is identity only — never a credential. It
 * carries the database profile id sealed with the shared secret so a visitor
 * cannot forge or rewrite another person's profile, but it grants no role on
 * its own: Plus access still requires the client PIN.
 */
export const PROFILE_COOKIE = "dp_profile";
export const PROFILE_MAX_AGE = 60 * 60 * 24 * 180;

export function signProfileIdentity(profileId: string, expiresAt: number) {
  const payload = `pid.v1.${profileId}.${expiresAt}`;
  const signature = createHmac("sha256", accessSecret()).update(`profile-identity:v1:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function readProfileIdentity(token: string): { profileId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [prefix, version, profileId, expiryValue, signature] = parts;
  if (prefix !== "pid" || version !== "v1" || !profileId) return null;
  const expiresAt = Number(expiryValue);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return null;
  const payload = `pid.v1.${profileId}.${expiryValue}`;
  const expected = createHmac("sha256", accessSecret()).update(`profile-identity:v1:${payload}`).digest("base64url");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return null;
  if (!timingSafeEqual(actual, wanted)) return null;
  return { profileId };
}
