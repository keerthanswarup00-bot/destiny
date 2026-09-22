"use client";

import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { renderWatermarkPreview, saveWatermarkSettings } from "@/app/admin/settings/actions";
import type { WatermarkPosition } from "@/lib/watermark-core";

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "center", label: "Center" },
];

export function WatermarkSettingsPanel({
  watermark,
}: {
  watermark: { active: boolean; enabled: boolean; opacity: number; scale: number; margin: number; position: WatermarkPosition };
}) {
  const [enabled, setEnabled] = useState(watermark.enabled);
  const [opacity, setOpacity] = useState(watermark.opacity);
  const [scale, setScale] = useState(watermark.scale);
  const [margin, setMargin] = useState(watermark.margin);
  const [position, setPosition] = useState<WatermarkPosition>(watermark.position);
  const [preview, setPreview] = useState<{ url: string | null; error: string | null } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const form = new FormData();
      form.set("enabled", enabled ? "on" : "off");
      form.set("opacity", String(opacity));
      form.set("scale", String(scale));
      form.set("margin", String(margin));
      form.set("position", position);
      setPreviewBusy(true);
      const result = await renderWatermarkPreview(form);
      setPreview(result);
      setPreviewBusy(false);
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, opacity, scale, margin, position]);

  return (
    <section className="admin-panel watermark-panel">
      <div className="panel-heading">
        <h2>Appearance</h2>
        <span className="wm-hint">Preview updates as you adjust the settings — exactly how the logo is burned into photos.</span>
      </div>
      <div className="watermark-body">
        {!watermark.active ? (
          <p className="wm-desc">There is no active logo right now — upload one in the Watermark panel above, or turn the watermark back on, to see it on photos.</p>
        ) : null}
        <form action={saveWatermarkSettings} className="wmov-form">
          <div className="wmov-preview">
            {preview?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Watermark placement preview" src={preview.url} />
            ) : preview?.error ? (
              <span className="hint">{preview.error}</span>
            ) : (
              <span className="hint">Rendering preview…</span>
            )}
            {previewBusy ? <span className="wmov-busy">Rendering…</span> : null}
          </div>

          <label className="wmov-toggle">
            <input checked={enabled} name="enabled" onChange={event => setEnabled(event.target.checked)} type="checkbox" />
            <span>Apply the watermark to new uploads</span>
          </label>

          <div className="wmov-fields">
            <label className="wmov-field">
              <span>Opacity — {Math.round(opacity * 100)}%</span>
              <input max="1" min="0.05" name="opacity" onChange={event => setOpacity(Number(event.target.value))} step="0.05" type="range" value={opacity} />
            </label>
            <label className="wmov-field">
              <span>Logo size vs photo width — {Math.round(scale * 100)}%</span>
              <input max="0.5" min="0.03" name="scale" onChange={event => setScale(Number(event.target.value))} step="0.01" type="range" value={scale} />
            </label>
            <label className="wmov-field">
              <span>Margin vs photo edge — {Math.round(margin * 100)}%</span>
              <input max="0.25" min="0" name="margin" onChange={event => setMargin(Number(event.target.value))} step="0.01" type="range" value={margin} />
            </label>
          </div>

          <div className="wmov-positions">
            <span className="wmov-label">Position</span>
            <div className="wmov-positions-grid">
              {POSITIONS.map(option => (
                <label className={`wmov-chip${position === option.value ? " is-selected" : ""}`} key={option.value}>
                  <input checked={position === option.value} name="position" onChange={() => setPosition(option.value)} type="radio" value={option.value} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="wmov-save">
            <p className="wm-hint">These settings only affect future uploads — existing photos keep their current look until you select them in a gallery and use Apply Watermark.</p>
            <button className="admin-button" type="submit"><Save size={14} /> Save settings</button>
          </div>
        </form>
      </div>
    </section>
  );
}