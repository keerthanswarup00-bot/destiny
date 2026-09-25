"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import { WEDDING_GALLERY_IMAGES, weddingGalleryLayout, type WeddingGalleryImage } from "@/lib/site/wedding-gallery";

function imageSizes(image: WeddingGalleryImage): string {
  return weddingGalleryLayout(image) === "landscape"
    ? "(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) calc(100vw - 40px), (max-width: 1400px) 66vw, 62vw"
    : "(max-width: 640px) calc(50vw - 26px), (max-width: 1024px) calc(50vw - 30px), (max-width: 1400px) 33vw, 30vw";
}

export function WeddingGallery() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const slides = useMemo(
    () => WEDDING_GALLERY_IMAGES.map(image => ({
      src: image.src,
      width: image.width,
      height: image.height,
      alt: image.alt,
    })),
    [],
  );

  return (
    <>
      <div aria-label="Wedding photography" className="wedding-gallery" role="list">
        {WEDDING_GALLERY_IMAGES.map((image, index) => (
          <figure className={`wedding-gallery__item wedding-gallery__item--${weddingGalleryLayout(image)}`} key={image.id} role="listitem">
            <button
              aria-label={`Open ${image.alt.toLowerCase()}`}
              className="wedding-gallery__button"
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <Image
                alt={image.alt}
                className="wedding-gallery__image"
                height={image.height}
                loading={index < 2 ? "eager" : "lazy"}
                priority={index < 2}
                quality={86}
                sizes={imageSizes(image)}
                src={image.src}
                width={image.width}
              />
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
        className="wedding-lightbox"
        close={() => setActiveIndex(-1)}
        index={activeIndex}
        labels={{
          Close: "Close",
          Next: "Next wedding photograph",
          Previous: "Previous wedding photograph",
          "Photo gallery": "Wedding gallery",
        }}
        on={{
          view: ({ index }) => setActiveIndex(index),
        }}
        open={activeIndex >= 0}
        slides={slides}
        toolbar={{
          buttons: [
            <span className="wedding-lightbox__counter" key="counter">
              {activeIndex >= 0 ? `${activeIndex + 1} / ${WEDDING_GALLERY_IMAGES.length}` : `0 / ${WEDDING_GALLERY_IMAGES.length}`}
            </span>,
            "fullscreen",
            "close",
          ],
        }}
      />
    </>
  );
}
