"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FullscreenIcon, MutedIcon, PauseIcon, PlayIcon, SoundIcon } from "@/components/public/video-icons";
import type { ReelRendition, SiteReel } from "@/lib/site/reels";

/** Share of a section that must be on screen before its Reel plays. */
const ACTIVE_RATIO = 0.55;
/** How far outside the viewport a section may sit and still start fetching. */
const PREFETCH_MARGIN = "60% 0px";

function pickRendition(renditions: ReelRendition[], width: number): string {
  for (const rendition of renditions) {
    if (width >= rendition.minWidth) return rendition.src;
  }
  return renditions[renditions.length - 1].src;
}

type ReelPlayerProps = {
  reel: SiteReel;
  index: number;
  total: number;
  /** From 900px the Reels are an editorial three-up; below it each one is a section. */
  isDesktop: boolean;
  /** The row's chosen Reel. Always true below 900px, where sections are equal peers. */
  isActive: boolean;
  /** The three-up is near the viewport, so its active Reel may load and play. */
  isSectionNear: boolean;
  reducedMotion: boolean;
  /** Client-only flag so the server and the hydration pass agree on the markup. */
  mounted: boolean;
  /** Desktop only: hand the row its focus when this Reel becomes the chosen one. */
  onActivate?: () => void;
};

/**
 * One Reel, owning its own playback.
 *
 * Below 900px every Reel is a full-width section in the page's own scroll, so
 * this component governs itself: it plays while its section is on screen, parks
 * when it is not, and its controls act on this Reel alone. From 900px the Reels
 * are a three-up row and the section hands down a single chosen Reel instead.
 */
export function ReelPlayer({
  reel,
  index,
  total,
  isDesktop,
  isActive,
  isSectionNear,
  reducedMotion,
  mounted,
  onActivate,
}: ReelPlayerProps) {
  const articleRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef(false);
  const muteTouchedRef = useRef(false);

  const [resolvedSrc, setResolvedSrc] = useState("");
  const [isNear, setIsNear] = useState(false);
  const [isOnScreen, setIsOnScreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [painted, setPainted] = useState(false);

  const active = isDesktop ? isActive && isSectionNear : isOnScreen;
  /**
   * Fetch late, and only for what is being watched: a phone pulls the film of
   * the section it is scrolling towards, the row pulls its chosen Reel.
   */
  const src = (isDesktop ? isActive && isSectionNear : isNear) ? resolvedSrc : "";

  const reportError = useCallback(
    (url: string, stage: "load" | "playback") => {
      // Always logged: a dead Reel must never fail silently, and a console
      // message is invisible to visitors unless they open devtools.
      console.error(`[Reel] Failed to ${stage} ${reel.id}\nURL: ${url}`);
      setHasFailed(true);
      setIsPlaying(false);
    },
    [reel.id],
  );

  // Pick the cheapest rendition that suits the viewport, re-evaluated on resize.
  useEffect(() => {
    const sync = () => setResolvedSrc(pickRendition(reel.renditions, window.innerWidth));
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [reel.renditions]);

  // Below 900px visibility of this section decides everything: it drives the
  // fetch, and it is what makes the Reel play. Nothing is shared with its
  // neighbours, so each section can only ever be running on its own film.
  useEffect(() => {
    const article = articleRef.current;
    if (!article || isDesktop || typeof IntersectionObserver === "undefined") return;
    const prefetch = new IntersectionObserver(([entry]) => setIsNear(entry.isIntersecting), {
      rootMargin: PREFETCH_MARGIN,
    });
    const onScreen = new IntersectionObserver(
      ([entry]) => setIsOnScreen(entry.isIntersecting && entry.intersectionRatio >= ACTIVE_RATIO),
      { threshold: [0, ACTIVE_RATIO, 1] },
    );
    prefetch.observe(article);
    onScreen.observe(article);
    return () => {
      prefetch.disconnect();
      onScreen.disconnect();
    };
  }, [isDesktop]);

  // Park the Reel when its section goes away, and restart it from the top when
  // the section comes back.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      activeRef.current = false;
      if (!video.paused) {
        video.pause();
        video.currentTime = 0;
      }
      // Parked in the frame callback like every other update in this effect, so
      // letting a section go never cascades a render.
      const frame = window.requestAnimationFrame(() => setIsPlaying(false));
      return () => window.cancelAnimationFrame(frame);
    }
    activeRef.current = true;
    video.muted = muteTouchedRef.current ? isMuted : true;
    // State updates live in the frame callback so activation never cascades renders.
    const frame = window.requestAnimationFrame(() => {
      const target = videoRef.current;
      setAutoplayBlocked(false);
      // isSectionNear keeps a scroll-away pause from becoming permanent: coming
      // back flips it, which re-runs this effect and restarts the Reel.
      if (!target || !src || reducedMotion || !mounted) {
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
          // A dead source surfaces as a media error, not a policy refusal. Only
          // the latter should offer the visitor a Play button to retry with.
          if (target.error) {
            reportError(target.currentSrc || src || reel.src, "playback");
            return;
          }
          setAutoplayBlocked(true);
        },
      );
    });
    return () => window.cancelAnimationFrame(frame);
    // isMuted is applied imperatively on user toggle, so it is not a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, src, reducedMotion, mounted]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
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
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    muteTouchedRef.current = true;
    setIsMuted(next);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Fullscreen the stage, not the <video>: the controls are its siblings, so
    // promoting the video alone would hide play/mute/exit in fullscreen. The
    // stage is the same live element the visitor was just watching, so playback
    // position, play state and mute carry straight through, and the fullscreen
    // rules in globals.css letterbox the frame whole instead of showing the
    // card's 9/16 cover crop.
    const stage = video.closest<HTMLElement>(".reel__stage") ?? video.parentElement;
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
    // iOS Safari on iPhone has no Element.requestFullscreen; it only exposes
    // native fullscreen on the video itself, which already plays the full frame.
    legacy?.webkitEnterFullscreen?.();
  }, []);

  // Gated on `mounted` so the server and the hydration pass agree on the markup.
  const canFullscreen = mounted && typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
  /** Below 900px a section always carries its own controls; the row shows one set. */
  const showControls = !hasFailed && (!isDesktop || isActive);
  const showPrompt = !hasFailed && mounted && active && !isPlaying && (autoplayBlocked || reducedMotion);
  /** The section the visitor is watching, and so the only one that reports itself. */
  const isReported = isDesktop ? isActive : isOnScreen;
  const status = `${reel.title} is ${isPlaying ? `playing${isMuted ? " muted" : " with sound"}` : `paused${isMuted ? " and muted" : ""}`}`;
  const number = String(index + 1).padStart(2, "0");
  // A numbered section of its own carries the total; the row keeps a bare index
  // and reads its position from the counter underneath.
  const indexLabel = isDesktop ? number : `${number} / ${String(total).padStart(2, "0")}`;

  return (
    <article
      aria-label={`${reel.title} of ${total}`}
      className="reel"
      data-active={isActive ? "true" : "false"}
      data-painted={painted ? "true" : "false"}
      data-reel-index={index}
      ref={articleRef}
    >
      <div className="reel__stage">
        <video
          aria-label={reel.title}
          controls={false}
          loop
          muted={isMuted}
          onCanPlay={() => setPainted(true)}
          onError={() => reportError(src || reel.src, "load")}
          onPause={() => {
            if (activeRef.current) setIsPlaying(false);
          }}
          onPlay={() => {
            if (activeRef.current) {
              setIsPlaying(true);
              setAutoplayBlocked(false);
            }
          }}
          playsInline
          poster={reel.poster}
          preload={active ? "auto" : "metadata"}
          ref={videoRef}
          src={src || undefined}
        />
        <div aria-hidden="true" className="video-player__shade" />

        {showControls ? (
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

        {showPrompt ? (
          <button aria-label={`Play ${reel.title}`} className="video-player__center-play" onClick={togglePlay} type="button">
            <PlayIcon />
          </button>
        ) : null}

        {isDesktop && !isActive && !hasFailed ? (
          <button
            aria-label={`Play ${reel.title}, reel ${index + 1} of ${total}`}
            className="video-player__center-play reel__activate"
            data-reel-activate
            onClick={onActivate}
            type="button"
          >
            <PlayIcon />
          </button>
        ) : null}

        <span aria-hidden="true" className="reel__index">
          {indexLabel}
        </span>
        <span aria-live="polite" className="video-player__status">{isReported ? status : ""}</span>
      </div>
    </article>
  );
}
