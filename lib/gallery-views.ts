import "server-only";
import { headers } from "next/headers";
import { hashIp } from "@/lib/gallery-cookie";
import { galleryDb } from "@/lib/gallery-db";

/**
 * Visitor gallery-view analytics.
 *
 * Records ONE gallery overview visit via the `record_gallery_view` upsert
 * (view_count + 1) — set switching, lightbox, favourites, downloads, shares and
 * keeping the email dialog open never touch this table. Strictly best-effort: a
 * failure here must never break gallery rendering, so every path is swallowed
 * and the caller never awaits the outcome.
 */
export async function recordGalleryView(galleryId: string, profileId: string | null): Promise<void> {
  try {
    const visitorKey = profileId
      ? `profile:${profileId}`
      : `ip:${await requestFingerprint()}`;
    await galleryDb().rpc("record_gallery_view", { p_gallery_id: galleryId, p_visitor_key: visitorKey });
  } catch {
    // Best-effort analytics only; never break the gallery load.
  }
}

async function requestFingerprint(): Promise<string> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || headerList.get("x-real-ip") || "unknown";
    return hashIp(ip);
  } catch {
    return "unknown";
  }
}