"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { FullscreenIcon, MutedIcon, PauseIcon, PlayIcon, SoundIcon } from "@/components/public/video-icons";
import { SITE_REELS, type ReelRendition, type SiteReel } from "@/lib/site/reels";

/** Above this width the section is an editorial 3-up; below it is a Reel stack. */
const DESKTOP_QUERY = "(min-width: 900px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Share of a Reel that must be visible before it counts as active. */
const ACTIVE_RATIO = 0.55;

function subscribeTo(query: string) {
  return (callback: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", callback);
    return () => list.removeEventListener("change", callback);
  };
}

const noopSubscribe = () => () => undefined;

const isDesktopSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches;
const isDesktopServerSnapshot = () => false;
const reducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const reducedMotionServerSnapshot = () => false;

function pickRendition(renditions: ReelRendition[], width: number): string {
  for (const rendition of renditions) {
    if (width >= rendition.minWidth) return rendition.src;
  }
  return renditions[renditions.length - 1].src;
}

type ReelScrollSectionProps = {
  reels?: SiteReel[];
};

export function ReelScrollSection({ reels = SITE_REELS }: ReelScrollSectionProps) {
  const total = reels.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const activeRef = useRef(-1);
  const muteTouchedRef = useRef(false);

  const isDesktop = useSyncExternalStore(subscribeTo(DESKTOP_QUERY), isDesktopSnapshot, isDesktopServerSnapshot);
  const reducedMotion = useSyncExternalStore(subscribeTo(REDUCED_MOTION_QUERY), reducedMotionSnapshot, reducedMotionServerSnapshot);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Nothing is chosen until the visitor picks a Reel; until then the layout decides
  // the opening Reel - the middle one on desktop, the first on mobile.
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [paintedReels, setPaintedReels] = useState<Record<number, boolean>>({});
  const [sources, setSources] = useState<string[]>(() => reels.map(() => ""));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTrackInView, setIsTrackInView] = useState(false);

  const activeIndex = chosenIndex ?? (isDesktop ? Math.min(1, total - 1) : 0);
  const activeSource = sources[activeIndex] ?? "";

  /** Only the active Reel fetches video; the next one is warmed with metadata only. */
  const shouldLoad = useCallback(
    (index: number) => index === activeIndex || (!isDesktop && index === activeIndex + 1),
    [activeIndex, isDesktop],
  );

  // Pick the cheapest rendition that suits the viewport, re-evaluated on resize.
  useEffect(() => {
    const sync = () => setSources(reels.map((reel) => pickRendition(reel.renditions, window.innerWidth)));
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [reels]);

  // Mobile: visibility decides which Reel is active, never scroll position.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || isDesktop || typeof IntersectionObserver === "undefined") return;
    const nodes = Array.from(track.querySelectorAll<HTMLElement>("[data-reel-index]"));
    if (!nodes.length) return;
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        let best: Element | null = null;
        let bestRatio = 0;
        for (const [node, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = node;
            bestRatio = ratio;
          }
        }
        if (!best || bestRatio < ACTIVE_RATIO) return;
        const index = Number((best as HTMLElement).dataset.reelIndex);
        if (Number.isFinite(index)) setChosenIndex(index);
      },
      { root: track, threshold: [0, 0.25, 0.55, 0.8, 1] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [isDesktop]);

  // One Reel at a time: park every other Reel, then start the active one from the top.
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video && index !== activeIndex && !video.paused) {
        video.pause();
        video.currentTime = 0;
      }
    });
    if (!mounted) return;
    const video = videoRefs.current[activeIndex];
    if (!video) return;
    activeRef.current = activeIndex;
    video.muted = muteTouchedRef.current ? isMuted : true;
    // State updates live in the frame callback so activation never cascades renders.
    const frame = window.requestAnimationFrame(() => {
      const target = videoRefs.current[activeIndex];
      setAutoplayBlocked(false);
      // isTrackInView keeps a scroll-away pause from becoming permanent: coming
      // back flips it, which re-runs this effect and restarts the Reel.
      if (!target || !activeSource || reducedMotion || !isTrackInView) {
        setIsPlaying(false);
        return;
      }
      try {
        target.currentTime = 0;
      } catch {
        /* metadata not ready yet; the seek is not critical */
      }
      void target.play().then(
        () => setIsPlaying(true),
        () => {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        },
      );
    });
    return () => window.cancelAnimationFrame(frame);
    // isMuted is applied imperatively on user toggle, so it is not a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeSource, isTrackInView, mounted, reducedMotion]);

  // Pause when the section leaves the viewport so nothing plays off-screen.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;
    // The observer's first callback reports where the track was at mount, which is
    // off-screen on a page this long. It arrives after the autoplay above has
    // already started, so acting on it would abort the play() and leave the Reel
    // stuck behind a Play prompt. Only pause once the track has been seen.
    let hasBeenVisible = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasBeenVisible = true;
          setIsTrackInView(true);
          return;
        }
        if (!hasBeenVisible) return;
        setIsTrackInView(false);
        const video = videoRefs.current[activeRef.current];
        if (video && !video.paused) video.pause();
      },
      { rootMargin: "0px", threshold: 0.2 },
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const activate = useCallback((index: number) => {
    setChosenIndex(index);
  }, []);

  /**
   * Arrow keys must hand focus to the Reel they just activated, but its controls
   * only exist after React re-renders. Queue the intent and settle focus once the
   * new Reel is on screen, so the move happens after the DOM update rather than
   * before it. Mouse and touch activation leave focus alone.
   */
  const focusQueuedRef = useRef(false);
  useEffect(() => {
    if (!focusQueuedRef.current) return;
    focusQueuedRef.current = false;
    trackRef.current
      ?.querySelector<HTMLElement>(`.reel[data-reel-index="${activeIndex}"] .video-player__controls button`)
      ?.focus();
  }, [activeIndex]);

  const togglePlay = useCallback(() => {
    const video = videoRefs.current[activeIndex];
    if (!video) return;
    if (video.paused) {
      video.muted = muteTouchedRef.current ? isMuted : true;
      void video.play().then(
        () => setIsPlaying(true),
        () => setAutoplayBlocked(true),
      );
    } else {
      video.pause();
    }
  }, [activeIndex, isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRefs.current[activeIndex];
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    muteTouchedRef.current = true;
    setIsMuted(next);
  }, [activeIndex]);

  const toggleFullscreen = useCallback(() => {
    const video = videoRefs.current[activeIndex];
    const stage = video?.parentElement;
    if (!stage) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    const legacy = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (typeof stage.requestFullscreen === "function") {
      void stage.requestFullscreen().catch(() => legacy?.webkitEnterFullscreen?.());
      return;
    }
    legacy?.webkitEnterFullscreen?.();
  }, [activeIndex]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isDesktop || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      // Arrows move relative to the Reel holding focus, so tabbing to a side
      // Reel and pressing Right steps to its neighbour rather than to the active one.
      const focusedReel = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-reel-index]");
      const from = focusedReel ? Number(focusedReel.dataset.reelIndex) : activeIndex;
      if (!Number.isFinite(from)) return;
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = Math.min(total - 1, Math.max(0, from + step));
      event.preventDefault();
      if (next === from) return;
      activate(next);
      focusQueuedRef.current = true;
    },
    [activate, activeIndex, isDesktop, total],
  );

  const activeReel = reels[activeIndex];
  // Gated on `mounted` so the server and the hydration pass agree on the markup.
  const canFullscreen = mounted && typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
  const showPrompt = mounted && !isPlaying && (autoplayBlocked || reducedMotion);
  const status = activeReel
    ? `${activeReel.title} is ${isPlaying ? `playing${isMuted ? " muted" : " with sound"}` : `paused${isMuted ? " and muted" : ""}`}`
    : "";
  const counter = useMemo(() => String(activeIndex + 1).padStart(2, "0"), [activeIndex]);

  return (
    <section aria-labelledby="reels-title" className="reels" data-reels-ready={mounted ? "true" : "false"}>
      <div className="reels__head">
        <h2 id="reels-title">
          Stories in <em>motion.</em>
        </h2>
        <p className="reels__intro">Real celebrations. Beautifully captured.</p>
      </div>

      <div aria-label="Wedding films" className="reels__track" onKeyDown={onKeyDown} ref={trackRef} role="group">
        {reels.map((reel, index) => {
          const isActive = index === activeIndex;
          const src = shouldLoad(index) ? sources[index] : "";
          return (
            <article
              aria-label={`${reel.title} of ${total}`}
              className="reel"
              data-active={isActive ? "true" : "false"}
              data-painted={paintedReels[index] ? "true" : "false"}
              data-reel-index={index}
              key={reel.id}
            >
              <div className="reel__stage">
                <video
                  aria-label={reel.title}
                  controls={false}
                  loop
                  muted={isMuted}
                  onCanPlay={() => setPaintedReels(current => (current[index] ? current : { ...current, [index]: true }))}
                  onPause={() => {
                    if (activeRef.current === index) setIsPlaying(false);
                  }}
                  onPlay={() => {
                    if (activeRef.current === index) {
                      setIsPlaying(true);
                      setAutoplayBlocked(false);
                    }
                  }}
                  playsInline
                  poster={reel.poster}
                  preload={isActive ? "auto" : "metadata"}
                  ref={node => {
                    videoRefs.current[index] = node;
                  }}
                  src={src || undefined}
                />
                <div aria-hidden="true" className="video-player__shade" />

                {isActive ? (
                  <div aria-label={`${reel.title} controls`} className="video-player__controls" role="group">
                    <button
                      aria-label={isPlaying ? `Pause ${reel.title}` : `Play ${reel.title}`}
                      aria-pressed={isPlaying}
                      className="video-player__button"
                      onClick={togglePlay}
                      type="button"
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button
                      aria-label={isMuted ? `Unmute ${reel.title}` : `Mute ${reel.title}`}
                      aria-pressed={!isMuted}
                      className="video-player__button"
                      onClick={toggleMute}
                      type="button"
                    >
                      {isMuted ? <MutedIcon /> : <SoundIcon />}
                    </button>
                    {canFullscreen ? (
                      <button
                        aria-label={`${isFullscreen ? "Exit" : "Enter"} fullscreen for ${reel.title}`}
                        className="video-player__button"
                        onClick={toggleFullscreen}
                        type="button"
                      >
                        <FullscreenIcon />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {isActive && showPrompt ? (
                  <button aria-label={`Play ${reel.title}`} className="video-player__center-play" onClick={togglePlay} type="button">
                    <PlayIcon />
                  </button>
                ) : null}

                {!isActive ? (
                  <button
                    aria-label={`Play ${reel.title}, reel ${index + 1} of ${total}`}
                    className="video-player__center-play reel__activate"
                    data-reel-activate
                    onClick={() => activate(index)}
                    type="button"
                  >
                    <PlayIcon />
                  </button>
                ) : null}

                <span aria-hidden="true" className="reel__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span aria-live="polite" className="video-player__status">{isActive ? status : ""}</span>
              </div>
            </article>
          );
        })}
      </div>

      <p aria-hidden="true" className="reels__counter">
        <span>{counter}</span> / {String(total).padStart(2, "0")}
      </p>
    </section>
  );
}
