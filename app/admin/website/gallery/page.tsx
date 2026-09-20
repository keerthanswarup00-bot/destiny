import { GalleryHorizontalEnd } from "lucide-react";
import { adminDb } from "@/lib/admin-data";
import { galleryOverviews } from "@/lib/gallery-data";
import { WebsiteTabs } from "@/components/admin/website-tabs";
import { saveGalleryPortfolio } from "@/app/admin/website/actions";

export default async function WebsiteGalleryPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const db = await adminDb();
  const [galleriesResult, storiesResult] = await Promise.all([
    db.from("galleries").select("id,title,slug,status,category,location,portfolio_sort,show_in_portfolio").order("portfolio_sort").order("title"),
    db.from("site_stories").select("gallery_id"),
  ]);
  const galleries = galleriesResult.data ?? [];
  const featuredIds = new Set((storiesResult.data ?? []).map(row => row.gallery_id));
  const covers = await galleryOverviews(Array.from(galleries, gallery => gallery.id));
  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Gallery</h1>
          <p className="muted">Curate the public portfolio. Mark galleries as portfolio pieces, feature them on the homepage, and set their order.</p>
        </div>
      </div>
      <WebsiteTabs />
      {saved ? <p className="saved-note" style={{ marginBottom: 14 }}>Saved.</p> : null}
      <section className="admin-panel">
        <div className="panel-heading"><h2>Portfolio galleries</h2><span className="hint">Titles, descriptions, covers and visibility are set inside each Gallery Set.</span></div>
        {galleries.length === 0 ? (
          <p className="placeholder">No galleries yet. Create one under Gallery Sets first.</p>
        ) : (
          galleries.map(gallery => {
            const cover = covers.get(gallery.id);
            return (
              <div className="portfolio-card" key={gallery.id}>
                <div className="portfolio-cover">{cover?.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={gallery.title} src={cover.coverUrl} />
                ) : "—"}</div>
                <div className="portfolio-card-main">
                  <div className="portfolio-card-head">
                    <strong>{gallery.title}</strong>
                    <span className={`status-pill ${gallery.status}`}>{gallery.status}</span>
                    {featuredIds.has(gallery.id) ? <span className="status-pill published">Featured</span> : null}
                  </div>
                  <form action={saveGalleryPortfolio}>
                    <input name="id" type="hidden" value={gallery.id} />
                    <div className="field-row">
                      <div className="field"><span>Category</span><input defaultValue={gallery.category ?? ""} name="category" placeholder="Wedding, Event, Portrait…" type="text" /></div>
                      <div className="field"><span>Location</span><input defaultValue={gallery.location ?? ""} name="location" placeholder="Udaipur, India" type="text" /></div>
                      <div className="field"><span>Sort order</span><input defaultValue={gallery.portfolio_sort} min={0} name="portfolio_sort" type="number" /></div>
                    </div>
                    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                      <label className="checkbox-field"><input defaultChecked={gallery.show_in_portfolio} name="show_in_portfolio" type="checkbox" /> Show in public portfolio</label>
                      <label className="checkbox-field"><input defaultChecked={featuredIds.has(gallery.id)} name="featured" type="checkbox" /> Featured on homepage</label>
                      <button className="admin-button" style={{ background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 5 }} type="submit"><GalleryHorizontalEnd size={14} /> Save</button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}