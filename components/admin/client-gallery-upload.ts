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

export async function uploadClientGalleryFiles(files: FileList | File[], context: UploadContext): Promise<UploadResult> {
  const selectedFiles = Array.from(files);
  if (!selectedFiles.length) return { ok: false, message: "Upload failed: no file selected." };

  const fallbackForm = new FormData();
  fallbackForm.set("gallery_id", context.galleryId);
  fallbackForm.set("folder_id", context.folderId);
  for (const file of selectedFiles) fallbackForm.append("files", file);

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
      const fallback = await uploadPhotosAsync(fallbackForm);
      return fallback.ok
        ? { ok: true, count: fallback.count }
        : { ok: false, message: "Upload failed. Please try again." };
    }
    return { ok: false, message: prepared.message };
  }

  let uploaded = 0;
  for (const [index, file] of selectedFiles.entries()) {
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
    const response = await fetch(current.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) return { ok: false, message: `Upload failed: R2 rejected ${file.name}.` };

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