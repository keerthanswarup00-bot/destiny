"use client";

import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { saveWatermark, removeWatermark } from "@/app/admin/settings/actions";

const ALLOWED_TYPES = ["image/png", "image/svg+xml", "image/jpeg"];
const MAX_BYTES = 5 * 1024 * 1024;

type Pending = { file: File; url: string };

export function WatermarkManager({ active, previewUrl }: { active: boolean; previewUrl: string | null }) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const saveDialogRef = useRef<HTMLDialogElement>(null);
  const removeDialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openPicker() {
    setError(null);
    logoInputRef.current?.click();
  }

  function clearPicker() {
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      setError("Only PNG, SVG, or JPEG files are supported.");
      clearPicker();
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That logo is larger than 5MB — try a smaller file.");
      clearPicker();
      return;
    }
    setPending({ file, url: URL.createObjectURL(file) });
    setError(null);
    saveDialogRef.current?.showModal();
  }

  function handleCancelSave() {
    if (pending) URL.revokeObjectURL(pending.url);
    clearPicker();
    setPending(null);
    saveDialogRef.current?.close();
  }

  return (
    <section className="admin-panel watermark-panel">
      <div className="panel-heading">
        <h2>Watermark</h2>
        <span className={`wm-status${active ? " is-on" : ""}`} aria-label={active ? "Watermark active" : "Watermark off"}>● {active ? "Active" : "Off"}</span>
      </div>
      <div className="watermark-body">
        <p className="wm-desc">
          {active
            ? "Your logo is automatically added to client-facing gallery photos and downloads. Existing photos are never reprocessed — only future uploads are affected."
            : "No watermark uploaded. Upload your photographer/business logo to protect client gallery images."}
        </p>

        <div className="wm-preview">
          {active && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Active watermark logo" src={previewUrl} style={{ background: "#fff", maxHeight: 140, objectFit: "contain" }} />
          ) : (
            <span className="hint">No watermark uploaded</span>
          )}
        </div>

        {error ? <p className="error-note">{error}</p> : null}

        <div className="wm-actions">
          {active ? (
            <>
              <button className="admin-button" type="button" onClick={openPicker}><RefreshCw size={14} /> Change logo</button>
              <button className="admin-button is-danger" type="button" onClick={() => removeDialogRef.current?.showModal()}><Trash2 size={14} /> Remove watermark</button>
            </>
          ) : (
            <button className="admin-button" type="button" onClick={openPicker}><Upload size={14} /> Upload logo</button>
          )}
        </div>

        <p className="wm-hint">Recommended: PNG with a transparent background. PNG, SVG, or JPEG up to 5MB. The logo is placed in the bottom-right corner of each photo.</p>
      </div>

      <dialog className="admin-dialog watermark-dialog" ref={saveDialogRef} onCancel={handleCancelSave}>
        <form action={saveWatermark}>
          <input ref={logoInputRef} accept="image/png,image/svg+xml,image/jpeg,.png,.svg,.jpg,.jpeg" name="logo" onChange={handleFileSelect} type="file" hidden />
          <h2>{active ? "New logo preview" : "Preview your logo"}</h2>
          <p className="wm-dialog-note">Your current watermark is only replaced when you save. Existing photos will not be changed.</p>
          <div className="wm-sample">
            <span className="wm-sample-label">Sample photo</span>
            {pending ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Watermark preview" className="wm-sample-logo" src={pending.url} />
            ) : null}
            <span className="wm-sample-note">Watermarks appear in the bottom-right corner of client photos and downloads.</span>
          </div>
          {pending ? (
            <div className="wm-dialog-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="New watermark logo" src={pending.url} />
            </div>
          ) : null}
          <menu>
            <li><button className="subtle-button" onClick={handleCancelSave} type="button">Cancel</button></li>
            <li><button className="admin-button" type="submit"><ImagePlus size={14} /> Save logo</button></li>
          </menu>
        </form>
      </dialog>

      <dialog className="admin-dialog watermark-dialog" ref={removeDialogRef} onCancel={() => removeDialogRef.current?.close()}>
        <div className="watermark-dialog-plain">
          <h2>Remove watermark?</h2>
          <p>New Client Gallery uploads will no longer receive a watermark. Existing watermarked photos will not be changed.</p>
          <menu>
            <li><button className="subtle-button" onClick={() => removeDialogRef.current?.close()} type="button">Cancel</button></li>
            <li>
              <form action={removeWatermark}>
                <button className="admin-button is-danger" type="submit"><Trash2 size={14} /> Remove watermark</button>
              </form>
            </li>
          </menu>
        </div>
      </dialog>
    </section>
  );
}