"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MutedIcon, PauseIcon, PlayIcon, SoundIcon } from "@/components/public/video-icons";
import type { VideoRendition } from "@/lib/site/video-gallery";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

type VideoPlayerProps = {
  autoPlay?: boolean;
  className?: string;
  poster: string;
  renditions?: VideoRendition[];
  src: string;
  title: string;
  variant?: "feature" | "gallery";
};

type ResolvedSource = {
  poster: string;
  src: string;
};

function pickRendition(renditions: VideoRendition[], width: number): VideoRendition {
  for (const rendition of renditions) {
    if (width >= rendition.minWidth) return rendition;
  }
  return renditions[renditions.length - 1];
}

export function VideoPlayer({ autoPlay = true, className, poster, renditions, src, title, variant = "gallery" }: VideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPlayedRef = useRef(false);
  const autoplayAttemptedRef = useRef(false);
  const [isInView, setIsInView] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [resolved, setResolved] = useState<ResolvedSource | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);

  const orderedRenditions = useMemo(
    () => (renditions && renditions.length ? [...renditions].sort((a, b) => b.minWidth - a.minWidth) : null),
    [renditions],
  );

  useEffect(() => {
    const sync = () => {
      if (shouldLoad) return;
      const chosen = orderedRenditions ? pickRendition(orderedRenditions, window.innerWidth) : null;
      const next = { src: chosen ? chosen.src : src, poster: (chosen ? chosen.poster : undefined) ?? poster };
      setResolved(prev => (prev && prev.src === next.src && prev.poster === next.poster ? prev : next));
    };
    sync();
    if (!orderedRenditions || shouldLoad) return;
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [orderedRenditions, poster, shouldLoad, src]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => {
        setIsInView(true);
        setShouldLoad(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting) setShouldLoad(true);
        const video = videoRef.current;
        if (!entry.isIntersecting && video && !manuallyPlayedRef.current && !video.paused) video.pause();
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(player);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = true;
    return () => video?.pause();
  }, []);

  const attemptAutoplay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !autoPlay || reducedMotion || manuallyPlayedRef.current || autoplayAttemptedRef.current) return;
    autoplayAttemptedRef.current = true;
    void video.play().then(() => {
      setAutoplayBlocked(false);
    }).catch(() => {
      setIsPlaying(false);
      setAutoplayBlocked(true);
    });
  }, [autoPlay, reducedMotion]);

  useEffect(() => {
    if (shouldLoad && isInView && resolved) attemptAutoplay();
  }, [attemptAutoplay, isInView, resolved, shouldLoad]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    manuallyPlayedRef.current = true;
    autoplayAttemptedRef.current = true;
    setShouldLoad(true);
    setAutoplayBlocked(false);
    if (video.paused) {
      void video.play().catch(() => setAutoplayBlocked(true));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const showPlayPrompt = !isPlaying && (autoplayBlocked || reducedMotion);
  const status = isPlaying ? `${title} is playing${isMuted ? " muted" : " with sound"}` : `${title} is paused${isMuted ? " and muted" : ""}`;

  return (
    <div
      className={["video-player", `video-player--${variant}`, className].filter(Boolean).join(" ")}
      data-autoplay-blocked={autoplayBlocked ? "true" : "false"}
      data-video-loaded={shouldLoad ? "true" : "false"}
      ref={playerRef}
    >
      <div className="video-player__frame">
        <video
          aria-label={title}
          autoPlay={shouldLoad && autoPlay && !reducedMotion}
          controls={false}
          loop
          muted={isMuted}
          onPause={() => setIsPlaying(false)}
          onPlay={() => {
            setIsPlaying(true);
            setAutoplayBlocked(false);
          }}
          playsInline
          poster={shouldLoad && resolved ? resolved.poster : undefined}
          preload={shouldLoad ? "metadata" : "none"}
          ref={videoRef}
          src={shouldLoad && resolved ? resolved.src : undefined}
        />
        <div aria-hidden="true" className="video-player__shade" />
        {showPlayPrompt ? (
          <button aria-label={`Play ${title}`} className="video-player__center-play" onClick={togglePlay} type="button">
            <PlayIcon />
            <span>Play film</span>
          </button>
        ) : null}
        <div aria-label={`${title} video controls`} className="video-player__controls" role="group">
          <button
            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
            aria-pressed={isPlaying}
            className="video-player__button"
            onClick={togglePlay}
            type="button"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            aria-label={isMuted ? `Unmute ${title}` : `Mute ${title}`}
            aria-pressed={!isMuted}
            className="video-player__button"
            onClick={toggleMute}
            type="button"
          >
            {isMuted ? <MutedIcon /> : <SoundIcon />}
            <span>{isMuted ? "Sound off" : "Sound on"}</span>
          </button>
        </div>
        <span aria-live="polite" className="video-player__status">{status}</span>
      </div>
    </div>
  );
}
