import Link from "next/link";
import { GalleryHighlight } from "@/components/public/gallery-highlight";
import { PhotoGrid } from "@/components/public/photo-grid";
import { Reveal } from "@/components/public/reveal";
import { getPortfolioGalleries, getSiteWebsiteGalleryByCategory, getSiteWebsiteGalleryHighlight, hasSiteWebsiteGallery } from "@/lib/site/site-content";

export const metadata = { title: "Gallery", description: "Selected work from Destiny Events and Photography." };

const sizes = ["portrait", "wide", "landscape"] as const;

const CATEGORY_OPTIONS = [
  { label: "All", value: "" },
  { label: "Wedding", value: "wedding" },
  { label: "Events", value: "events" },
  { label: "Portraits", value: "portraits" },
  { label: "Celebrations", value: "celebrations" },
];

const CATEGORY_ALIASES: Record<string, string> = {
  weddings: "wedding",
  wedding: "wedding",
  events: "events",
  event: "events",
  portraits: "portraits",
  portrait: "portraits",
  celebrations: "celebrations",
  celebration: "celebrations",
};

function normalizeCategory(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  const category = CATEGORY_ALIASES[normalized] ?? normalized;
  return CATEGORY_OPTIONS.some(option => option.value === category) ? category : "";
}

export default async function Gallery({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category: rawCategory } = await searchParams;
  const category = normalizeCategory(rawCategory);
  const websiteGalleryExists = await hasSiteWebsiteGallery();
  const [websiteImages, highlight] = websiteGalleryExists
    ? await Promise.all([getSiteWebsiteGalleryByCategory(category), getSiteWebsiteGalleryHighlight()])
    : [[], null];
  if (websiteGalleryExists) {
    return (
      <section className="section gallery-page">
        <Reveal><p className="eyebrow">GALLERY</p></Reveal>
        <Reveal delay={90}><h1>Moments, held<br /><em>in their truest light.</em></h1></Reveal>
        <Reveal delay={170}><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p></Reveal>
        {highlight ? <GalleryHighlight crop={highlight.crop} height={highlight.height} url={highlight.url} width={highlight.width} /> : null}
        <GalleryFilters active={category} />
        <div className="photo-grid expanded">
          {websiteImages.map((image, index) => (
            <Reveal
              as="figure"
              className={sizes[index % sizes.length]}
              delay={(index % 4) * 90}
              key={image.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                decoding="async"
                fetchPriority={index < 2 ? "high" : "low"}
                height={image.height ?? undefined}
                loading={index < 2 ? "eager" : "lazy"}
                src={image.url}
                width={image.width ?? undefined}
              />
              <figcaption>
                <span className="photo-grid__index">{String(index + 1).padStart(2, "0")}</span>
                <span>Website gallery</span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </section>
    );
  }

  const galleries = await getPortfolioGalleries();
  const filteredGalleries = category
    ? galleries.filter(gallery => normalizeCategory(gallery.category ?? undefined) === category)
    : galleries;
  if (!galleries.length) {
    return (
      <section className="section gallery-page">
        <Reveal><p className="eyebrow">PORTFOLIO</p></Reveal>
        <Reveal delay={90}><h1>Moments, held<br /><em>in their truest light.</em></h1></Reveal>
        <Reveal delay={170}><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p></Reveal>
        <GalleryFilters active={category} />
        <PhotoGrid expanded />
      </section>
    );
  }
  return (
    <section className="section gallery-page">
      <Reveal><p className="eyebrow">PORTFOLIO</p></Reveal>
      <Reveal delay={90}><h1>Moments, held<br /><em>in their truest light.</em></h1></Reveal>
      <Reveal delay={170}><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p></Reveal>
      <GalleryFilters active={category} />
      <div className="portfolio-grid">
        {filteredGalleries.map((gallery, index) => (
          <Reveal as="div" className="portfolio-card" delay={(index % 3) * 90} key={gallery.id}>
            <Link className="portfolio-card" href={`/gallery/${gallery.slug}`}>
              <div className="portfolio-card__media">
                {gallery.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={gallery.title} src={gallery.coverUrl} />
                ) : (
                  <span className="portfolio-card__placeholder">{gallery.title}</span>
                )}
              </div>
              <div className="portfolio-card__body">
                <h3>{gallery.title}</h3>
                <div className="portfolio-card__meta">
                  {gallery.category ? <span>{gallery.category}</span> : null}
                  {gallery.location ? <span>{gallery.location}</span> : null}
                  {gallery.photoCount ? <span>{gallery.photoCount} {gallery.photoCount === 1 ? "photograph" : "photographs"}</span> : null}
                </div>
                {gallery.description ? <p>{gallery.description}</p> : null}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
      {!filteredGalleries.length ? <p className="empty">No galleries are available in this category yet.</p> : null}
    </section>
  );
}
export const dynamic = "force-dynamic";

function GalleryFilters({ active }: { active: string }) {
  return (
    <nav aria-label="Gallery categories" className="gallery-filters">
      {CATEGORY_OPTIONS.map(option => (
        <Link className={option.value === active ? "is-active" : undefined} href={option.value ? `/gallery?category=${option.value}` : "/gallery"} key={option.label}>
          {option.label}
        </Link>
      ))}
    </nav>
  );
}