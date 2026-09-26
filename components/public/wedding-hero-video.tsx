import { Reveal } from "@/components/public/reveal";
import { VideoPlayer } from "@/components/public/video-player";
import { WEDDING_HERO_VIDEO } from "@/lib/site/video-gallery";

/** Opening film for the Wedding gallery, shown above the wedding photographs. */
export function WeddingHeroVideo() {
  return (
    <section aria-labelledby="wedding-film-title" className="wedding-hero-video">
      <div className="wedding-hero-video__header">
        <div>
          <Reveal><p className="eyebrow">THE FILM</p></Reveal>
          <Reveal delay={90}><h2 id="wedding-film-title">A day, <em>in motion.</em></h2></Reveal>
        </div>
        <Reveal delay={150}><p className="wedding-hero-video__intro">The celebration, moving the way it was lived.</p></Reveal>
      </div>
      <Reveal delay={210}>
        <VideoPlayer autoPlay poster={WEDDING_HERO_VIDEO.poster} src={WEDDING_HERO_VIDEO.src} title={WEDDING_HERO_VIDEO.title} variant="feature" />
      </Reveal>
    </section>
  );
}
