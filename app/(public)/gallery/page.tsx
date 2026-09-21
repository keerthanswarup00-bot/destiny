import Link from "next/link";
import { PhotoGrid } from "@/components/public/photo-grid";
import { Reveal } from "@/components/public/reveal";
import { getPortfolioGalleries, getSiteWebsiteGallery } from "@/lib/site/site-content";

export const metadata = { title: "Gallery", description: "Selected work from Destiny Events and Photography." };

const sizes = ["portrait", "wide", "landscape"] as const;

export default async function Gallery() {
  const websiteImages = await getSiteWebsiteGallery();
  if (websiteImages.length) {
    return (
      <section className="section gallery-page">
        <Reveal><p className="eyebrow">GALLERY</p></Reveal>
        <Reveal delay={90}><h1>Moments, held<br /><em>in their truest light.</em></h1></Reveal>
        <Reveal delay={170}><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p></Reveal>
        <div className="photo-grid expanded">
          {websiteImages.map((image, index) => (
            <Reveal
              as="figure"
              className={sizes[index % sizes.length]}
              delay={(index % 4) * 90}
              key={image.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={image.url} />
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
  if (!galleries.length) {
    return (
      <section className="section gallery-page">
        <Reveal><p className="eyebrow">PORTFOLIO</p></Reveal>
        <Reveal delay={90}><h1>Moments, held<br /><em>in their truest light.</em></h1></Reveal>
        <Reveal delay={170}><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p></Reveal>
        <PhotoGrid expanded />
      </section>
    );
  }
  return (
    <section className="section gallery-page">
      <Reveal><p className="eyebrow">PORTFOLIO</p></Reveal>
      <Reveal delay={90}><h1>Moments, held<br /><em>in their truest light.</em></h1></Reveal>
      <Reveal delay={170}><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p></Reveal>
      <div className="portfolio-grid">
        {galleries.map((gallery, index) => (
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
    </section>
  );
}
export const dynamic = "force-dynamic";