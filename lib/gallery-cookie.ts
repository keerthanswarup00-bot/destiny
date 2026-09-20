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

export function signGalleryAccess(galleryId: string, fingerprint: string, expiresAt: number) {
  const payload = `v1.${galleryId}.${fingerprint}.${expiresAt}`;
  const signature = createHmac("sha256", accessSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readGalleryAccess(token: string, galleryId: string, fingerprint: string) {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return false;
  const [, tokenGallery, tokenFingerprint, expValue, signature] = parts;
  if (tokenGallery !== galleryId || tokenFingerprint !== fingerprint) return false;
  const expiresAt = Number(expValue);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return false;
  const payload = `v1.${tokenGallery}.${tokenFingerprint}.${expValue}`;
  const expected = createHmac("sha256", accessSecret()).update(payload).digest("base64url");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export function hashIp(ip: string) {
  return createHash("sha256").update(`${accessSecret()}:ip:${ip}`).digest("hex");
}

export function hashViewerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function photoShareToken(photoId: string) {
  return createHmac("sha256", accessSecret()).update(`photo-share:v1:${photoId}`).digest("base64url");
}

export function accessCookieName(galleryId: string) {
  return `ga_${galleryId}`;
}

export const VIEWER_COOKIE = "ga_viewer";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 7;
export const VIEWER_MAX_AGE = 60 * 60 * 24 * 30;
