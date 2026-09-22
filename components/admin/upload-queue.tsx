"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Upload, X } from "lucide-react";

export type StagedUploadQueueHandle = {
  addFiles: (files: FileList | File[]) => void;
  clear: () => void;
};

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

/**
 * A staged file-selection queue for Client Gallery uploads. Files added here are
 * NOT uploaded until the admin confirms. Supports Select All / Deselect All and
 * preserves the single drop target so more files can be staged onto the queue.
 */
export const StagedUploadQueue = forwardRef<
  StagedUploadQueueHandle,
  {
    onCommit: (files: File[]) => Promise<void>;
    uploading: boolean;
    onCountChange?: (count: number) => void;
  }
>(function StagedUploadQueue({ onCommit, uploading, onCountChange }, ref) {
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    onCountChange?.(files.length);
  }, [files.length, onCountChange]);

  useImperativeHandle(ref, () => ({
    addFiles(incoming) {
      const next = Array.from(incoming).filter(file => file.size > 0);
      if (!next.length) return;
      setFiles(prev => {
        const merged = [...prev, ...next];
        setSelected(new Set(merged.map((_, index) => index)));
        return merged;
      });
    },
    clear() {
      setFiles([]);
      setSelected(new Set());
    },
  }));

  const allSelected = files.length > 0 && selected.size === files.length;

  async function commit() {
    const chosen = files.filter((_, index) => selected.has(index));
    if (!chosen.length || uploading) return;
    await onCommit(chosen);
  }

  function clearQueue() {
    setFiles([]);
    setSelected(new Set());
  }

  if (!files.length) return null;

  return (
    <div
      className={`upload-queue${dragOver ? " is-dragging" : ""}`}
      onDragLeave={() => setDragOver(false)}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const incoming = Array.from(e.dataTransfer.files).filter(file => file.size > 0);
        if (!incoming.length) return;
        setFiles(prev => {
          const merged = [...prev, ...incoming];
          setSelected(new Set(merged.map((_, index) => index)));
          return merged;
        });
      }}
    >
      <div className="upload-queue-head">
        <strong>{selected.size} of {files.length} files selected</strong>
        <div className="upload-queue-toggle">
          <button className="admin-button is-secondary" disabled={allSelected || uploading} onClick={() => setSelected(new Set(files.map((_, index) => index)))} type="button">
            Select All
          </button>
          <button className="admin-button is-secondary" disabled={!selected.size || uploading} onClick={() => setSelected(new Set())} type="button">
            Deselect All
          </button>
        </div>
      </div>
      <ul className="upload-queue-list">
        {files.map((file, index) => (
          <li className={`upload-queue-row${selected.has(index) ? " is-selected" : ""}`} key={`${index}-${file.name}`}>
            <input
              checked={selected.has(index)}
              disabled={uploading}
              onChange={() =>
                setSelected(prev => {
                  const next = new Set(prev);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                })
              }
              type="checkbox"
            />
            <span className="upload-queue-name" title={file.name}>{file.name}</span>
            <span className="upload-queue-size">{formatBytes(file.size)}</span>
          </li>
        ))}
      </ul>
      <div className="upload-queue-actions">
        <button className="admin-button" disabled={!selected.size || uploading} onClick={commit} type="button">
          <Upload size={15} strokeWidth={1.8} /> Upload {selected.size} selected
        </button>
        <button className="admin-button is-secondary is-danger" disabled={uploading} onClick={clearQueue} type="button">
          <X size={15} strokeWidth={1.8} /> Clear
        </button>
        <span className="upload-queue-hint">{dragOver ? "Drop to add more files" : "Drop more files to add them"}</span>
        <span className="upload-queue-count">{files.length} file{files.length === 1 ? "" : "s"} ready</span>
      </div>
    </div>
  );
});