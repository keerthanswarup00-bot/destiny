/**
 * Public gallery image feed.
 *
 * Two sources feed the public /gallery grid:
 *   1. static site images committed under public/images/<category>/
 *   2. published Website Gallery rows served from signed storage URLs
 *
 * The /gallery page merges both into one list per category (and every
 * category for "All"), so this module only owns the static side plus the
 * shared shape/mixin helpers the feed component renders.
 */

export type GalleryImage = {
  id: string;
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
};

export const STATIC_GALLERY_CATEGORIES = ["wedding", "portraits"] as const;
export type StaticGalleryCategory = (typeof STATIC_GALLERY_CATEGORIES)[number];

const wedding: GalleryImage[] = [
  { id: "wedding-01", src: "/images/wedding/01.webp", width: 1080, height: 1350, alt: "Wedding photograph 01" },
  { id: "wedding-02", src: "/images/wedding/02.webp", width: 1080, height: 1350, alt: "Wedding photograph 02" },
  { id: "wedding-03", src: "/images/wedding/03.webp", width: 1080, height: 1350, alt: "Wedding photograph 03" },
  { id: "wedding-04", src: "/images/wedding/04.webp", width: 1080, height: 1350, alt: "Wedding photograph 04" },
  { id: "wedding-05", src: "/images/wedding/05.webp", width: 1080, height: 1350, alt: "Wedding photograph 05" },
  { id: "wedding-06", src: "/images/wedding/06.webp", width: 2400, height: 3000, alt: "Wedding photograph 06" },
  { id: "wedding-07", src: "/images/wedding/07.webp", width: 1080, height: 1350, alt: "Wedding photograph 07" },
  { id: "wedding-08", src: "/images/wedding/08.webp", width: 2400, height: 3000, alt: "Wedding photograph 08" },
  { id: "wedding-09", src: "/images/wedding/09.webp", width: 1080, height: 1350, alt: "Wedding photograph 09" },
  { id: "wedding-10", src: "/images/wedding/10.webp", width: 1080, height: 1350, alt: "Wedding photograph 10" },
  { id: "wedding-11", src: "/images/wedding/11.webp", width: 2400, height: 3000, alt: "Wedding photograph 11" },
  { id: "wedding-12", src: "/images/wedding/12.webp", width: 1080, height: 1350, alt: "Wedding photograph 12" },
  { id: "wedding-13", src: "/images/wedding/13.webp", width: 2400, height: 3000, alt: "Wedding photograph 13" },
  { id: "wedding-14", src: "/images/wedding/14.webp", width: 2400, height: 3000, alt: "Wedding photograph 14" },
  { id: "wedding-15", src: "/images/wedding/15.webp", width: 2400, height: 3000, alt: "Wedding photograph 15" },
  { id: "wedding-16", src: "/images/wedding/16.webp", width: 2400, height: 1600, alt: "Wedding photograph 16" },
  { id: "wedding-17", src: "/images/wedding/17.webp", width: 2400, height: 1600, alt: "Wedding photograph 17" },
  { id: "wedding-18", src: "/images/wedding/18.webp", width: 2400, height: 3600, alt: "Wedding photograph 18" },
  { id: "wedding-19", src: "/images/wedding/19.webp", width: 2400, height: 3600, alt: "Wedding photograph 19" },
  { id: "wedding-20", src: "/images/wedding/20.webp", width: 2400, height: 1304, alt: "Wedding photograph 20" },
  { id: "wedding-21", src: "/images/wedding/21.webp", width: 2400, height: 3274, alt: "Wedding photograph 21" },
  { id: "wedding-22", src: "/images/wedding/22.webp", width: 2400, height: 3600, alt: "Wedding photograph 22" },
  { id: "wedding-23", src: "/images/wedding/23.webp", width: 2400, height: 3600, alt: "Wedding photograph 23" },
  { id: "wedding-24", src: "/images/wedding/24.webp", width: 2400, height: 1600, alt: "Wedding photograph 24" },
  { id: "wedding-25", src: "/images/wedding/25.webp", width: 2400, height: 3600, alt: "Wedding photograph 25" },
  { id: "wedding-26", src: "/images/wedding/26.webp", width: 2400, height: 1600, alt: "Wedding photograph 26" },
  { id: "wedding-27", src: "/images/wedding/27.webp", width: 2195, height: 3293, alt: "Wedding photograph 27" },
  { id: "wedding-28", src: "/images/wedding/28.webp", width: 2400, height: 3525, alt: "Wedding photograph 28" },
  { id: "wedding-29", src: "/images/wedding/29.webp", width: 2400, height: 3600, alt: "Wedding photograph 29" },
  { id: "wedding-30", src: "/images/wedding/30.webp", width: 2400, height: 1600, alt: "Wedding photograph 30" },
  { id: "wedding-31", src: "/images/wedding/31.webp", width: 2400, height: 3600, alt: "Wedding photograph 31" },
  { id: "wedding-32", src: "/images/wedding/32.webp", width: 2400, height: 3600, alt: "Wedding photograph 32" },
  { id: "wedding-33", src: "/images/wedding/33.webp", width: 2349, height: 3600, alt: "Wedding photograph 33" },
  { id: "wedding-34", src: "/images/wedding/34.webp", width: 2400, height: 2955, alt: "Wedding photograph 34" },
  { id: "wedding-35", src: "/images/wedding/35.webp", width: 2400, height: 3600, alt: "Wedding photograph 35" },
  { id: "wedding-36", src: "/images/wedding/36.webp", width: 2400, height: 3336, alt: "Wedding photograph 36" },
  { id: "wedding-37", src: "/images/wedding/37.webp", width: 2400, height: 3600, alt: "Wedding photograph 37" },
  { id: "wedding-38", src: "/images/wedding/38.webp", width: 2400, height: 3600, alt: "Wedding photograph 38" },
  { id: "wedding-39", src: "/images/wedding/39.webp", width: 2400, height: 3600, alt: "Wedding photograph 39" },
  { id: "wedding-40", src: "/images/wedding/40.webp", width: 853, height: 1280, alt: "Wedding photograph 40" },
  { id: "wedding-41", src: "/images/wedding/41.webp", width: 2400, height: 3044, alt: "Wedding photograph 41" },
];

const portraits: GalleryImage[] = [
  { id: "portraits-01", src: "/images/portraits/01.webp", width: 2400, height: 3600, alt: "Portrait photograph 01" },
  { id: "portraits-02", src: "/images/portraits/02.webp", width: 2400, height: 3600, alt: "Portrait photograph 02" },
  { id: "portraits-03", src: "/images/portraits/03.webp", width: 2400, height: 3547, alt: "Portrait photograph 03" },
];

export const STATIC_GALLERY_IMAGES: Record<StaticGalleryCategory, GalleryImage[]> = { wedding, portraits };

/** Static images committed for one category. */
export function staticGalleryImages(category: StaticGalleryCategory): GalleryImage[] {
  return STATIC_GALLERY_IMAGES[category];
}

/**
 * Interleave grouped images (one group per category) so combined views such as
 * "All" alternate between categories instead of stacking them in blocks.
 */
export function mixGalleryImages(groups: GalleryImage[][]): GalleryImage[] {
  const longest = groups.reduce((max, group) => Math.max(max, group.length), 0);
  const mixed: GalleryImage[] = [];
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const image = group[index];
      if (image) mixed.push(image);
    }
  }
  return mixed;
}

export function galleryImageLayout(image: Pick<GalleryImage, "width" | "height">): "portrait" | "landscape" | "tall" {
  if (!image.width || !image.height) return "portrait";
  const ratio = image.width / image.height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.72) return "tall";
  return "portrait";
}

/** Responsive sizes hint: landscape cells span two columns, so they are wider. */
export function galleryImageSizes(image: Pick<GalleryImage, "width" | "height">): string {
  return galleryImageLayout(image) === "landscape"
    ? "(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) calc(100vw - 40px), (max-width: 1400px) 66vw, 62vw"
    : "(max-width: 640px) calc(50vw - 26px), (max-width: 1024px) calc(50vw - 30px), (max-width: 1400px) 33vw, 30vw";
}
