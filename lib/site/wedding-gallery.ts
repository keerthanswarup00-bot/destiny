export type WeddingGalleryImage = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const WEDDING_GALLERY_IMAGES: WeddingGalleryImage[] = [
  { id: "01", src: "/images/wedding/01.webp", width: 1080, height: 1350, alt: "Wedding photograph 01" },
  { id: "02", src: "/images/wedding/02.webp", width: 1080, height: 1350, alt: "Wedding photograph 02" },
  { id: "03", src: "/images/wedding/03.webp", width: 1080, height: 1350, alt: "Wedding photograph 03" },
  { id: "04", src: "/images/wedding/04.webp", width: 1080, height: 1350, alt: "Wedding photograph 04" },
  { id: "05", src: "/images/wedding/05.webp", width: 1080, height: 1350, alt: "Wedding photograph 05" },
  { id: "06", src: "/images/wedding/06.webp", width: 2400, height: 3000, alt: "Wedding photograph 06" },
  { id: "07", src: "/images/wedding/07.webp", width: 1080, height: 1350, alt: "Wedding photograph 07" },
  { id: "08", src: "/images/wedding/08.webp", width: 2400, height: 3000, alt: "Wedding photograph 08" },
  { id: "09", src: "/images/wedding/09.webp", width: 1080, height: 1350, alt: "Wedding photograph 09" },
  { id: "10", src: "/images/wedding/10.webp", width: 1080, height: 1350, alt: "Wedding photograph 10" },
  { id: "11", src: "/images/wedding/11.webp", width: 2400, height: 3000, alt: "Wedding photograph 11" },
  { id: "12", src: "/images/wedding/12.webp", width: 1080, height: 1350, alt: "Wedding photograph 12" },
  { id: "13", src: "/images/wedding/13.webp", width: 2400, height: 3000, alt: "Wedding photograph 13" },
  { id: "14", src: "/images/wedding/14.webp", width: 2400, height: 3000, alt: "Wedding photograph 14" },
  { id: "15", src: "/images/wedding/15.webp", width: 2400, height: 3000, alt: "Wedding photograph 15" },
  { id: "16", src: "/images/wedding/16.webp", width: 2400, height: 1600, alt: "Wedding photograph 16" },
  { id: "17", src: "/images/wedding/17.webp", width: 2400, height: 1600, alt: "Wedding photograph 17" },
  { id: "18", src: "/images/wedding/18.webp", width: 2400, height: 3600, alt: "Wedding photograph 18" },
  { id: "19", src: "/images/wedding/19.webp", width: 2400, height: 3600, alt: "Wedding photograph 19" },
  { id: "20", src: "/images/wedding/20.webp", width: 2400, height: 1304, alt: "Wedding photograph 20" },
  { id: "21", src: "/images/wedding/21.webp", width: 2400, height: 3274, alt: "Wedding photograph 21" },
  { id: "22", src: "/images/wedding/22.webp", width: 2400, height: 3600, alt: "Wedding photograph 22" },
  { id: "23", src: "/images/wedding/23.webp", width: 2400, height: 3600, alt: "Wedding photograph 23" },
  { id: "24", src: "/images/wedding/24.webp", width: 2400, height: 1600, alt: "Wedding photograph 24" },
  { id: "25", src: "/images/wedding/25.webp", width: 2400, height: 3600, alt: "Wedding photograph 25" },
  { id: "26", src: "/images/wedding/26.webp", width: 2400, height: 1600, alt: "Wedding photograph 26" },
  { id: "27", src: "/images/wedding/27.webp", width: 2400, height: 3600, alt: "Wedding photograph 27" },
  { id: "28", src: "/images/wedding/28.webp", width: 2400, height: 3600, alt: "Wedding photograph 28" },
  { id: "29", src: "/images/wedding/29.webp", width: 2400, height: 3547, alt: "Wedding photograph 29" },
];

export function weddingGalleryLayout(image: WeddingGalleryImage): "portrait" | "landscape" | "tall" {
  const ratio = image.width / image.height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.72) return "tall";
  return "portrait";
}
