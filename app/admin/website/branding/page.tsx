import { ImageIcon, Save } from "lucide-react";
import { WebsiteTabs } from "@/components/admin/website-tabs";
import { getSiteBranding } from "@/lib/site/site-content";
import { saveBranding } from "@/app/admin/website/actions";

const FIELDS = [
  { key: "logo", urlKey: "logoUrl", label: "Main logo", hint: "Shown in the header and footer by default." },
  { key: "light_logo", urlKey: "lightLogoUrl", label: "Light logo", hint: "For light surfaces, if your logo has a dark background." },
  { key: "dark_logo", urlKey: "darkLogoUrl", label: "Dark logo", hint: "For dark surfaces — used when a section inverts colours." },
  { key: "favicon", urlKey: "faviconUrl", label: "Favicon", hint: "Browser tab icon. Square image works best." },
  { key: "social_image", urlKey: "socialImageUrl", label: "Social share image", hint: "Used when the site is shared. 1200×630 recommended." },
] as const;

function assetName(path: string | null) {
  if (!path) return "No image set";
  return path.split("/").pop() ?? path;
}

export default async function WebsiteBrandingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const branding = await getSiteBranding();
  const current = { ...branding };
  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Branding</h1>
          <p className="muted">Wordmark, logos and how your studio appears across the site.</p>
        </div>
      </div>
      <WebsiteTabs />
      {saved ? <p className="saved-note" style={{ marginBottom: 14 }}>Saved.</p> : null}
      {error ? <p className="error-note" style={{ marginBottom: 14 }}>That image could not be saved — use JPEG, PNG, WebP or GIF under 15MB.</p> : null}
      <section className="admin-panel">
        <div className="panel-heading"><h2>Wordmark &amp; tagline</h2></div>
        <form action={saveBranding} className="ws-form">
          <div className="field-row">
            <div className="field"><span>Brand name</span><input defaultValue={branding.brand_name} name="brand_name" type="text" /></div>
            <div className="field"><span>Short name / monogram</span><input defaultValue={branding.short_name} name="short_name" placeholder="DESTINY" type="text" /></div>
          </div>
          <div className="field"><span>Tagline</span><input defaultValue={branding.tagline} name="tagline" type="text" /></div>
          {FIELDS.map(field => (
            <div className="field" key={field.key}>
              <span>{field.label} <span className="optional">({field.hint})</span></span>
              <div className="asset-preview">
                {field.key === "favicon" || field.key === "social_image"
                  ? <span className="hint">{assetName(current[`${field.key}_path`])} — {current[field.urlKey] ? "set" : "unset"}</span>
                  : current[field.urlKey] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={field.label} src={current[field.urlKey] ?? ""} style={{ background: field.key === "light_logo" ? "#F7F6F2" : "#0A0A0A", maxHeight: 90, objectFit: "contain" }} />
                    ) : <span className="hint">No {field.label.toLowerCase()} set — the site falls back to the wordmark.</span>}
                <input accept="image/*" name={field.key} type="file" />
                <label className="checkbox-field"><input name={`remove_${field.key}`} type="checkbox" /> Remove current image</label>
              </div>
            </div>
          ))}
          <div className="form-actions"><button className="admin-button" type="submit"><Save size={15} /> Save branding</button><span className="hint"><ImageIcon size={12} /> JPEG, PNG, WebP or GIF, up to 15MB.</span></div>
        </form>
      </section>
      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="panel-heading"><h2>How it renders</h2></div>
        <p className="placeholder">The header shows your brand name (or logo when set), the footer repeats it with the tagline, and the favicon appears in the browser tab. Leave images unset to keep the typographic treatment.</p>
      </section>
    </div>
  );
}