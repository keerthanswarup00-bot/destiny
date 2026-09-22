import { Reveal } from "@/components/public/reveal";

type GalleryHighlightCrop = { x: number; y: number; zoom: number };

/**
 * Public Website Gallery Highlight banner.
 *
 * Non-destructive crop: the original full-resolution image is delivered as-is
 * and the stored normalized { x, y, zoom } crop is reproduced purely with a CSS
 * transform. The transform maps the cover-fit image so that the covered point
 * `x, y` is centered and the magnification `zoom` is applied:
 *   translate((0.5 - x * zoom) * 100%, (0.5 - y * zoom) * 100%) scale(zoom)
 * with transform-origin top-left (CSS applies scale first, then translate, so
 * the translate stays in container units and the centered point is exact).
 */
export function GalleryHighlight({
  url,
  crop,
}: {
  url: string;
  width: number | null;
  height: number | null;
  crop: GalleryHighlightCrop | null;
}) {
  const transform = crop && crop.zoom >= 1
    ? `translate(${(0.5 - crop.x * crop.zoom) * 100}%, ${(0.5 - crop.y * crop.zoom) * 100}%) scale(${crop.zoom})`
    : undefined;

  return (
    <Reveal as="div" className="gallery-highlight__wrap">
      <div className="gallery-highlight" role="img" aria-label="Featured photograph from the gallery">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="gallery-highlight__img"
          decoding="async"
          fetchPriority="high"
          src={url}
          style={transform ? { transform, transformOrigin: "0 0" } : undefined}
        />
        <span className="gallery-highlight__shade" />
        <span className="gallery-highlight__label">Selected work</span>
      </div>
    </Reveal>
  );
}