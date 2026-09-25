"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type UploadProgressState = "uploading" | "processing" | "done" | "failed";
export type UploadProgressEvent = {
  index: number;
  state: UploadProgressState;
  progress: number;
  message?: string;
};
export type StagedUploadQueueHandle = {
  addFiles: (files: FileList | File[]) => void;
  clear: () => void;
};

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
  state: "ready" | UploadProgressState;
  progress: number;
  error?: string;
};

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function isAcceptedImage(file: File) {
  return ACCEPTED_TYPES.has(file.type);
}

export const StagedUploadQueue = forwardRef<
  StagedUploadQueueHandle,
  {
    onCommit: (files: File[], onProgress: (event: UploadProgressEvent) => void) => Promise<{ ok: boolean }>;
    uploading: boolean;
    onBrowse: () => void;
    onError?: (message: string | null) => void;
  }
>(function StagedUploadQueue({ onCommit, uploading, onBrowse, onError }, ref) {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const filesRef = useRef<StagedFile[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const item of filesRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const count = files.length;
  const completed = files.filter(item => item.state === "done").length;
  const active = files.find(item => item.state === "uploading" || item.state === "processing");
  const totalSize = useMemo(() => files.reduce((total, item) => total + item.file.size, 0), [files]);
  const overallProgress = count
    ? Math.round(
        (files.reduce((total, item) => total + (item.state === "done" ? 100 : item.state === "ready" || item.state === "failed" ? 0 : item.progress), 0) / count)
      )
    : 0;

  useImperativeHandle(ref, () => ({
    addFiles(incoming) {
      const accepted: StagedFile[] = [];
      let rejected = 0;
      const existing = new Set(filesRef.current.map(item => `${item.file.name}\u0000${item.file.size}\u0000${item.file.lastModified}`));

      for (const file of Array.from(incoming)) {
        const key = `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
        if (!isAcceptedImage(file) || file.size === 0) {
          rejected += 1;
          continue;
        }
        if (existing.has(key)) continue;
        existing.add(key);
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          state: "ready",
          progress: 0,
        });
      }

      if (rejected) {
        onError?.(`${rejected} ${rejected === 1 ? "file was" : "files were"} skipped. Use JPEG, PNG, WebP or GIF images.`);
      } else {
        onError?.(null);
      }
      if (accepted.length) setFiles(prev => [...prev, ...accepted]);
    },
    clear() {
      setFiles(prev => {
        for (const item of prev) URL.revokeObjectURL(item.previewUrl);
        return [];
      });
      onError?.(null);
    },
  }));

  function remove(id: string) {
    setFiles(prev => {
      const item = prev.find(file => file.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(file => file.id !== id);
    });
  }

  function clearQueue() {
    setFiles(prev => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
    onError?.(null);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (!event.dataTransfer.files.length || uploading) return;
    const incoming = event.dataTransfer.files;
    const accepted: StagedFile[] = [];
    let rejected = 0;
    const existing = new Set(filesRef.current.map(item => `${item.file.name}\u0000${item.file.size}\u0000${item.file.lastModified}`));

    for (const file of Array.from(incoming)) {
      const key = `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
      if (!isAcceptedImage(file) || file.size === 0) {
        rejected += 1;
        continue;
      }
      if (existing.has(key)) continue;
      existing.add(key);
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        state: "ready",
        progress: 0,
      });
    }

    if (rejected) {
      onError?.(`${rejected} ${rejected === 1 ? "file was" : "files were"} skipped. Use JPEG, PNG, WebP or GIF images.`);
    } else {
      onError?.(null);
    }
    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
  }

  async function commit() {
    if (!files.length || uploading) return;
    const result = await onCommit(
      files.map(item => item.file),
      event => {
        setFiles(prev => prev.map((item, index) => {
          if (index !== event.index) return item;
          return {
            ...item,
            state: event.state,
            progress: Math.max(0, Math.min(100, event.progress)),
            error: event.message,
          };
        }));
      },
    );
    if (result.ok) clearQueue();
  }

  return (
    <div className={`upload-queue${dragOver ? " is-dragging" : ""}`}>
      <div
        className="upload-queue-dropzone"
        onDragEnter={event => {
          event.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragOver={event => {
          event.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={event => {
          if (event.currentTarget === event.target) setDragOver(false);
        }}
        onDrop={handleDrop}
      >
        <div className="upload-zone-icon"><ImagePlus size={24} strokeWidth={1.4} /></div>
        <strong>{dragOver ? "Drop photos here" : "Add photos to this set"}</strong>
        <span>Drag and drop photos here, or choose them from your computer.</span>
        <button className="admin-button" disabled={uploading} onClick={onBrowse} type="button">
          <Upload size={15} strokeWidth={1.8} /> Choose Photos
        </button>
        <em>JPEG, PNG, WebP or GIF · up to 15 MB each</em>
      </div>

      {count ? (
        <>
          <div className="upload-queue-head">
            <div>
              <strong>{count} {count === 1 ? "photo" : "photos"} in upload queue</strong>
              <span>{formatBytes(totalSize)} total{uploading ? ` · ${overallProgress}% uploaded` : ""}</span>
            </div>
            <button className="upload-close" disabled={uploading} onClick={clearQueue} type="button" aria-label="Clear upload queue">
              <X size={17} strokeWidth={1.8} />
            </button>
          </div>

          {uploading ? (
            <div className="upload-progress-overall" aria-label={`Overall upload progress ${overallProgress}%`} role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={overallProgress}>
              <span style={{ width: `${overallProgress}%` }} />
            </div>
          ) : null}

          <div className="upload-queue-grid">
            {files.map(item => (
              <div className={`upload-queue-card is-${item.state}`} key={item.id}>
                {/* Local object URL preview, never uploaded or persisted by this component. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={item.previewUrl} />
                <div className="upload-queue-card-meta">
                  <span title={item.file.name}>{item.file.name}</span>
                  <small>
                    {item.state === "ready" ? formatBytes(item.file.size) :
                      item.state === "uploading" ? `Uploading ${item.progress}%` :
                      item.state === "processing" ? "Processing photo…" :
                      item.state === "done" ? "Uploaded" :
                      item.error || "Upload failed"}
                  </small>
                </div>
                {item.state === "uploading" || item.state === "processing" ? (
                  <div className="upload-queue-card-progress" role="progressbar" aria-label={`${item.file.name} upload progress`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={item.progress}>
                    <span style={{ width: `${item.progress}%` }} />
                  </div>
                ) : null}
                {item.state === "done" ? <span className="upload-queue-card-status" aria-label="Uploaded">✓</span> : null}
                {item.state === "failed" ? (
                  <span className="upload-queue-card-status is-failed" aria-label="Upload failed">!</span>
                ) : null}
                <button
                  aria-label={`Remove ${item.file.name}`}
                  className="upload-queue-remove"
                  disabled={uploading}
                  onClick={() => remove(item.id)}
                  type="button"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>

          <div className="upload-queue-actions">
            <button className="admin-button" disabled={!count || uploading || completed === count} onClick={commit} type="button">
              <Upload size={15} strokeWidth={1.8} /> {completed ? "Retry remaining" : `Upload ${count} ${count === 1 ? "photo" : "photos"}`}
            </button>
            <span className="upload-queue-hint">
              {active ? active.state === "processing" ? "Processing your photo for gallery delivery…" : `Uploading ${active.file.name}` : completed === count ? "All photos uploaded." : "You can add more photos before uploading."}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
});
