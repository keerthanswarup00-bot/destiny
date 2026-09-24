"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type StagedUploadQueueHandle = {
  addFiles: (files: FileList | File[]) => void;
  clear: () => void;
};

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
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
    onCommit: (files: File[]) => Promise<void>;
    uploading: boolean;
    onBrowse: () => void;
    onError?: (message: string | null) => void;
  }
>(function StagedUploadQueue({ onCommit, uploading, onBrowse, onError }, ref) {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const count = files.length;

  useEffect(() => {
    return () => {
      for (const item of files) URL.revokeObjectURL(item.previewUrl);
    };
  }, [files]);

  const totalSize = useMemo(
    () => files.reduce((total, item) => total + item.file.size, 0),
    [files]
  );

  useImperativeHandle(ref, () => ({
    addFiles(incoming) {
      const accepted: StagedFile[] = [];
      let rejected = 0;

      for (const file of Array.from(incoming)) {
        if (!isAcceptedImage(file) || file.size === 0) {
          rejected += 1;
          continue;
        }

        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (rejected) {
        onError?.(
          `${rejected} ${rejected === 1 ? "file was" : "files were"} skipped. Use JPEG, PNG, WebP or GIF images.`
        );
      } else {
        onError?.(null);
      }

      if (!accepted.length) return;
      setFiles(prev => [...prev, ...accepted]);
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

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (!event.dataTransfer.files.length || uploading) return;
    const incoming = event.dataTransfer.files;
    const accepted: StagedFile[] = [];
    let rejected = 0;

    for (const file of Array.from(incoming)) {
      if (!isAcceptedImage(file) || file.size === 0) {
        rejected += 1;
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (rejected) {
      onError?.(
        `${rejected} ${rejected === 1 ? "file was" : "files were"} skipped. Use JPEG, PNG, WebP or GIF images.`
      );
    } else {
      onError?.(null);
    }

    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
  }

  async function commit() {
    if (!files.length || uploading) return;
    await onCommit(files.map(item => item.file));
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
        <div className="upload-zone-icon">
          <ImagePlus size={24} strokeWidth={1.4} />
        </div>
        <strong>{dragOver ? "Drop photos here" : "Add photos to this set"}</strong>
        <span>Drag and drop photos here, or choose them from your computer.</span>
        <button className="admin-button" disabled={uploading} onClick={onBrowse} type="button">
          <Upload size={15} strokeWidth={1.8} /> Choose Photos
        </button>
        <em>JPEG, PNG, WebP or GIF</em>
      </div>

      {count ? (
        <>
          <div className="upload-queue-head">
            <div>
              <strong>{count} {count === 1 ? "photo" : "photos"} ready to upload</strong>
              <span>{formatBytes(totalSize)} total</span>
            </div>
            <button className="upload-close" disabled={uploading} onClick={() => {
              setFiles(prev => {
                for (const item of prev) URL.revokeObjectURL(item.previewUrl);
                return [];
              });
              onError?.(null);
            }} type="button" aria-label="Clear upload queue">
              <X size={17} strokeWidth={1.8} />
            </button>
          </div>

          <div className="upload-queue-grid">
            {files.map(item => (
              <div className="upload-queue-card" key={item.id}>
                {/* Local object URL preview, never uploaded or persisted by this component. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={item.previewUrl} />
                <div className="upload-queue-card-meta">
                  <span title={item.file.name}>{item.file.name}</span>
                  <small>{formatBytes(item.file.size)}</small>
                </div>
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
            <button className="admin-button" disabled={!count || uploading} onClick={commit} type="button">
              <Upload size={15} strokeWidth={1.8} /> Upload {count} {count === 1 ? "photo" : "photos"}
            </button>
            <span className="upload-queue-hint">You can add more photos before uploading.</span>
          </div>
        </>
      ) : null}
    </div>
  );
});
