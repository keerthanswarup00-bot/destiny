import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ReceptionFilm } from "@/components/public/reception-film";
import { ReelScrollSection } from "@/components/public/reel-scroll-section";
import { Reveal } from "@/components/public/reveal";
import { getSiteContact, getSiteHome, getSiteStories, resolveSiteAssetPaths } from "@/lib/site/site-content";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/site/social-links";

function heroDelay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

function headingLines(text: string): ReactNode[] {
  const lines = text.split("\n").filter(line => line.trim().length > 0) as string[];
  if (lines.length <= 1) return [text];
  return lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    const node = isLast ? <em key={index}>{line}</em> : line;
    return index < lines.length - 1 ? <span key={index}>{node}<br /></span> : node;
  });
}

function formatEventDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function galleryCategoryUrl(label: string): string {
  const category = label.trim().toLowerCase().replace(/^weddings$/, "wedding");
  return category ? `/gallery?category=${encodeURIComponent(category)}` : "/gallery";
}

export default async function Home() {
  const home = await getSiteHome();
  const [stories, contact] = await Promise.all([getSiteStories(), getSiteContact()]);
  const urls = await resolveSiteAssetPaths([home.hero.image_path, home.approach.image_path]);
  const heroUrl = home.hero.image_path ? urls[home.hero.image_path] : null;
  const approachUrl = home.approach.image_path ? urls[home.approach.image_path] : null;
  const heroHeading = headingLines(home.hero.heading);

  return (
    <>
      <section className="hero">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="hero__img-plain" src={heroUrl} />
        ) : (
          <Image className="hero__img" src="/images/hero.png" alt="Evening celebration under decorative lights" fill priority sizes="100vw" />
        )}
        <div className="hero-content">
          <p className="eyebrow hero__in" style={heroDelay(140)}>{home.hero.eyebrow}</p>
          <h1 className="hero__in" style={heroDelay(240)}>{heroHeading}</h1>
          <p className="hero__lede hero__lede--desktop hero__in" style={heroDelay(340)}>{home.hero.description}</p>
          <p className="hero__lede hero__lede--mobile hero__in" style={heroDelay(340)}>
            Timeless imagery for weddings, events, and celebrations.
          </p>
          <div className="hero__actions hero__in" style={heroDelay(440)}>
            <Link className="button light" href={home.hero.primary_url}>{home.hero.primary_label} <span>→</span></Link>
            <Link className="button ghost" href={home.hero.secondary_url}>{home.hero.secondary_label}</Link>
          </div>
        </div>
        <a className="hero__scroll" href="#work">Scroll</a>
      </section>

      {home.whatWeDocument.enabled && home.whatWeDocument.items.length ? (
        <section className="categories" id="work">
          <Reveal><p className="eyebrow">{home.whatWeDocument.label}</p></Reveal>
          <div className="category-list">
            {home.whatWeDocument.items.map((item, index) => (
              <Reveal key={`${item.label}-${index}`} delay={index * 80}>
                <Link href={galleryCategoryUrl(item.label)} className="category-item">
                  <span className="category-item__name">{item.label}</span>
                  <span className="category-item__meta">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span className="category-item__arrow" aria-hidden="true">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {home.stories.enabled && stories.length ? (
        <section className="section stories">
          <div className="section-heading">
            <div>
              <Reveal><p className="eyebrow">{home.stories.title}</p></Reveal>
              <Reveal delay={90}><h2>{headingLines(home.stories.description)}</h2></Reveal>
            </div>
            <Reveal delay={160}>
              <Link className="text-link" href="/gallery">All stories <span>→</span></Link>
            </Reveal>
          </div>
          <div className="story-list">
            {stories.map((story, index) => (
              <Reveal className="story" delay={(index % 2) * 110} key={story.id}>
                <Link href={`/gallery/${story.slug}`} className="story__media" aria-label={story.title}>
                  {story.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={story.title} src={story.coverUrl} />
                  ) : (
                    <span className="story__placeholder">DESTINY</span>
                  )}
                  {story.category ? <span className="story__category">{story.category}</span> : null}
                </Link>
                <div className="story__row">
                  <h3>{story.title}</h3>
                  <p className="story__meta">{[story.location, formatEventDate(story.event_date)].filter(Boolean).join(" · ")}</p>
                  <span className="story__arrow" aria-hidden="true">→</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <ReelScrollSection />

      {home.approach.enabled ? (
        <section className="section approach">
          <div className="approach__hed">
            <div className="approach__panel">
              <Reveal><p className="eyebrow">{home.approach.label}</p></Reveal>
              <Reveal delay={90}><h2>{headingLines(home.approach.heading)}</h2></Reveal>
              {home.approach.body ? (
                <Reveal delay={160}><p className="statement__text" style={{ color: "var(--site-muted)", marginTop: "1.5rem" }}>{home.approach.body}</p></Reveal>
              ) : null}
            </div>
            <Reveal delay={120} className="approach__panel approach__media-wrap">
              <div className="approach__media">
                {approachUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={home.approach.label} src={approachUrl} />
                ) : (
                  <span className="approach__placeholder">DESTINY</span>
                )}
              </div>
            </Reveal>
          </div>
          <div className="approach__principles">
            {home.approach.principles.map((principle, index) => (
              <Reveal className="principle" delay={index * 90} key={principle.label}>
                <p className="principle__no">{String(index + 1).padStart(2, "0")}</p>
                <h3>{principle.label}</h3>
                <p>{principle.description}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <ReceptionFilm />

      {home.cta.enabled ? (
        <section className="cta">
          <div className="cta__inner">
            <Reveal><p className="eyebrow">{home.cta.label}</p></Reveal>
            <Reveal delay={90}><h2>{headingLines(home.cta.heading)}</h2></Reveal>
            {home.cta.description ? (
              <Reveal delay={140}><p className="statement__text" style={{ marginTop: "1.25rem" }}>{home.cta.description}</p></Reveal>
            ) : null}
            <Reveal delay={180}>
              <div className="cta__actions">
                <Link className="button accent" href={home.cta.button_url}>{home.cta.button_text} <span>→</span></Link>
                {contact.email ? <a className="cta__mail" href={`mailto:${contact.email}`}>{contact.email}</a> : null}
              </div>
            </Reveal>
            <Reveal delay={220}>
              <a className="cta__instagram" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <span>Follow the stories</span>
                <strong>{INSTAGRAM_HANDLE}</strong>
                <span>Instagram →</span>
              </a>
            </Reveal>
          </div>
        </section>
      ) : null}
    </>
  );
}
export const dynamic = "force-dynamic";
