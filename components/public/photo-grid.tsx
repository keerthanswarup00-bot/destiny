import Image from "next/image";

const photos = [
  { src: "/images/courtyard.png", alt: "Couple walking at an outdoor celebration", className: "portrait" },
  { src: "/images/celebration.png", alt: "Dancer at a candlelit event", className: "wide" },
  { src: "/images/hero.png", alt: "Couple at an evening reception", className: "landscape" },
];

export function PhotoGrid({ expanded = false }: { expanded?: boolean }) {
  const items = expanded ? [...photos, ...photos, ...photos] : photos;
  return <div className={`photo-grid ${expanded ? "expanded" : ""}`}>{items.map((photo, index) => <figure className={photo.className} key={`${photo.src}-${index}`}><Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 700px) 100vw, 50vw" /></figure>)}</div>;
}
