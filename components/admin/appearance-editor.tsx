"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { saveTheme } from "@/app/admin/website/actions";

const PRESETS: Record<string, { label: string; tokens: Record<string, string> }> = {
  "destiny-yellow": { label: "Destiny Yellow", tokens: { bg: "#FFFFFF", fg: "#101010", accent: "#F4C400", accentFg: "#101010", muted: "#6E6E6E", line: "#E7E5E0" } },
  mono: { label: "Mono", tokens: { bg: "#FFFFFF", fg: "#000000", accent: "#000000", accentFg: "#FFFFFF", muted: "#5C5C5C", line: "#E5E5E5" } },
  "warm-ivory": { label: "Warm Ivory", tokens: { bg: "#F7F6F2", fg: "#111111", accent: "#C9A227", accentFg: "#111111", muted: "#6E6E63", line: "#E6E2D8" } },
  "soft-stone": { label: "Soft Stone", tokens: { bg: "#F1F0EC", fg: "#171717", accent: "#D4AF37", accentFg: "#171717", muted: "#6C6A63", line: "#DDD9D0" } },
  black: { label: "Black", tokens: { bg: "#0A0A0A", fg: "#F2F2F2", accent: "#F4C400", accentFg: "#101010", muted: "#9A9A9A", line: "#262626" } },
};

const KEYS = ["destiny-yellow", "mono", "warm-ivory", "soft-stone", "black"] as const;

function readableOnColor(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.45 ? "#101010" : "#FFFFFF";
}

function useThemeState(initial: { preset: string; accent: string | null }) {
  const [preset, setPreset] = useState(KEYS.includes(initial.preset as (typeof KEYS)[number]) ? initial.preset : "destiny-yellow");
  const [accent, setAccent] = useState(initial.accent ?? "");
  const base = PRESETS[preset].tokens;
  const accentValid = /^#[0-9A-Fa-f]{6}$/.test(accent);
  const tokens = {
    bg: base.bg,
    fg: base.fg,
    muted: base.muted,
    line: base.line,
    accent: accentValid ? accent.toUpperCase() : base.accent,
    accentFg: accentValid ? readableOnColor(accent) : base.accentFg,
  };
  return { preset, setPreset, accent, setAccent, tokens, accentValid };
}

export function AppearanceEditor({ initial }: { initial: { preset: string; accent: string | null } }) {
  const { preset, setPreset, accent, setAccent, tokens, accentValid } = useThemeState(initial);
  const css = { "--sp-bg": tokens.bg, "--sp-fg": tokens.fg, "--sp-muted": tokens.muted, "--sp-line": tokens.line, "--sp-accent": tokens.accent, "--sp-acc-fg": tokens.accentFg, "--sp-accent-soft": `${tokens.accent}14`, background: tokens.bg } as React.CSSProperties;
  return (
    <div className="website-editor-sections">
      <form action={saveTheme} className="ws-form admin-panel" style={{ gap: 22 }}>
        <input name="preset" type="hidden" value={preset} />
        <input name="accent" type="hidden" value={accentValid ? accent.toUpperCase() : ""} />
        <div>
          <div className="theme-grid" role="radiogroup" aria-label="Theme preset">
            {KEYS.map((key) => {
              const selected = preset === key;
              return (
                <button aria-checked={selected} className={`theme-option${selected ? " is-active" : ""}`} key={key} onClick={() => setPreset(key)} role="radio" type="button">
                  <span className="theme-swatches">{PRESETS[key].tokens.bg !== "#FFFFFF" && key !== "black" ? null : <span style={{ background: PRESETS[key].tokens.bg }} />}<span style={{ background: PRESETS[key].tokens.fg }} /><span style={{ background: PRESETS[key].tokens.accent }} /><span style={{ background: PRESETS[key].tokens.line }} /><span style={{ background: PRESETS[key].tokens.muted }} /><span style={{ background: PRESETS[key].tokens.accentFg }} /></span>
                  <label>{PRESETS[key].label}</label>
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <span>Custom accent <span className="optional">(optional — overrides the preset colour)</span></span>
          <input aria-label="Custom accent colour" onChange={(event) => setAccent(event.target.value)} placeholder="#E8B923" type="color" value={accentValid ? accent : "#F4C400"} />
          <span className="hint">Choose any colour above or type a hex code. When set, it replaces the preset accent across the site.</span>
        </div>
        <div className="form-actions">
          <button className="admin-button" type="submit"><Palette size={15} /> Save appearance</button>
        </div>
      </form>
      <section className="admin-panel site-preview">
        <div className="site-preview-bar"><span>Live preview</span></div>
        <div className="site-preview-pad">
          <div className="site-preview-window" style={css}>
            <div className="sp-header">
              <strong>DESTINY</strong>
              <span className="sp-nav"><span>Gallery</span><span>Contact</span><span>About</span></span>
            </div>
            <div className="sp-hero">
              <small>EVENTS + PHOTOGRAPHY</small>
              <h3>Stories. Moments.<br />Captured with intention.</h3>
              <p>Timeless imagery for weddings, events, and celebrations — crafted with quiet attention.</p>
              <span className="sp-btn">View gallery</span>
            </div>
            <div className="sp-section">
              <small>SELECTED STORIES</small>
              <h4>Recent celebrations</h4>
              <div className="sp-tiles">
                <div className="sp-tile"><strong>Aryan &amp; Priya</strong><span>Wedding · Udaipur</span><em>View story</em></div>
                <div className="sp-tile"><strong>Corporate Gala</strong><span>Event · Mumbai</span><em>View story</em></div>
              </div>
            </div>
          </div>
        </div>
        <div className="theme-token-table" style={{ padding: "0 22px 22px" }}>
          {Object.entries(tokens).map(([key, value]) => (
            <div className="theme-token-tile" key={key}>
              <span>{key}</span>
              <strong><i className="theme-token-dot" style={{ background: value }} /> {value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}