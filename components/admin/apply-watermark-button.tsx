"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stamp } from "lucide-react";
import { applyWatermarkToPhotos } from "@/app/admin/crud-actions";

const CHUNK_SIZE = 4;

/**
 * Applies the current watermark to the given selected photos. Runs the batch
 * in small server-action chunks (so a huge set is never sent in one request)
 * while reporting live progress, then surfaces a summary with a targeted
 * retry for any photos that failed.
 */
export function ApplyWatermarkButton({
  disabled = false,
  folderId,
  galleryId,
  photoIds,
}: {
  disabled?: boolean;
  folderId: string;
  galleryId: string;
  photoIds: string[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [succeeded, setSucceeded] = useState(0);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function run(ids: string[], retry = false) {
    if (!ids.length || running) return;
    if (!retry) {
      setSucceeded(0);
      setFailedIds([]);
    }
    setBlocked(null);
    setRunning(true);
    setProgress({ done: 0, total: ids.length });
    let done = 0;
    let added = 0;
    const failed: string[] = [];
    let blockingMessage: string | null = null;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const slice = ids.slice(i, i + CHUNK_SIZE);
      const form = new FormData();
      form.set("gallery_id", galleryId);
      form.set("folder_id", folderId);
      for (const id of slice) form.append("ids", id);
      try {
        const result = await applyWatermarkToPhotos(form);
        done += result.total;
        added += result.succeeded;
        failed.push(...result.failedIds);
        setProgress({ done, total: ids.length });
        if (!result.ok && result.succeeded === 0 && result.failedIds.length === 0 && result.message) {
          blockingMessage = result.message;
          break;
        }
      } catch {
        // Transient request failure: this chunk is treated as failed so it can be retried.
        failed.push(...slice);
        done += slice.length;
        setProgress({ done, total: ids.length });
      }
    }
    setProgress(null);
    setRunning(false);
    router.refresh();
    if (blockingMessage) {
      setBlocked(blockingMessage);
      return;
    }
    setSucceeded(total => (retry ? total : 0) + added);
    setFailedIds(failed);
  }

  return (
    <>
      <button
        className="admin-button is-secondary"
        disabled={disabled || running}
        onClick={() => run(photoIds)}
        title={disabled ? "Watermarking is off — add a logo in Settings → Watermark first." : undefined}
        type="button"
      >
        <Stamp size={15} strokeWidth={1.8} /> Apply Watermark
      </button>
      {progress ? (
        <div className="upload-progress" role="status">
          <span className="upload-spinner" />
          Applying watermark… {progress.done} / {progress.total}
        </div>
      ) : null}
      {blocked ? (
        <div className="ws-confirm">
          <div>
            <p role="alert">{blocked}</p>
            <button className="admin-button" onClick={() => setBlocked(null)} type="button">Close</button>
          </div>
        </div>
      ) : null}
      {!blocked && !progress ? (
        failedIds.length ? (
          <div className="ws-confirm">
            <div>
              <p>Successfully processed: {succeeded}, Failed: {failedIds.length}</p>
              <div className="ws-confirm-actions">
                <button className="admin-button is-secondary" onClick={() => setFailedIds([])} type="button">Close</button>
                <button className="admin-button" onClick={() => run(failedIds, true)} type="button">Retry Failed ({failedIds.length})</button>
              </div>
            </div>
          </div>
        ) : succeeded > 0 ? (
          <div className="ws-confirm">
            <div>
              <p>Watermark applied.</p>
              <button className="admin-button" onClick={() => setSucceeded(0)} type="button">Close</button>
            </div>
          </div>
        ) : null
      ) : null}
    </>
  );
}