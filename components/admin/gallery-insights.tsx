import { BarChart3 } from "lucide-react";

export type GalleryInsightsValue = {
  uniqueVisitors: number;
  returningVisitors: number;
  totalViews: number;
  firstViewedLabel: string;
  lastViewedLabel: string;
};

/**
 * Read-only visit analytics for this gallery, aggregated from gallery_views
 * (one row per visitor; totals/labels are precomputed server-side by
 * lib/admin-analytics.ts). Shown only in admin settings — never public.
 */
export function GalleryInsights({ insights }: { insights: GalleryInsightsValue }) {
  return (
    <section className="gs-card" id="settings-insights">
      <div className="gs-card-head">
        <h2>Insights</h2>
        <p>Who opened this gallery's share link.</p>
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
      </div>
    </section>
  );
}