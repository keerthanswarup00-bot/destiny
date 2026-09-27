"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ReelPlayer } from "@/components/public/reel-player";
import { SITE_REELS, type SiteReel } from "@/lib/site/reels";

/** Above this width the section is an editorial 3-up; below it is a Reel stack. */
const DESKTOP_QUERY = "(min-width: 900px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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

type ReelScrollSectionProps = {
  reels?: SiteReel[];
};

/**
 * "Stories in motion".
 *
 * From 900px the Reels are an editorial three-up with the middle one active, and
 * this component owns that choice. Below 900px each Reel is a full-width section
 * in the page's own scroll, so the section hands down no choice at all and
 * ReelPlayer decides on its own. Either way the same components, the same
 * sources and the same controls are used.
 */
export function ReelScrollSection({ reels = SITE_REELS }: ReelScrollSectionProps) {
  const total = reels.length;
  const trackRef = useRef<HTMLDivElement>(null);

  const isDesktop = useSyncExternalStore(subscribeTo(DESKTOP_QUERY), isDesktopSnapshot, isDesktopServerSnapshot);
  const reducedMotion = useSyncExternalStore(subscribeTo(REDUCED_MOTION_QUERY), reducedMotionSnapshot, reducedMotionServerSnapshot);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Nothing is chosen until the visitor picks a Reel; until then the layout
  // decides the opening Reel - the middle one on desktop, the first on mobile.
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [isSectionNear, setIsSectionNear] = useState(false);

  const activeIndex = chosenIndex ?? (isDesktop ? Math.min(1, total - 1) : 0);

  // Hold the three-up back until the visitor has scrolled to it, so a long page
  // never pulls tens of megabytes of films nobody has reached.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !isDesktop || typeof IntersectionObserver === "undefined") return;
    // The observer's first callback reports where the track was at mount, which
    // is off-screen on a page this long, so it must not be read as the visitor
    // having scrolled away. Only pause once the track has been seen.
    let hasBeenVisible = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasBeenVisible = true;
          setIsSectionNear(true);
          return;
        }
        if (!hasBeenVisible) return;
        setIsSectionNear(false);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, [isDesktop]);

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
        {/* isActive only drives the three-up's chosen Reel; below 900px each
            ReelPlayer decides for itself and the flag is ignored by the CSS. */}
        {reels.map((reel, index) => (
          <ReelPlayer
            index={index}
            isActive={index === activeIndex}
            isDesktop={isDesktop}
            isSectionNear={isSectionNear}
            key={reel.id}
            mounted={mounted}
            onActivate={() => activate(index)}
            reducedMotion={reducedMotion}
            reel={reel}
            total={total}
          />
        ))}
      </div>

      <p aria-hidden="true" className="reels__counter">
        <span>{counter}</span> / {String(total).padStart(2, "0")}
      </p>
    </section>
  );
}
