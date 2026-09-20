"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

export type JustifiedPhoto = {
  id: string;
  src: string;
  width: number | null;
  height: number | null;
};

const MIN_ROW_HEIGHT = 180;
const MAX_ROW_HEIGHT = 460;

function ratioOf(photo: JustifiedPhoto) {
  if (photo.width && photo.height && photo.height > 0) return photo.width / photo.height;
  return 3 / 4;
}

/**
 * A justified photographic gallery.
 *
 * Rows are formed from natural aspect ratios and scaled so the row fills the
 * available width. Every photograph keeps its true proportions — nothing is
 * cropped or distorted.
 */
export function JustifiedPhotoGrid({
  photos,
  onPhotoClick,
  overlay,
  className = "",
}: {
  photos: JustifiedPhoto[];
  onPhotoClick: (index: number) => void;
  overlay?: (photo: JustifiedPhoto, index: number) => React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gap = width > 760 ? 5 : 4;

  const rows = useMemo(() => {
    if (!width || !photos.length) return [];
    const ratios = photos.map(ratioOf);
    const target = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, width * 0.55));
    const out: { items: JustifiedPhoto[]; height: number }[] = [];
    let i = 0;
    while (i < photos.length) {
      let sum = 0;
      let count = 0;
      let k = i;
      while (k < photos.length) {
        const next = sum + ratios[k] * target + gap * count;
        if (count > 0 && next > width) break;
        sum += ratios[k];
        count += 1;
        k += 1;
      }
      const available = width - gap * (count - 1);
      const height = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, available / sum));
      out.push({ items: photos.slice(i, k), height });
      i = k;
    }
    return out;
  }, [photos, width, gap]);

  return (
    <div className={`justified-grid${className ? ` ${className}` : ""}`} ref={ref}>
      {width === 0 ? null : (() => {
        let offset = 0;
        return rows.map((row, rowIndex) => {
          const rowStart = offset;
          offset += row.items.length;
          return (
            <div
              className="justified-row"
              key={rowIndex}
              style={{ height: row.height, gap, marginBottom: gap, justifyContent: row.items.length === 1 ? "center" : undefined }}
            >
              {row.items.map((item, i) => (
                <figure className="justified-cell" key={item.id}>
                  <button
                    aria-label="View photo"
                    className="justified-open"
                    onClick={() => onPhotoClick(rowStart + i)}
                    style={{ width: row.height * ratioOf(item) }}
                    type="button"
                  >
                    {failed.has(item.id) ? (
                      <span aria-hidden="true" className="justified-fallback" />
                    ) : item.src ? (
                      /* Signed preview URL; next/image is a poor fit for short-lived tokens. */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img alt="" decoding="async" loading="lazy" onError={() => setFailed(prev => prev.has(item.id) ? prev : new Set(prev).add(item.id))} src={item.src} />
                    ) : (
                      <span aria-hidden="true" className="justified-fallback" />
                    )}
                  </button>
                  {overlay ? overlay(item, rowStart + i) : null}
                </figure>
              ))}
            </div>
          );
        });
      })()}
    </div>
  );
}