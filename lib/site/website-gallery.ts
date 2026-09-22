import "server-only";

import { CLIENT_SIGNED_URL_SECONDS } from "@/lib/client-media";
import { galleryDb } from "@/lib/gallery-db";
import { photoStore } from "@/lib/storage-provider";

/* ---------------------------------------------------------------------------
   Website Gallery.

   The public /gallery feed is backed by the EXISTING galleries + folders +
   photos schema so there is a single source of truth for image storage. A
   dedicated, system-managed gallery set ("Website Gallery") holds the public
   feed images. It is identified by its fixed slug, always stays draft (never
   reachable as a client link), and is kept out of the public portfolio. Site
   reads and admin deletes scope strictly to this set, so private
   client-gallery photos are never touched.

   Storage reuses photoStore() (Supabase for now) under the "website-gallery/"
   key prefix. No schema changes, no second storage system.
--------------------------------------------------------------------------- */

export const WEBSITE_GALLERY_SLUG = "website-gallery";
export const WEBSITE_GALLERY_TITLE = "Website Gallery";
export const WEBSITE_GALLERY_DESCRIPTION =
  "Photographs shown on the public website gallery. Managed from Admin - Website - Gallery.";
export const WEBSITE_CLIENT_NAME = "Website Gallery";
export const WEBSITE_CLIENT_NOTES =
  "System-managed set that hosts the public website gallery feed. Do not delete.";
export const WEBSITE_FOLDER_SLUG = "website-images";
export const WEBSITE_FOLDER_NAME = "Website Images";
export const WEBSITE_IMAGE_PREFIX = "website-gallery";
export const WEBSITE_GALLERY_CATEGORIES = ["wedding", "events", "portraits", "celebrations"] as const;
export type WebsiteGalleryCategory = (typeof WEBSITE_GALLERY_CATEGORIES)[number];

export function normalizeWebsiteGalleryCategory(value: string | null | undefined): WebsiteGalleryCategory | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "weddings") return "wedding";
  if (normalized === "event") return "events";
  if (normalized === "portrait") return "portraits";
  if (normalized === "celebration") return "celebrations";
  return (WEBSITE_GALLERY_CATEGORIES as readonly string[]).includes(normalized)
    ? normalized as WebsiteGalleryCategory
    : null;
}

type WebsiteDb = ReturnType<typeof galleryDb>;

/** Storage key for one website-gallery image. */
export function websiteImageKey(id: string, ext: string): string {
  return `${WEBSITE_IMAGE_PREFIX}/${id}.${ext}`;
}

/** Look up the website-gallery set id (does not create anything). */
export async function websiteGalleryId(db: WebsiteDb): Promise<string | null> {
  const { data } = await db.from("galleries").select("id").eq("slug", WEBSITE_GALLERY_SLUG).maybeSingle();
  return data?.id ?? null;
}

export async function websiteGalleryExists(db: WebsiteDb): Promise<boolean> {
  return Boolean(await websiteGalleryId(db));
}

/** Idempotently create the system client + gallery + folder that host the feed. */
export async function ensureWebsiteGallery(db: WebsiteDb): Promise<{ galleryId: string; folderId: string } | null> {
  const existing = await websiteGalleryId(db);
  if (existing) {
    const { data: folder } = await db
      .from("folders")
      .select("id")
      .eq("gallery_id", existing)
      .eq("slug", WEBSITE_FOLDER_SLUG)
      .is("parent_folder_id", null)
      .maybeSingle();
    if (folder) return { galleryId: existing, folderId: folder.id };
    const created = await db
      .from("folders")
      .insert({ gallery_id: existing, name: WEBSITE_FOLDER_NAME, slug: WEBSITE_FOLDER_SLUG, sort_order: 0 })
      .select("id")
      .single();
    return created.data ? { galleryId: existing, folderId: created.data.id } : null;
  }

  const { data: client } = await db
    .from("clients")
    .insert({ name: WEBSITE_CLIENT_NAME, notes: WEBSITE_CLIENT_NOTES })
    .select("id")
    .single();
  if (!client) return null;

  const { data: gallery } = await db
    .from("galleries")
    .insert({
      client_id: client.id,
      title: WEBSITE_GALLERY_TITLE,
      slug: WEBSITE_GALLERY_SLUG,
      description: WEBSITE_GALLERY_DESCRIPTION,
      status: "draft",
      show_in_portfolio: false,
      portfolio_sort: 0,
    })
    .select("id")
    .single();
  if (!gallery) return null;

  const { data: folder } = await db
    .from("folders")
    .insert({ gallery_id: gallery.id, name: WEBSITE_FOLDER_NAME, slug: WEBSITE_FOLDER_SLUG, sort_order: 0 })
    .select("id")
    .single();
  if (!folder) return null;

  return { galleryId: gallery.id, folderId: folder.id };
}

export type WebsiteImageRow = {
  id: string;
  filename: string;
  original_path: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  category: WebsiteGalleryCategory | null;
  published: boolean;
  pending_delete: boolean;
  created_at: string;
};

/**
 * Normalized, non-destructive Highlight crop.
 *
 * The public /gallery Highlight banner and the admin editor share the same
 * 16/9 frame. `zoom >= 1` is the magnification above the no-crop cover fit;
 * `x` and `y` are the 0..1 point of the cover-fit image centered in the frame
 * (0.5/0.5 + zoom 1 renders the plain centered cover image - "no crop").
 */
export type HighlightCrop = { x: number; y: number; zoom: number };

/** Maximum zoom the editor and public render will accept. */
export const HIGHLIGHT_MAX_ZOOM = 8;

/** Coerce/validate a persisted highlight crop into a clean normalized one. */
export function normalizeHighlightCrop(value: unknown): HighlightCrop | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  const zoom = Number(record.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    zoom: Math.min(HIGHLIGHT_MAX_ZOOM, Math.max(1, zoom)),
  };
}

export type WebsiteHighlight = {
  photo: WebsiteImageRow & { url: string };
  crop: HighlightCrop | null;
};

/**
 * The signed Highlight banner photo for the public /gallery feed, if a
 * published highlight photo exists. Only published photos surface publicly;
 * unpublished highlights are skipped rather than rendered from working data.
 */
export async function getWebsiteGalleryHighlight(): Promise<WebsiteHighlight | null> {
  const db = galleryDb();
  const galleryId = await websiteGalleryId(db);
  if (!galleryId) return null;
  const { data: gallery } = await db
    .from("galleries")
    .select("highlight_photo_id,highlight_crop")
    .eq("id", galleryId)
    .maybeSingle();
  if (!gallery?.highlight_photo_id) return null;

  const { data: photo } = await db
    .from("photos")
    .select("id,filename,original_path,mime_type,bytes,width,height,published_category,published,pending_delete,created_at")
    .eq("id", gallery.highlight_photo_id)
    .eq("gallery_id", galleryId)
    .eq("published", true)
    .maybeSingle();
  if (!photo) return null;

  const urls = await photoStore().signedGetUrls([photo.original_path], CLIENT_SIGNED_URL_SECONDS);
  const url = urls.get(photo.original_path);
  if (!url) return null;

  return {
    photo: {
      ...photo,
      category: photo.published_category as WebsiteImageRow["category"],
      url,
    },
    crop: normalizeHighlightCrop(gallery.highlight_crop),
  };
}

/** Signed, newest-first previews for the public /gallery feed. */
export async function getWebsiteGalleryImages(category?: WebsiteGalleryCategory | null): Promise<(WebsiteImageRow & { url: string })[]> {
  const db = galleryDb();
  const galleryId = await websiteGalleryId(db);
  if (!galleryId) return [];

  let query = db
    .from("photos")
    .select("id,filename,original_path,mime_type,bytes,width,height,published_category,published,pending_delete,created_at")
    .eq("gallery_id", galleryId)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (category) query = query.eq("published_category", category);
  const { data } = await query;
  const rows = (data ?? []).map(row => ({
    ...row,
    category: row.published_category,
  })) as WebsiteImageRow[];
  if (!rows.length) return [];

  const urls = await photoStore().signedGetUrls(
    rows.map(row => row.original_path),
    CLIENT_SIGNED_URL_SECONDS,
  );
  return rows
    .map(row => ({ ...row, url: urls.get(row.original_path) ?? "" }))
    .filter(row => Boolean(row.url));
}