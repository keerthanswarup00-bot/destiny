"use client";

import { useEffect, useRef } from "react";

export function DownloadZipPreloader({ galleryId, folderIds }: { galleryId: string; folderIds: string[] }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !folderIds.length) return;
    started.current = true;

    let cancelled = false;

    async function prepare() {
      for (const folderId of folderIds) {
        if (cancelled) return;
        try {
          await fetch(
            `/api/admin/galleries/${encodeURIComponent(galleryId)}/sets/${encodeURIComponent(folderId)}/prepare-download`,
            { method: "POST" },
          );
        } catch {
          // A failed prewarm never blocks the admin UI. The download endpoint
          // can prepare a missing archive on demand.
        }
      }
    }

    void prepare();
    return () => { cancelled = true; };
  }, [galleryId, folderIds]);

  return null;
}
