import sharp from "sharp";
import { GALLERY_SOCIAL_IMAGE_LONG_EDGE, GALLERY_SOCIAL_IMAGE_QUALITY, gallerySocialCover } from "@/lib/gallery-social";
import { photoStore } from "@/lib/storage-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Controlled social preview for client-gallery links (WhatsApp, Facebook,
 * Messenger, iMessage, Twitter/X, ...). Serves ONLY the gallery highlight/cover
 * photo — the same watermarked preview the gallery landing page shows — as a
 * JPEG re-encode, so link crawlers can fetch a stable, universally-supported
 * image that never exposes the private original or the broader set.
 *
 * gallerySocialCover refuses unpublished and password-protected galleries, so
 * this route returns 404 for both — a protected gallery's cover is never
 * reachable through this endpoint.
 */
const COVER_CACHE_SECONDS = 60 * 60;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cover = await gallerySocialCover(slug, "full");
  if (!cover?.path) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" } });
  }
  const bytes = await photoStore().downloadBytes(cover.path);
  if (!bytes) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" } });
  }
  let jpeg: Buffer;
  try {
    jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: GALLERY_SOCIAL_IMAGE_LONG_EDGE, height: GALLERY_SOCIAL_IMAGE_LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: GALLERY_SOCIAL_IMAGE_QUALITY })
      .toBuffer();
  } catch {
    return new Response("Unavailable", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.byteLength),
      "Cache-Control": `public, max-age=${COVER_CACHE_SECONDS}, s-maxage=${COVER_CACHE_SECONDS * 24}, stale-while-revalidate=${86400 * 7}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}