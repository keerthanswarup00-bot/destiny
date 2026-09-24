import "server-only";
import { clientFacingObjectPath } from "@/lib/client-media";
import { galleryDb } from "@/lib/gallery-db";
import { resolvePhotoDimensions } from "@/lib/gallery-data";

/**
 * Social/link-preview support for public client-gallery URLs (WhatsApp,
 * Facebook, Messenger, iMessage, Twitter/X, ...).
 *
 * The gallery's photos themselves stay private behind signed URLs and the
 * gallery access flow. The ONLY object we ever expose through this module is
 * the gallery highlight/cover photo — the same image the gallery landing page
 * already shows — served as a watermarked client derivative from a dedicated
 * public route, never the private original and never the broader set.
 *
 * Security: password-protected galleries are never resolved here. A truthy
 * galleries.password_hash means the gallery is gated by GalleryGate; exposing
 * its cover through the unauthenticated cover route would leak preview content
 * past the password, so those galleries yield no cover (the route 404s).
 */

export const GALLERY_SOCIAL_DESCRIPTION = "Destiny Events & Photography";

/** Long edge of the JPEG the cover route serves (fit inside). */
export const GALLERY_SOCIAL_IMAGE_LONG_EDGE = 1200;
/** JPEG quality of the re-encoded cover route output. */
export const GALLERY_SOCIAL_IMAGE_QUALITY = 85;

/**
 * Public origin used for absolute og:url/og:image values. Prefers the Vercel
 * deployment URL, then the current request host (custom domain / local dev),
 * so link previews always point at the same public host the request arrived
 * on — even outside Vercel.
 */
export function siteOrigin(preferHost?: string | null): string {
  const configuredHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const host = configuredHost || preferHost || null;
  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("site-origin-not-configured");
    return "http://localhost:3000";
  }
  const secure = process.env.NODE_ENV === "production";
  return `${secure ? "https" : "http"}://${host}`;
}

/** Best-effort request host for the current request (deployed + dev). */
export function requestHost(headers: { get(name: string): string | null }): string | null {
  return headers.get("x-forwarded-host") || headers.get("host");
}

/** Stable public path serving the gallery's highlight image for link crawlers. */
export function galleryCoverImagePath(slug: string): string {
  return `/gallery/${slug}/cover-image`;
}

export type GallerySocialCover = {
  galleryId: string;
  slug: string;
  title: string;
  /** Watermarked client derivative object path (never the private original). */
  path: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Dimensions of the JPEG served by the cover route (fit inside `longEdge`).
 * Returns null when the stored photo dimensions are unknown; the metadata then
 * simply omits og:image:width/height instead of lying.
 */
export function socialCoverImageSize(cover: Pick<GallerySocialCover, "width" | "height">, longEdge: number = GALLERY_SOCIAL_IMAGE_LONG_EDGE): { width: number; height: number } | null {
  if (!cover.width || !cover.height) return null;
  const scale = Math.min(1, longEdge / Math.max(cover.width, cover.height));
  return {
    width: Math.max(1, Math.round(cover.width * scale)),
    height: Math.max(1, Math.round(cover.height * scale)),
  };
}

/**
 * Resolve the highlight/cover photo for a published gallery.
 *
 * The primary source is the ONE gallery-level highlight
 * (`galleries.highlight_photo_id`) — the same photo the client-gallery landing
 * hero shows. Galleries that have not configured a highlight fall back to the
 * legacy rule (first published set's explicit cover, else its first photo) so
 * link previews keep working. Returns null when the gallery is
 * unpublished/unknown or has no visible cover.
 */
export async function gallerySocialCover(slug: string, derivative: "full" | "grid" = "full"): Promise<GallerySocialCover | null> {
  const db = galleryDb();
  const { data: gallery } = await db.from("galleries").select("id,slug,title,status,password_hash,highlight_photo_id").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!gallery) return null;

  // Mirrors resolveGalleryAccess: a truthy password_hash means the gallery is
  // password-gated. Never resolve a cover for it so the public cover route
  // returns 404 and link-preview metadata falls back to the site branding image
  // instead of the protected cover.
  if (gallery.password_hash) return null;

  // 1) Gallery-level highlight (any set — matches the client hero).
  if (gallery.highlight_photo_id) {
    const { data: photo } = await db
      .from("photos")
      .select("id,thumbnail_path,preview_path,original_path,width,height")
      .eq("id", gallery.highlight_photo_id)
      .eq("gallery_id", gallery.id)
      .maybeSingle();
    if (photo) {
      const path = clientFacingObjectPath(photo, derivative) ?? clientFacingObjectPath(photo, "grid");
      if (path) {
        const { width, height } = await resolvePhotoDimensions(photo);
        return {
          galleryId: gallery.id,
          slug: gallery.slug,
          title: gallery.title,
          path,
          width,
          height,
        };
      }
    }
  }

  const [{ data: folders }, { data: photos }] = await Promise.all([
    db.from("folders").select("id,sort_order,published,cover_photo_id").eq("gallery_id", gallery.id).eq("published", true).order("sort_order").order("id"),
    db.from("photos").select("id,folder_id,sort_order,thumbnail_path,preview_path,original_path,width,height").eq("gallery_id", gallery.id).order("sort_order").order("id"),
  ]);

  for (const folder of folders ?? []) {
    const folderPhotos = (photos ?? [])
      .filter(photo => photo.folder_id === folder.id)
      .sort((a, b) => a.sort_order - b.sort_order || 0);
    // Cover picker mirrors galleryFolders: explicit cover_photo_id of THIS set,
    // else this set's first photo. Never another set, never gallery-wide.
    const chosen = folderPhotos.find(photo => photo.id === folder.cover_photo_id) ?? folderPhotos[0];
    if (!chosen) continue;
    const path = clientFacingObjectPath(chosen, derivative) ?? clientFacingObjectPath(chosen, "grid");
    if (!path) continue;
    const { width, height } = await resolvePhotoDimensions(chosen);
    return {
      galleryId: gallery.id,
      slug: gallery.slug,
      title: gallery.title,
      path,
      width,
      height,
    };
  }
  return null;
}