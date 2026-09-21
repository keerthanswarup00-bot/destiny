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
  created_at: string;
};

/** Signed, newest-first previews for the public /gallery feed. */
export async function getWebsiteGalleryImages(): Promise<(WebsiteImageRow & { url: string })[]> {
  const db = galleryDb();
  const galleryId = await websiteGalleryId(db);
  if (!galleryId) return [];

  const { data } = await db
    .from("photos")
    .select("id,filename,original_path,mime_type,bytes,width,height,created_at")
    .eq("gallery_id", galleryId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  const rows = (data ?? []) as WebsiteImageRow[];
  if (!rows.length) return [];

  const urls = await photoStore().signedGetUrls(
    rows.map(row => row.original_path),
    CLIENT_SIGNED_URL_SECONDS,
  );
  return rows
    .map(row => ({ ...row, url: urls.get(row.original_path) ?? "" }))
    .filter(row => Boolean(row.url));
}