export type SiteVideo = {
  id: string;
  src: string;
  poster: string;
  title: string;
  description: string;
  duration: string;
};

export type VideoRendition = {
  minWidth: number;
  poster?: string;
  src: string;
};

// The long-form films are served from R2, not from public/: the reception film
// is ~150MB, well past GitHub's 100MB ceiling, so it cannot ship in the repo.
// Reels are small enough to live in public/ and are referenced directly.
const FILM = (name: string) => `/media/videos/${name}`;

const RECEPTION_FILM_720 = FILM("gallery-reception-film.mp4");
const RECEPTION_FILM_1080 = FILM("reception-film-1080.mp4");
const RECEPTION_FILM_POSTER = "/images/video/reception-film.jpg";

export const HOME_VIDEO: SiteVideo = {
  id: "ss-home",
  src: FILM("ss-home.mp4"),
  poster: "/images/video/ss-home.jpg",
  title: "S&S",
  description: "A moving portrait of the celebration.",
  duration: "02:08",
};

export const RECEPTION_FILM: SiteVideo & { renditions: VideoRendition[] } = {
  id: "reception-film",
  src: RECEPTION_FILM_1080,
  poster: RECEPTION_FILM_POSTER,
  title: "Varshitha & Varun",
  description: "A celebration, captured in motion.",
  duration: "05:17",
  renditions: [
    { src: RECEPTION_FILM_1080, poster: RECEPTION_FILM_POSTER, minWidth: 900 },
    { src: RECEPTION_FILM_720, poster: "/images/video/gallery-reception-film.jpg", minWidth: 0 },
  ],
};

export const GALLERY_VIDEOS: SiteVideo[] = [
  {
    id: "reception-film",
    src: RECEPTION_FILM_720,
    poster: "/images/video/gallery-reception-film.jpg",
    title: "The Varshitha & Varun Reception",
    description: "A reception film, held in motion.",
    duration: "05:17",
  },
  {
    id: "sh-teaser",
    src: FILM("gallery-sh-teaser.mp4"),
    poster: "/images/video/gallery-sh-teaser.jpg",
    title: "S+H Teaser",
    description: "A short film teaser from S+H.",
    duration: "00:58",
  },
];

export const WEDDING_HERO_VIDEO: SiteVideo = {
  id: "wedding-hero-film",
  src: RECEPTION_FILM_720,
  poster: "/images/video/gallery-reception-film.jpg",
  title: "Varshitha & Varun",
  description: "The celebration, moving the way it was lived.",
  duration: "05:17",
};
