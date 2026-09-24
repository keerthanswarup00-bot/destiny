import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  ACCESS_MAX_AGE,
  accessCookieName,
  fingerprintPassword,
  readGalleryAccess,
  signGalleryAccess,
  type GalleryRole,
} from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";

export type PublicGallery = { id: string; slug: string; title: string; description: string | null };

export type GalleryAccess =
  | { state: "unavailable" }
  | { state: "password"; slug: string }
  | { state: "granted"; gallery: PublicGallery; role: GalleryRole; clientGate: boolean };

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
  const { data } = await db.from("galleries").select("id,slug,title,description,status,password_hash,client_password_hash").eq("slug", slug).maybeSingle();
  if (!data || data.status !== "published") return null;
  return data;
}

export async function resolveGalleryAccess(slug: string): Promise<GalleryAccess> {
  const gallery = await loadPublishedGallery(slug);
  if (!gallery) return { state: "unavailable" };
  const base = { id: gallery.id, slug: gallery.slug, title: gallery.title, description: gallery.description };
  const clientGate = Boolean(gallery.client_password_hash);
  const acceptsCookies = Boolean(gallery.password_hash || gallery.client_password_hash);
  if (!acceptsCookies) {
    return { state: "granted", gallery: base, role: "viewer", clientGate };
  }
  const viewerFingerprint = gallery.password_hash ? fingerprintPassword(gallery.password_hash) : null;
  const clientFingerprint = gallery.client_password_hash ? fingerprintPassword(gallery.client_password_hash) : null;
  const jar = await cookies();
  const token = jar.get(accessCookieName(gallery.id))?.value;
  if (token) {
    try {
      const clientRead = readGalleryAccess(token, gallery.id, viewerFingerprint ?? "", clientFingerprint ?? undefined);
      if (clientRead.ok && clientRead.role === "client") {
        return { state: "granted", gallery: base, role: "client", clientGate };
      }
      const viewerRead = readGalleryAccess(token, gallery.id, viewerFingerprint ?? "", clientFingerprint ?? undefined);
      if (viewerRead.ok) {
        return { state: "granted", gallery: base, role: viewerRead.role, clientGate };
      }
    } catch {
      // A malformed cookie falls through to the gate below.
    }
  }
  // A gallery with only a client password stays open to viewers; the client
  // password is requested in-gallery so viewer access is never blocked.
  if (!gallery.password_hash) {
    return { state: "granted", gallery: base, role: "viewer", clientGate };
  }
  return { state: "password", slug: gallery.slug };
}

export async function requireGalleryAccess(slug: string): Promise<PublicGallery> {
  const access = await resolveGalleryAccess(slug);
  if (access.state !== "granted") notFound();
  return access.gallery;
}

/** Resolve the current access role for a gallery, or null when not granted. */
export async function galleryAccessRole(slug: string): Promise<GalleryRole | null> {
  const access = await resolveGalleryAccess(slug);
  return access.state === "granted" ? access.role : null;
}

/** Return the gallery only when the current session holds CLIENT access. */
export async function requireClientGalleryAccess(slug: string): Promise<PublicGallery | null> {
  const access = await resolveGalleryAccess(slug);
  if (access.state !== "granted" || access.role !== "client") return null;
  return access.gallery;
}

export async function grantGalleryAccess(galleryId: string, role: GalleryRole, passwordHash: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE;
  const jar = await cookies();
  jar.set(accessCookieName(galleryId), signGalleryAccess(galleryId, role, fingerprintPassword(passwordHash), expiresAt), cookieOptions(ACCESS_MAX_AGE));
}
