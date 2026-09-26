import { Reveal } from "@/components/public/reveal";
import { VideoPlayer } from "@/components/public/video-player";
import { RECEPTION_FILM } from "@/lib/site/video-gallery";

export function ReceptionFilm() {
  return (
    <section aria-labelledby="reception-film-title" className="section reception-film">
      <Reveal>
        <div className="reception-film__slate">
          <p className="eyebrow">RECEPTION FILM</p>
          <span className="reception-film__runtime">{RECEPTION_FILM.duration}</span>
        </div>
      </Reveal>

      <div className="reception-film__hed">
        <Reveal delay={90}>
          <h2 id="reception-film-title">A celebration, <em>captured in motion.</em></h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="reception-film__intro">
            The reception of {RECEPTION_FILM.title}, held in motion — shot on location and cut to the sound of the room.
          </p>
        </Reveal>
      </div>

      <Reveal delay={210}>
        <VideoPlayer
          autoPlay
          poster={RECEPTION_FILM.poster}
          renditions={RECEPTION_FILM.renditions}
          src={RECEPTION_FILM.src}
          title={RECEPTION_FILM.title}
          variant="feature"
        />
      </Reveal>

      <Reveal delay={120}>
        <p className="reception-film__caption">
          <span>{RECEPTION_FILM.title}</span>
          <span>Reception</span>
          <span>Shot in 4K</span>
        </p>
      </Reveal>
    </section>
  );
}
