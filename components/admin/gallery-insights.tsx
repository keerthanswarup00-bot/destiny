import { BarChart3, Mail } from "lucide-react";
import type { GalleryEmailRow } from "@/lib/admin-analytics";

export type GalleryInsightsValue = {
  uniqueVisitors: number;
  returningVisitors: number;
  totalViews: number;
  firstViewedLabel: string;
  lastViewedLabel: string;
  emails?: GalleryEmailRow[];
};

/**
 * Read-only visit analytics for this gallery, aggregated from gallery_views
 * (one row per visitor; totals/labels are precomputed server-side by
 * lib/admin-analytics.ts). Shown only in admin settings — never public.
 */
export function GalleryInsights({ insights }: { insights: GalleryInsightsValue }) {
  const emails = insights.emails ?? [];
  return (
    <section className="gs-card" id="settings-insights">
      <div className="gs-card-head">
        <h2>Insights</h2>
        <p>Who has opened this gallery share link.</p>
      </div>
      <div className="gs-card-body">
        <dl className="gs-insights-grid">
          <div>
            <dt>Total views</dt>
            <dd>{insights.totalViews}</dd>
          </div>
          <div>
            <dt>Unique visitors</dt>
            <dd>{insights.uniqueVisitors}</dd>
          </div>
          <div>
            <dt>Returning</dt>
            <dd>{insights.returningVisitors}</dd>
          </div>
          <div>
            <dt>Last viewed</dt>
            <dd>{insights.lastViewedLabel}</dd>
          </div>
          <div>
            <dt>First viewed</dt>
            <dd>{insights.firstViewedLabel}</dd>
          </div>
        </dl>
        <p className="gs-insights-hint">
          <BarChart3 size={13} strokeWidth={1.8} />
          Each time the share link opens counts as a view; unique visitors counts distinct people (one per device). Anonymous viewers use a hashed address and are never shown.
        </p>
        {emails.length ? <EmailList rows={emails} /> : <p className="gs-insights-hint">No visitors have entered their email for this gallery yet.</p>}
      </div>
    </section>
  );
}

function EmailList({ rows }: { rows: GalleryEmailRow[] }) {
  const optedIn = rows.reduce((sum, row) => sum + (row.optedIn ? 1 : 0), 0);
  return (
    <div className="gs-emails">
      <div className="gs-emails-head">
        <h3><Mail size={14} strokeWidth={1.8} /> Client emails</h3>
        <span>{rows.length} captured{optedIn ? ` · ${optedIn} opted in` : ""}</span>
      </div>
      <ul className="gs-emails-list">
        {rows.map(row => (
          <li key={row.email}>
            <span className="gs-emails-email">{row.email}{row.optedIn ? <em className="gs-emails-optin">Opted in</em> : null}</span>
            <span>{row.selections ? `${row.selections} selection${row.selections === 1 ? "" : "s"}` : "No selection"}</span>
            <span>{row.lastSeenLabel === "Never" ? "Not viewed" : `Active ${row.lastSeenLabel}`}</span>
          </li>
        ))}
      </ul>
      <p className="gs-insights-hint">Only people who entered their email in this gallery appear here. Contact only the visitors marked “Opted in”.</p>
    </div>
  );
}