"use client";

import {
  completeClientGalleryUpload,
  prepareClientGalleryUpload,
  uploadPhotosAsync,
} from "@/app/admin/crud-actions";

type UploadContext = {
  galleryId: string;
  folderId: string;
};

type UploadResult = { ok: true; count: number } | { ok: false; message: string };

function uploadForm(context: UploadContext, files: File[]) {
  const form = new FormData();
  form.set("gallery_id", context.galleryId);
  form.set("folder_id", context.folderId);
  for (const file of files) form.append("files", file);
  return form;
}

export async function uploadClientGalleryFiles(files: FileList | File[], context: UploadContext): Promise<UploadResult> {
  const selectedFiles = Array.from(files);
  if (!selectedFiles.length) return { ok: false, message: "Upload failed: no file selected." };

  const first = selectedFiles[0];
  const preparationForm = new FormData();
  preparationForm.set("gallery_id", context.galleryId);
  preparationForm.set("folder_id", context.folderId);
  preparationForm.set("filename", first.name);
  preparationForm.set("mime_type", first.type);
  preparationForm.set("bytes", String(first.size));
  const prepared = await prepareClientGalleryUpload(preparationForm);
  if (!prepared.ok) {
    if (prepared.fallback) {
      const fallback = await uploadPhotosAsync(uploadForm(context, selectedFiles));
      return fallback.ok
        ? { ok: true, count: fallback.count }
        : { ok: false, message: "Upload failed. Please try again." };
    }
    return { ok: false, message: prepared.message };
  }

  // Direct browser → R2 uploads can be blocked when the bucket has no CORS rule
  // for this origin. R2 then answers the preflight with 403 and the browser
  // aborts, so `fetch` throws the generic "Failed to fetch". The upload still
  // goes to the SAME R2 bucket through the app's existing server-upload action
  // (the fallback used for non-R2 providers), which performs a server-side PUT
  // that needs no CORS. Files already committed before the failure are never
  // re-uploaded.
  const fallbackFrom = async (index: number): Promise<UploadResult> => {
    const fallback = await uploadPhotosAsync(uploadForm(context, selectedFiles.slice(index)));
    return fallback.ok
      ? { ok: true, count: fallback.count }
      : { ok: false, message: "Upload failed. Direct upload to storage is blocked and the server fallback could not complete." };
  };
  const combined = (result: UploadResult): UploadResult =>
    result.ok ? { ok: true, count: uploaded + (result.count ?? 0) } : result;

  let uploaded = 0;
  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];
    let current = prepared;
    if (index > 0) {
      const nextPreparation = new FormData();
      nextPreparation.set("gallery_id", context.galleryId);
      nextPreparation.set("folder_id", context.folderId);
      nextPreparation.set("filename", file.name);
      nextPreparation.set("mime_type", file.type);
      nextPreparation.set("bytes", String(file.size));
      const next = await prepareClientGalleryUpload(nextPreparation);
      if (!next.ok) return { ok: false, message: next.message };
      current = next;
    }
    let response: Response;
    try {
      response = await fetch(current.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
    } catch {
      // Browser-level failure (preflight rejected for missing CORS) or network
      // error. Nothing was stored, so the failed file joins the fallback.
      return combined(await fallbackFrom(index));
    }
    if (!response.ok) {
      // R2 rejected the presigned PUT (nothing stored) — retry via the server path.
      return combined(await fallbackFrom(index));
    }

    const completion = new FormData();
    completion.set("gallery_id", context.galleryId);
    completion.set("folder_id", context.folderId);
    completion.set("id", current.id);
    completion.set("key", current.key);
    completion.set("filename", file.name);
    completion.set("mime_type", file.type);
    completion.set("bytes", String(file.size));
    const completed = await completeClientGalleryUpload(completion);
    if (!completed.ok) return { ok: false, message: completed.message ?? "Upload failed." };
    uploaded += 1;
  }
  return { ok: true, count: uploaded };
}