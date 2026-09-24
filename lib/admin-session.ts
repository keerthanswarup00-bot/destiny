import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { accessSecret } from "@/lib/gallery-cookie";

export const ADMIN_SESSION_COOKIE = "destiny_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type AdminCredentials = { username: string; password: string };

export function getBasicAdminCredentials(): AdminCredentials | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

function adminFingerprint(username: string) {
  return createHash("sha256").update(`admin:${username}`).digest("base64url").slice(0, 16);
}

function signAdminCookie(username: string, issuedAt: number) {
  const fingerprint = adminFingerprint(username);
  const payload = `v1.${fingerprint}.${issuedAt}`;
  const signature = createHmac("sha256", accessSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAdminCookie(username: string, token: string) {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const [, fingerprint, issuedAtValue, signature] = parts;
  if (fingerprint !== adminFingerprint(username)) return false;
  const issuedAt = Number(issuedAtValue);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt * 1000 > ADMIN_SESSION_MAX_AGE * 1000) return false;
  const payload = `v1.${fingerprint}.${issuedAtValue}`;
  const expected = createHmac("sha256", accessSecret()).update(payload).digest("base64url");
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, Buffer.from(expected));
}

export function setAdminSessionCookie(response: NextResponse, username: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  response.cookies.set(ADMIN_SESSION_COOKIE, signAdminCookie(username, issuedAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0,
  });
}

export function createAdminSessionToken(username: string, issuedAt = Math.floor(Date.now() / 1000)) {
  return signAdminCookie(username, issuedAt);
}

export function credentialsMatch(provided: AdminCredentials, stored: AdminCredentials) {
  const a = Buffer.from(provided.username);
  const b = Buffer.from(stored.username);
  const p = Buffer.from(provided.password);
  const q = Buffer.from(stored.password);
  const u = a.length === b.length && timingSafeEqual(a, b);
  const w = p.length === q.length && timingSafeEqual(p, q);
  return u && w;
}
