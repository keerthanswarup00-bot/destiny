"use client";

import { useState } from "react";

/** A highlight-image renderer with a graceful inline fallback if the signed URL fails to load. */
export function FolderCover({
  src,
  alt,
  width,
  height,
  fallback,
}: {
  src: string | null;
  alt: string;
  width?: number | null;
  height?: number | null;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="client-folder-blank">{fallback}</span>;
  return (
    // Signed preview URL; next/image is a poor fit for short-lived tokens.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} decoding="async" height={height ?? undefined} loading="lazy" onError={() => setFailed(true)} src={src} width={width ?? undefined} />
  );
}