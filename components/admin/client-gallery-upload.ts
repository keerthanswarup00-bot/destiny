"use client";

import {
  completeClientGalleryUpload,
  prepareClientGalleryUpload,
  uploadPhotosAsync,
} from "@/app/admin/crud-actions";

type UploadContext = { galleryId: string; folderId: string };
export type GalleryUploadProgress = {
  index: number;
  state: "uploading" | "processing" | "done" | "failed";
  progress?: number;
  message?: string;
};
type UploadResult = { ok: true; count: number } | { ok: false; message: string; failedIndex?: number };

function uploadForm(context: UploadContext, file: File) {
  const form = new FormData();
  form.set("gallery_id", context.galleryId);
  form.set("folder_id", context.folderId);
  form.append("files", file);
  return form;
}

function preparationForm(context: UploadContext, file: File) {
  const form = new FormData();
  form.set("gallery_id", context.galleryId);
  form.set("folder_id", context.folderId);
  form.set("filename", file.name);
  form.set("mime_type", file.type);
  form.set("bytes", String(file.size));
  return form;
}

function directPut(url: string, file: File, onProgress: (progress: number) => void): Promise<boolean> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    try { xhr.send(file); } catch { resolve(false); }
  });
}

async function serverFallback(
  file: File,
  context: UploadContext,
  index: number,
  onProgress: (event: GalleryUploadProgress) => void,
): Promise<boolean> {
  onProgress({ index, state: "processing" });
  const fallback = await uploadPhotosAsync(uploadForm(context, file));
  return fallback.ok;
}

function uploadFailureMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Upload failed. Please try again.";
}

export async function uploadClientGalleryFiles(
  files: FileList | File[],
  context: UploadContext,
  onProgress?: (event: GalleryUploadProgress) => void,
): Promise<UploadResult> {
  const selectedFiles = Array.from(files);
  if (!selectedFiles.length) return { ok: false, message: "Upload failed: no file selected." };

  let uploaded = 0;

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];

    try {
      onProgress?.({ index, state: "uploading", progress: 0 });

      const prepared = await prepareClientGalleryUpload(preparationForm(context, file));
      if (!prepared.ok) {
        if (prepared.fallback) {
          const fallbackOk = await serverFallback(file, context, index, event => onProgress?.(event));
          if (!fallbackOk) {
            const message = "Upload failed. Please try again.";
            onProgress?.({ index, state: "failed", message });
            return { ok: false, message, failedIndex: index };
          }
          uploaded += 1;
          onProgress?.({ index, state: "done", progress: 100 });
          continue;
        }
        const message = prepared.message;
        onProgress?.({ index, state: "failed", message });
        return { ok: false, message, failedIndex: index };
      }

      const directSucceeded = await directPut(prepared.uploadUrl, file, progress => {
        onProgress?.({ index, state: "uploading", progress });
      });

      if (!directSucceeded) {
        const fallbackOk = await serverFallback(file, context, index, event => onProgress?.(event));
        if (!fallbackOk) {
          const message = "Upload failed. Direct storage upload and the server fallback both failed.";
          onProgress?.({ index, state: "failed", message });
          return { ok: false, message, failedIndex: index };
        }
        uploaded += 1;
        onProgress?.({ index, state: "done", progress: 100 });
        continue;
      }

      onProgress?.({ index, state: "processing" });

      const completion = new FormData();
      completion.set("gallery_id", context.galleryId);
      completion.set("folder_id", context.folderId);
      completion.set("id", prepared.id);
      completion.set("key", prepared.key);
      completion.set("filename", file.name);
      completion.set("mime_type", file.type);
      completion.set("bytes", String(file.size));

      const completed = await completeClientGalleryUpload(completion);
      if (!completed.ok) {
        const message = completed.message ?? "Upload failed while processing the image.";
        onProgress?.({ index, state: "failed", message });
        return { ok: false, message, failedIndex: index };
      }

      uploaded += 1;
      onProgress?.({ index, state: "done", progress: 100 });
    } catch (error) {
      const message = uploadFailureMessage(error);
      onProgress?.({ index, state: "failed", message });
      return { ok: false, message, failedIndex: index };
    }
  }

  return { ok: true, count: uploaded };
}
