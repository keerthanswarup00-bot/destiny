import { WebsiteTabs } from "@/components/admin/website-tabs";
import { getSiteThemeSetting } from "@/lib/site/site-content";
import { AppearanceEditor } from "@/components/admin/appearance-editor";

export default async function WebsiteAppearancePage() {
  const theme = await getSiteThemeSetting();
  const initial = { preset: theme.preset, accent: theme.accent };
  return (
    <div className="admin-content">
      <div className="website-editor-title">
        <div>
          <h1>Website · Appearance</h1>
          <p className="muted">Colour and contrast presets, applied across every public page.</p>
        </div>
      </div>
      <WebsiteTabs />
      <AppearanceEditor initial={initial} />
    </div>
  );
}