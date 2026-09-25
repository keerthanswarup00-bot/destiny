"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import { galleryImageLayout, galleryImageSizes, type GalleryImage } from "@/lib/site/gallery-feed";

/** Fallback frame for feed images with no stored dimensions (signed-URL rows). */
const FALLBACK_WIDTH = 1600;
const FALLBACK_HEIGHT = 1067;

function isStatic(image: GalleryImage): boolean {
  return image.src.startsWith("/");
}

/**
 * Public gallery grid. Renders static site images through next/image and
 * published Website Gallery rows (signed storage URLs) as plain <img>, since
 * remote image optimization is not configured for the storage host.
 */
export function GalleryFeed({ images, label = "Photography" }: { images: GalleryImage[]; label?: string }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const slides = useMemo(
    () => images.map(image => ({
      src: image.src,
      width: image.width ?? FALLBACK_WIDTH,
      height: image.height ?? FALLBACK_HEIGHT,
      alt: image.alt,
    })),
    [images],
  );

  if (!images.length) return null;

  return (
    <>
      <div aria-label={label} className="gallery-feed" role="list">
        {images.map((image, index) => (
          <figure className={`gallery-feed__item gallery-feed__item--${galleryImageLayout(image)}`} key={image.id} role="listitem">
            <button
              aria-label={image.alt ? `Open ${image.alt.toLowerCase()}` : `Open photograph ${index + 1}`}
              className="gallery-feed__button"
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              {isStatic(image) ? (
                <Image
                  alt={image.alt}
                  className="gallery-feed__image"
                  height={image.height ?? undefined}
                  loading={index < 2 ? "eager" : "lazy"}
                  priority={index < 2}
                  quality={86}
                  sizes={galleryImageSizes(image)}
                  src={image.src}
                  width={image.width ?? undefined}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={image.alt}
                  className="gallery-feed__image"
                  decoding="async"
                  height={image.height ?? undefined}
                  loading={index < 2 ? "eager" : "lazy"}
                  src={image.src}
                  width={image.width ?? undefined}
                />
              )}
            </button>
          </figure>
        ))}
      </div>
      <Lightbox
        carousel={{
          finite: false,
          imageFit: "contain",
          padding: "24px",
          preload: 1,
          spacing: "12px",
        }}
        className="gallery-lightbox"
        close={() => setActiveIndex(-1)}
        index={activeIndex}
        labels={{
          Close: "Close",
          Next: "Next photograph",
          Previous: "Previous photograph",
          "Photo gallery": `${label} gallery`,
        }}
        on={{
          view: ({ index }) => setActiveIndex(index),
        }}
        open={activeIndex >= 0}
        slides={slides}
        toolbar={{
          buttons: [
            <span className="gallery-lightbox__counter" key="counter">
              {activeIndex >= 0 ? `${activeIndex + 1} / ${images.length}` : `0 / ${images.length}`}
            </span>,
            "fullscreen",
            "close",
          ],
        }}
      />
    </>
  );
}
