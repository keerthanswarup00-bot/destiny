"use client";

import { ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadWebsiteGalleryImages } from "@/app/admin/website/actions";

export function WebsiteGalleryUploader() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(files.length);
    setDragOver(false);
    setError(null);
    try {
      const form = new FormData();
      for (const file of Array.from(files)) form.append("files", file);
      form.set("category", category);
      const result = await uploadWebsiteGalleryImages(form);
      if (!result.ok) {
        setError(result.message ?? "Upload failed.");
        return;
      }
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error && uploadError.message ? uploadError.message : "Upload failed. Please try again.");
    } finally {
      setUploading(0);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      {uploading ? (
        <div className="upload-progress" role="status">
          <span className="upload-spinner" />
          Uploading {uploading} {uploading === 1 ? "image" : "images"}…
        </div>
      ) : (
        <div
          className={`upload-zone${dragOver ? " is-dragging" : ""}`}
          onDragLeave={() => setDragOver(false)}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}
        >
          <div className="upload-zone-icon"><ImageIcon size={26} strokeWidth={1.5} /></div>
          <strong>Drag &amp; drop images here</strong>
          <span>or</span>
          <button className="admin-button" onClick={() => fileInput.current?.click()} type="button">
            <Upload size={15} strokeWidth={1.8} /> Upload images
          </button>
          <label className="website-gallery-category">
            <span>Category for these images</span>
            <select onChange={e => setCategory(e.target.value)} value={category}>
              <option value="">Uncategorized</option>
              <option value="wedding">Wedding</option>
              <option value="events">Events</option>
              <option value="portraits">Portraits</option>
              <option value="celebrations">Celebrations</option>
            </select>
          </label>
          <em>JPEG, PNG, WebP or GIF. Multiple files. Publish when you are ready for /gallery.</em>
        </div>
      )}
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-hidden="true"
        className="visually-hidden-input"
        multiple
        onChange={e => void upload(e.target.files)}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </>
  );
}