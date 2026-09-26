import { Reveal } from "@/components/public/reveal";
import { VideoPlayer } from "@/components/public/video-player";
import { GALLERY_VIDEOS } from "@/lib/site/video-gallery";

export function GalleryVideos() {
  return (
    <section aria-labelledby="films-motion-title" className="gallery-videos">
      <div className="gallery-videos__header">
        <div>
          <Reveal><p className="eyebrow">FILMS / MOTION</p></Reveal>
          <Reveal delay={90}><h2 id="films-motion-title">Stories in <em>motion.</em></h2></Reveal>
        </div>
        <Reveal delay={150}><p className="gallery-videos__intro">Two films, held apart from the photography archive.</p></Reveal>
      </div>
      <div className="gallery-videos__grid">
        {GALLERY_VIDEOS.map((video, index) => (
          <article className="gallery-video-card" key={video.id}>
            <Reveal delay={index * 100}>
              <VideoPlayer autoPlay poster={video.poster} src={video.src} title={video.title} />
            </Reveal>
            <div className="gallery-video-card__body">
              <p className="eyebrow">FILM {String(index + 1).padStart(2, "0")}</p>
              <h3>{video.title}</h3>
              <p>{video.description}</p>
              <div className="gallery-video-card__meta">
                <span>{video.duration}</span>
                <span>Loop</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
