import { Trash2 } from "lucide-react";
import { adminDb } from "@/lib/admin-data";
import { WebsiteTabs } from "@/components/admin/website-tabs";
import { getSiteHome, resolveSiteAssetPaths } from "@/lib/site/site-content";
import { saveApproach, saveCta, saveHomeHero, saveStoryRow, saveStoriesConfig, saveWhatWeDocument, removeStory } from "@/app/admin/website/actions";

function SavedNote({ saved }: { saved?: string }) {
  if (!saved) return null;
  return <span className="saved-note">Saved.</span>;
}

export default async function WebsiteHomePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const home = await getSiteHome();
  const assetUrls = await resolveSiteAssetPaths([home.hero.image_path, home.approach.image_path]);
  const db = await adminDb();
  const [{ data: storyRows }, { data: galleryRows }] = await Promise.all([
    db.from("site_stories").select("id,gallery_id,title,sort_order,published").order("sort_order").order("id"),
    db.from("galleries").select("id,title,slug"),
  ]);
  const galleryBy = new Map((galleryRows ?? []).map(gallery => [gallery.id, gallery]));

  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Home</h1>
          <p className="muted">The homepage, section by section. Everything saves live to the public site.</p>
        </div>
      </div>
      <WebsiteTabs />
      <div className="website-editor-sections">
        <section className="admin-panel">
          <div className="panel-heading"><h2>Hero</h2></div>
          <form action={saveHomeHero} className="ws-form">
            <div className="field-row">
              <div className="field"><span>Eyebrow</span><input defaultValue={home.hero.eyebrow} name="eyebrow" placeholder="DESTINY EVENTS + PHOTOGRAPHY" type="text" /></div>
              <div className="field"><span>Heading <span className="optional">(use \n for a line break)</span></span><textarea defaultValue={home.hero.heading} name="heading" rows={3} /></div>
            </div>
            <div className="field"><span>Description</span><textarea defaultValue={home.hero.description} name="description" rows={3} /></div>
            <div className="field-row">
              <div className="field"><span>Primary button label</span><input defaultValue={home.hero.primary_label} name="primary_label" type="text" /></div>
              <div className="field"><span>Primary button URL</span><input defaultValue={home.hero.primary_url} name="primary_url" type="text" /></div>
            </div>
            <div className="field-row">
              <div className="field"><span>Secondary button label</span><input defaultValue={home.hero.secondary_label} name="secondary_label" type="text" /></div>
              <div className="field"><span>Secondary button URL</span><input defaultValue={home.hero.secondary_url} name="secondary_url" type="text" /></div>
            </div>
            <div className="field">
              <span>Hero photograph <span className="optional">(JPEG, PNG, WebP up to 15MB)</span></span>
              <div className="asset-preview">
                {home.hero.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Current hero" src={assetUrls[home.hero.image_path]} />) : <span className="hint">No custom hero image — the built-in visual is used.</span>}
                <input accept="image/*" name="image" type="file" />
                <label className="checkbox-field"><input defaultChecked={false} name="remove_image" type="checkbox" /> Remove current image</label>
              </div>
            </div>
            <div className="form-actions"><button className="admin-button" type="submit">Save hero</button><SavedNote saved={saved} /></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><h2>What we document</h2></div>
          <form action={saveWhatWeDocument} className="ws-form">
            <label className="checkbox-field"><input defaultChecked={home.whatWeDocument.enabled} name="enabled" type="checkbox" /> Show this section on the homepage</label>
            <div className="field"><span>Label</span><input defaultValue={home.whatWeDocument.label} name="label" type="text" /></div>
            <div className="field"><span>Categories</span><span className="hint">Each enabled word becomes a hoverable tile linking to the gallery.</span></div>
            {home.whatWeDocument.items.map((item, index) => (
              <div className="field" key={index}><input defaultValue={item.label} name="labels" placeholder={`Category ${index + 1}`} type="text" /></div>
            ))}
            <div className="form-actions"><button className="admin-button" type="submit">Save section</button><SavedNote saved={saved} /></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><h2>Selected Stories</h2></div>
          <form action={saveStoriesConfig} className="ws-form">
            <label className="checkbox-field"><input defaultChecked={home.stories.enabled} name="enabled" type="checkbox" /> Show this section on the homepage</label>
            <div className="field"><span>Title</span><input defaultValue={home.stories.title} name="title" type="text" /></div>
            <div className="field"><span>Description</span><textarea defaultValue={home.stories.description} name="description" rows={2} /></div>
            <div className="form-actions"><button className="admin-button" type="submit">Save section</button><SavedNote saved={saved} /></div>
          </form>
          <div className="panel-heading" style={{ borderTop: "1px solid #eee" }}><h2>Featured stories</h2><span className="hint">Add or remove featured galleries from the Gallery tab; fine-tune order below.</span></div>
          <div>
            {(storyRows ?? []).length === 0 ? (
              <p className="placeholder">No featured stories yet. Open the Gallery tab and toggle “Featured on homepage” for a gallery.</p>
            ) : (
              (storyRows ?? []).map(story => {
                const gallery = galleryBy.get(story.gallery_id);
                return (
                  <div className="story-row" key={story.id}>
                    <div className="story-row-main"><strong>{story.title?.trim() || gallery?.title || "Untitled story"}</strong><span>{gallery?.slug}</span></div>
                    <form action={saveStoryRow} className="story-row-form">
                      <input name="id" type="hidden" value={story.id} />
                      <div className="field"><input aria-label="Story title override" defaultValue={story.title ?? ""} name="title" placeholder="Override title" type="text" /></div>
                      <div className="field"><input aria-label="Sort order" defaultValue={story.sort_order} min={0} name="sort_order" type="number" /></div>
                      <div className="story-row-actions">
                        <label className="checkbox-inline"><input defaultChecked={story.published} name="published" type="checkbox" /> Live</label>
                        <button className="admin-button" style={{ background: "#111", color: "#fff", padding: "8px 12px", borderRadius: 5, font: "inherit" }} type="submit">Save</button>
                      </div>
                    </form>
                    <form action={removeStory}>
                      <input name="id" type="hidden" value={story.id} />
                      <input name="gallery_id" type="hidden" value={story.gallery_id} />
                      <button aria-label="Remove from featured" className="icon-button icon-danger" type="submit"><Trash2 size={16} /></button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><h2>The Destiny Approach</h2></div>
          <form action={saveApproach} className="ws-form">
            <label className="checkbox-field"><input defaultChecked={home.approach.enabled} name="enabled" type="checkbox" /> Show this section on the homepage</label>
            <div className="field"><span>Label</span><input defaultValue={home.approach.label} name="label" type="text" /></div>
            <div className="field"><span>Statement <span className="optional">(use \n for a line break)</span></span><textarea defaultValue={home.approach.heading} name="heading" rows={3} /></div>
            <input name="principle_count" type="hidden" value={3} />
            <div style={{ display: "grid", gap: 14 }}>
              {home.approach.principles.map((principle, index) => (
                <div className="field-row" key={index}>
                  <div className="field"><span>Principle {index + 1} — label</span><input defaultValue={principle.label} name={`p_label_${index}`} type="text" /></div>
                  <div className="field"><span>Principle {index + 1} — description</span><textarea defaultValue={principle.description} name={`p_desc_${index}`} rows={2} /></div>
                </div>
              ))}
            </div>
            <div className="field">
              <span>Photograph <span className="optional">(JPEG, PNG, WebP up to 15MB)</span></span>
              <div className="asset-preview">
                {home.approach.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Current approach image" src={assetUrls[home.approach.image_path]} />) : <span className="hint">No custom image — a placeholder visual is used.</span>}
                <input accept="image/*" name="image" type="file" />
                <label className="checkbox-field"><input name="remove_image" type="checkbox" /> Remove current image</label>
              </div>
            </div>
            <div className="form-actions"><button className="admin-button" type="submit">Save section</button><SavedNote saved={saved} /></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><h2>Closing call to action</h2></div>
          <form action={saveCta} className="ws-form">
            <label className="checkbox-field"><input defaultChecked={home.cta.enabled} name="enabled" type="checkbox" /> Show this section on the homepage</label>
            <div className="field-row">
              <div className="field"><span>Kicker label</span><input defaultValue={home.cta.label} name="label" type="text" /></div>
              <div className="field"><span>Button label</span><input defaultValue={home.cta.button_text} name="button_text" type="text" /></div>
            </div>
            <div className="field"><span>Heading <span className="optional">(use \n for a line break)</span></span><textarea defaultValue={home.cta.heading} name="heading" rows={2} /></div>
            <div className="field"><span>Description</span><textarea defaultValue={home.cta.description} name="description" rows={2} /></div>
            <div className="field"><span>Button URL</span><input defaultValue={home.cta.button_url} name="button_url" type="text" /></div>
            <div className="form-actions"><button className="admin-button" type="submit">Save section</button><SavedNote saved={saved} /></div>
          </form>
        </section>
      </div>
    </div>
  );
}