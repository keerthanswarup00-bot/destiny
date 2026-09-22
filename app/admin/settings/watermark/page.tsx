import Link from "next/link";
import { getWatermarkSettings } from "@/app/admin/settings/actions";
import { WatermarkManager } from "@/app/admin/settings/watermark/watermark-manager";
import { WatermarkSettingsPanel } from "@/app/admin/settings/watermark/watermark-settings-panel";

export default async function WatermarkSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const settings = await getWatermarkSettings();
  return (
    <section className="admin-content">
      <div className="admin-title">
        <div>
          <Link className="admin-back" href="/admin/settings">← Settings</Link>
          <p className="eyebrow">CLIENT GALLERY</p>
          <h1>Watermark</h1>
          <p className="muted">Your logo is added to client-facing gallery photos and downloads.</p>
        </div>
      </div>
      {saved ? <p className="saved-note">Saved.</p> : null}
      {error ? <p className="error-note">{error === "settings" ? "Those settings could not be saved." : "That image could not be saved — use PNG, SVG, or JPEG up to 5MB."}</p> : null}
      <WatermarkManager active={settings.active} previewUrl={settings.previewUrl} />
      <WatermarkSettingsPanel watermark={settings} />
      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="panel-heading"><h2>How it works</h2></div>
        <p className="placeholder">The watermark is burned into the thumbnail, preview, and download copies generated for every Client Gallery upload. It never touches your private original, which stays available to you alone. Changing the watermark only affects future uploads; to stamp existing photos with the current logo, select them in a gallery and use Apply Watermark — they are reprocessed from their stored original, so nothing you upload is lost.</p>
      </section>
    </section>
  );
}