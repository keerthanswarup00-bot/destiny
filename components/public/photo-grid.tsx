import Image from "next/image";
import { Reveal } from "@/components/public/reveal";

const photos = [
  { src: "/images/courtyard.png", alt: "Couple walking at an outdoor celebration", className: "portrait", caption: "Courtyard" },
  { src: "/images/celebration.png", alt: "Dancer at a candlelit event", className: "wide", caption: "Celebration" },
  { src: "/images/hero.png", alt: "Couple at an evening reception", className: "landscape", caption: "Evening reception" },
];

export function PhotoGrid({ expanded = false }: { expanded?: boolean }) {
  const items = expanded ? Array.from({ length: 12 }, (_, i) => photos[i % photos.length]) : photos;
  const sizes = expanded ? "(max-width: 900px) 50vw, 33vw" : "(max-width: 640px) 100vw, 50vw";
  return (
    <div className={`photo-grid${expanded ? " expanded" : ""}`}>
      {items.map((photo, index) => (
        <Reveal
          as="figure"
          className={photo.className}
          delay={(index % 4) * 90}
          key={`${photo.src}-${index}`}
        >
          <Image src={photo.src} alt={photo.alt} fill sizes={sizes} />
          <figcaption>
            <span className="photo-grid__index">{String(index + 1).padStart(2, "0")}</span>
            <span>{photo.caption}</span>
          </figcaption>
        </Reveal>
      ))}
    </div>
  );
}