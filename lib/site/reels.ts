export type ReelRendition = {
  minWidth: number;
  src: string;
};

export type SiteReel = {
  id: string;
  src: string;
  poster: string;
  title: string;
  renditions: ReelRendition[];
};

/**
 * Vertical 9:16 films for the homepage "Stories in Motion" section.
 * Ordered shortest-first so the first Reel a phone visitor meets is also the
 * lightest to download.
 */
export const SITE_REELS: SiteReel[] = [
  {
    id: "reel-01",
    src: "/videos/reel-01.mp4",
    poster: "/images/video/reel-01.jpg",
    title: "Reel 01",
    renditions: [
      { src: "/videos/reel-01.mp4", minWidth: 900 },
      { src: "/videos/reel-01-720.mp4", minWidth: 0 },
    ],
  },
  {
    id: "reel-02",
    src: "/videos/reel-02.mp4",
    poster: "/images/video/reel-02.jpg",
    title: "Reel 02",
    renditions: [
      { src: "/videos/reel-02.mp4", minWidth: 900 },
      { src: "/videos/reel-02-720.mp4", minWidth: 0 },
    ],
  },
  {
    id: "reel-03",
    src: "/videos/reel-03.mp4",
    poster: "/images/video/reel-03.jpg",
    title: "Reel 03",
    renditions: [
      { src: "/videos/reel-03.mp4", minWidth: 900 },
      { src: "/videos/reel-03-720.mp4", minWidth: 0 },
    ],
  },
];
