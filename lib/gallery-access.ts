import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  ACCESS_MAX_AGE,
  VIEWER_COOKIE,
  VIEWER_MAX_AGE,
  accessCookieName,
  fingerprintPassword,
  hashViewerToken,
  readGalleryAccess,
  signGalleryAccess,
} from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";

export type PublicGallery = { id: string; slug: string; title: string; description: string | null };

export type GalleryAccess =
  | { state: "unavailable" }
  | { state: "password"; slug: string }
  | { state: "granted"; gallery: PublicGallery };

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

async function loadPublishedGallery(slug: string) {
  const db = galleryDb();
  const { data } = await db.from("galleries").select("id,slug,title,description,status,password_hash").eq("slug", slug).maybeSingle();
  if (!data || data.status !== "published") return null;
  return data;
}

export async function resolveGalleryAccess(slug: string): Promise<GalleryAccess> {
  const gallery = await loadPublishedGallery(slug);
  if (!gallery) return { state: "unavailable" };
  if (!gallery.password_hash) {
    return { state: "granted", gallery: { id: gallery.id, slug: gallery.slug, title: gallery.title, description: gallery.description } };
  }
  const jar = await cookies();
  const token = jar.get(accessCookieName(gallery.id))?.value;
  try {
    const fingerprint = fingerprintPassword(gallery.password_hash);
    if (!token || !readGalleryAccess(token, gallery.id, fingerprint)) {
      return { state: "password", slug: gallery.slug };
    }
  } catch {
    return { state: "password", slug: gallery.slug };
  }
  return { state: "granted", gallery: { id: gallery.id, slug: gallery.slug, title: gallery.title, description: gallery.description } };
}

export async function requireGalleryAccess(slug: string): Promise<PublicGallery> {
  const access = await resolveGalleryAccess(slug);
  if (access.state !== "granted") notFound();
  return access.gallery;
}

export async function grantGalleryAccess(galleryId: string, passwordHash: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE;
  const jar = await cookies();
  jar.set(accessCookieName(galleryId), signGalleryAccess(galleryId, fingerprintPassword(passwordHash), expiresAt), cookieOptions(ACCESS_MAX_AGE));
}

export async function viewerKeyHash() {
  const jar = await cookies();
  const existing = jar.get(VIEWER_COOKIE)?.value;
  if (!existing || existing.length < 32) return null;
  return hashViewerToken(existing);
}

export async function ensureViewerKeyHash() {
  const jar = await cookies();
  let token = jar.get(VIEWER_COOKIE)?.value;
  if (!token || token.length < 32) {
    token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    jar.set(VIEWER_COOKIE, token, cookieOptions(VIEWER_MAX_AGE));
  }
  return hashViewerToken(token);
}
