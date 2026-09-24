import "server-only";
import { adminDb } from "@/lib/admin-data";

/**
 * Admin-only read surface for gallery visitor analytics.
 *
 * gallery_views stores ONE row per (gallery, visitor) with an aggregated
 * view_count (see migration 20260926000000_client_gallery_views.sql and
 * lib/gallery-views.ts). These helpers aggregate that data for the admin
 * Insights card and the dashboard. visitor_key is never read by the admin UI.
 */
export type GalleryViewStats = {
  uniqueVisitors: number;
  returningVisitors: number;
  totalViews: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
};

export const EMPTY_VIEW_STATS: GalleryViewStats = {
  uniqueVisitors: 0,
  returningVisitors: 0,
  totalViews: 0,
  firstViewedAt: null,
  lastViewedAt: null,
};

export async function galleryViewStats(galleryId: string): Promise<GalleryViewStats> {
  try {
    const db = await adminDb();
    const { data, error } = await db
      .from("gallery_views")
      .select("view_count,first_viewed_at,last_viewed_at")
      .eq("gallery_id", galleryId);
    if (error || !data) return EMPTY_VIEW_STATS;
    let totalViews = 0;
    let returningVisitors = 0;
    let firstViewedAt: string | null = null;
    let lastViewedAt: string | null = null;
    for (const row of data) {
      const views = Number(row.view_count) || 0;
      totalViews += views;
      if (views > 1) returningVisitors += 1;
      if (row.first_viewed_at && (!firstViewedAt || row.first_viewed_at < firstViewedAt)) firstViewedAt = row.first_viewed_at;
      if (row.last_viewed_at && (!lastViewedAt || row.last_viewed_at > lastViewedAt)) lastViewedAt = row.last_viewed_at;
    }
    return { uniqueVisitors: data.length, returningVisitors, totalViews, firstViewedAt, lastViewedAt };
  } catch {
    return EMPTY_VIEW_STATS;
  }
}

export async function dashboardViewsTotal(): Promise<number> {
  try {
    const db = await adminDb();
    const { data } = await db.from("gallery_views").select("view_count");
    return (data ?? []).reduce((sum, row) => sum + (Number(row.view_count) || 0), 0);
  } catch {
    return 0;
  }
}

/** Short relative label like "2 h ago" / "3 d ago" / today's date. */
export function relativeTimeLabel(value: string | null, now: Date = new Date()): string {
  if (!value) return "Never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Never";
  const diff = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(value).toLocaleDateString();
}