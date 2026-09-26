import { Reveal } from "@/components/public/reveal";
import { VideoPlayer } from "@/components/public/video-player";
import { HOME_VIDEO } from "@/lib/site/video-gallery";

export function HomeVideo() {
  return (
    <section aria-labelledby="home-video-title" className="home-video section">
      <div className="home-video__header">
        <Reveal><p className="eyebrow">IN MOTION</p></Reveal>
        <Reveal delay={90}><h2 id="home-video-title">S&S <em>in motion.</em></h2></Reveal>
        <Reveal delay={150}><p className="home-video__intro">A moving portrait of the celebration.</p></Reveal>
      </div>
      <Reveal delay={210}>
        <VideoPlayer autoPlay poster={HOME_VIDEO.poster} src={HOME_VIDEO.src} title={HOME_VIDEO.title} variant="feature" />
      </Reveal>
    </section>
  );
}
