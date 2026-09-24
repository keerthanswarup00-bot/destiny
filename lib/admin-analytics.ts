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

export type GalleryEmailRow = {
  email: string;
  firstSeenLabel: string;
  lastSeenLabel: string;
  selections: number;
  views: number;
  optedIn: boolean;
};

/** gallery_views stores identified visitors as "profile:<uuid>" (see migration
 *  20260926000000_client_gallery_views.sql); anonymous rows use "ip:<sha256>" and
 *  map to no profile. Derive the profile id, or null for anonymous rows. */
function profileIdFromVisitorKey(visitorKey: string | null): string | null {
  if (!visitorKey) return null;
  const prefix = "profile:";
  return visitorKey.startsWith(prefix) && visitorKey.length > prefix.length ? visitorKey.slice(prefix.length) : null;
}

/**
 * Emails captured for one gallery: profiles that have viewed the gallery or
 * made a selection, ordered by most recent activity. Admin-only surface —
 * profiles and gallery_views are both RLS-locked to admins/service role.
 */
export async function galleryEmails(galleryId: string, limit = 100): Promise<GalleryEmailRow[]> {
  try {
    const db = await adminDb();
    const [views, selections] = await Promise.all([
      db.from("gallery_views").select("visitor_key,view_count,last_viewed_at").eq("gallery_id", galleryId),
      db.from("selections").select("profile_id").eq("gallery_id", galleryId),
    ]);
    const viewRows = (views.data ?? [])
      .map(row => ({ profileId: profileIdFromVisitorKey(row.visitor_key), views: Number(row.view_count) || 0, lastView: row.last_viewed_at }))
      .filter((row): row is { profileId: string; views: number; lastView: string } => Boolean(row.profileId));
    const selectionRows = selections.data ?? [];
    const ids = new Set<string>();
    for (const row of viewRows) ids.add(row.profileId);
    for (const row of selectionRows) if (row.profile_id) ids.add(row.profile_id);
    if (ids.size === 0) return [];

    const { data: profiles } = await db.from("profiles").select("id,email,created_at,marketing_optin").in("id", [...ids]);
    const byId = new Map((profiles ?? []).map(profile => [profile.id, profile]));

    const selectionCount = new Map<string, number>();
    for (const row of selectionRows) {
      if (row.profile_id) selectionCount.set(row.profile_id, (selectionCount.get(row.profile_id) ?? 0) + 1);
    }
    const viewsByProfile = new Map<string, number>();
    const lastByProfile = new Map<string, string | null>();
    for (const row of viewRows) {
      viewsByProfile.set(row.profileId, (viewsByProfile.get(row.profileId) ?? 0) + row.views);
      if (row.lastView && (!lastByProfile.has(row.profileId) || (lastByProfile.get(row.profileId) ?? "") < row.lastView)) {
        lastByProfile.set(row.profileId, row.lastView);
      }
    }

    type RowWithSort = GalleryEmailRow & { sortKey: string };
    const rows: RowWithSort[] = [];
    for (const id of ids) {
      const profile = byId.get(id);
      if (!profile) continue;
      const lastSeen = lastByProfile.get(id) ?? null;
      rows.push({
        email: profile.email,
        firstSeenLabel: relativeTimeLabel(profile.created_at),
        lastSeenLabel: relativeTimeLabel(lastSeen),
        selections: selectionCount.get(id) ?? 0,
        views: viewsByProfile.get(id) ?? 0,
        optedIn: Boolean(profile.marketing_optin),
        sortKey: lastSeen ?? "",
      });
    }
    rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey) || a.email.localeCompare(b.email));
    return rows.slice(0, limit).map(({ sortKey: _sortKey, ...row }) => row);
  } catch {
    return [];
  }
}