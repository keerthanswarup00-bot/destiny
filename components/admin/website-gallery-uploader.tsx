"use client";

import { ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeWebsiteGalleryUpload, prepareWebsiteGalleryUpload, uploadWebsiteGalleryImages } from "@/app/admin/website/actions";

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
      const directResult = await uploadFilesDirectly(files);
      const result = directResult.fallback
        ? await uploadWebsiteGalleryImages(uploadForm(directResult.remaining ?? Array.from(files)))
        : directResult;
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

  function uploadForm(remaining: File[]) {
    const form = new FormData();
    form.set("category", category);
    for (const file of remaining) form.append("files", file);
    return form;
  }

  async function uploadFilesDirectly(files: FileList | File[]): Promise<{ ok: boolean; message?: string; fallback?: boolean; remaining?: File[] }> {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length) return { ok: false, message: "Upload failed: no file selected." };
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      const preparation = new FormData();
      preparation.set("filename", file.name);
      preparation.set("mime_type", file.type);
      preparation.set("bytes", String(file.size));
      preparation.set("category", category);
      const prepared = await prepareWebsiteGalleryUpload(preparation);
      if (!prepared.ok) return prepared;
      let response: Response;
      try {
        response = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      } catch {
        // Browser → R2 upload is blocked when the bucket has no CORS rule for
        // this origin (the browser aborts with "Failed to fetch"). Fall back to
        // the existing server-upload action, which PUTs to the same R2 bucket
        // without needing CORS. Files committed before this one stay untouched.
        return { ok: false, message: "Direct upload to storage is blocked (bucket CORS). Falling back to server upload.", fallback: true, remaining: selectedFiles.slice(index) };
      }
      if (!response.ok) return { ok: false, message: "Direct upload to storage failed. Falling back to server upload.", fallback: true, remaining: selectedFiles.slice(index) };
      const completion = new FormData();
      completion.set("id", prepared.id);
      completion.set("key", prepared.key);
      completion.set("filename", file.name);
      completion.set("mime_type", file.type);
      completion.set("bytes", String(file.size));
      completion.set("category", category);
      const completed = await completeWebsiteGalleryUpload(completion);
      if (!completed.ok) return completed;
    }
    return { ok: true, fallback: false };
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