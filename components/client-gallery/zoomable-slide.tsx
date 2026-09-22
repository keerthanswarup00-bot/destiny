"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ImageSlide,
  useController,
  useLightboxProps,
  useLightboxState,
  type Slide,
} from "yet-another-react-lightbox";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_DELAY = 300;
const DOUBLE_TAP_MAX_DISTANCE = 40;
const SETTLE_MS = 220;
const WHEEL_ZOOM_FACTOR = 1.002;

type Rect = { width: number; height: number };
type PointerSnapshot = { pointerId: number; clientX: number; clientY: number; blocked: boolean };
type PinchState = { initialDistance: number; initialZoom: number };

function clampSigned(value: number, bound: number) {
  return bound > 0 ? Math.min(Math.abs(value), bound) * Math.sign(value) : 0;
}

export function ClientZoomableSlide({
  slide,
  rect,
  slideOffset = 0,
}: {
  slide: Slide;
  rect: Rect;
  slideOffset?: number;
}) {
  const { render, carousel, on } = useLightboxProps();
  const { currentIndex } = useLightboxState();
  const { containerRef } = useController();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef(rect);

  const imageSizeRef = useRef({ width: 0, height: 0 });
  const pointersRef = useRef<PointerSnapshot[]>([]);
  const pinchRef = useRef<PinchState | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const settlingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchZoomHandledRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    const node = wrapperRef.current;
    if (node) {
      node.style.transform = `scale(${zoomRef.current}) translate(${offsetRef.current.x}px, ${offsetRef.current.y}px)`;
    }
  }, []);

  const commit = useCallback(
    (nextZoom: number, nextOffset: { x: number; y: number }) => {
      zoomRef.current = nextZoom;
      offsetRef.current = nextOffset;
      setZoom(nextZoom);
      setOffset(nextOffset);
      applyTransform();
    },
    [applyTransform],
  );

  const clampOffsets = useCallback((deltaX: number, deltaY: number, zoomLevel: number) => {
    const sliderRect = rectRef.current;
    const imageSize = imageSizeRef.current;
    const current = offsetRef.current;
    const maxX = Math.max((imageSize.width * zoomLevel - sliderRect.width) / 2 / zoomLevel, 0);
    const maxY = Math.max((imageSize.height * zoomLevel - sliderRect.height) / 2 / zoomLevel, 0);
    return { x: clampSigned(current.x - deltaX, maxX), y: clampSigned(current.y - deltaY, maxY) };
  }, []);

  const containerCenter = useCallback(
    (clientX?: number, clientY?: number): [number, number] => {
      const container = containerRef.current;
      if (!container) return [0, 0];
      const bounds = container.getBoundingClientRect();
      const x = (clientX ?? bounds.left + bounds.width / 2) - bounds.left - bounds.width / 2;
      const y = (clientY ?? bounds.top + bounds.height / 2) - bounds.top - bounds.height / 2;
      return [x, y];
    },
    [containerRef],
  );

  const settle = useCallback(() => {
    setSettling(true);
    if (settlingTimerRef.current) clearTimeout(settlingTimerRef.current);
    settlingTimerRef.current = setTimeout(() => setSettling(false), SETTLE_MS);
  }, []);

  const applyZoomChange = useCallback(
    (targetZoom: number, anchorX?: number, anchorY?: number) => {
      const currentZoom = zoomRef.current;
      const nextZoom = Math.min(Math.max(targetZoom, MIN_ZOOM), MAX_ZOOM);
      const deltaX = (anchorX ?? 0) * (1 / currentZoom - 1 / nextZoom);
      const deltaY = (anchorY ?? 0) * (1 / currentZoom - 1 / nextZoom);
      commit(nextZoom, clampOffsets(deltaX, deltaY, nextZoom));
    },
    [commit, clampOffsets],
  );

  const applyPan = useCallback(
    (deltaX: number, deltaY: number) => {
      const currentZoom = zoomRef.current;
      commit(currentZoom, clampOffsets(deltaX, deltaY, currentZoom));
    },
    [commit, clampOffsets],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (slideOffset !== 0) return;
      if (event.pointerType === "mouse" && event.buttons > 1) return;
      const pointers = pointersRef.current;
      const { timeStamp } = event;
      const isTouch = event.pointerType !== "mouse";
      let blocked = isTouch && pointers.length > 0;

      if (isTouch && pointers.length === 0) {
        const lastTap = lastTapRef.current;
        if (
          lastTap &&
          timeStamp - lastTap.time <= DOUBLE_TAP_DELAY &&
          Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= DOUBLE_TAP_MAX_DISTANCE
        ) {
          lastTapRef.current = null;
          const nextZoom = zoomRef.current > 1.01 ? 1 : DOUBLE_TAP_ZOOM;
          const [anchorX, anchorY] = containerCenter(event.clientX, event.clientY);
          applyZoomChange(nextZoom, anchorX, anchorY);
          touchZoomHandledRef.current = true;
          settle();
          blocked = true;
        } else {
          lastTapRef.current = { time: timeStamp, x: event.clientX, y: event.clientY };
        }
      }

      if (!blocked && zoomRef.current > 1) blocked = true;

      pointersRef.current = [
        ...pointers,
        { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, blocked },
      ];
      if (blocked) event.stopPropagation();

      if (pointersRef.current.length === 2) {
        const [p0, p1] = pointersRef.current;
        pinchRef.current = {
          initialDistance: Math.max(Math.hypot(p0.clientX - p1.clientX, p0.clientY - p1.clientY), 1),
          initialZoom: zoomRef.current,
        };
      }
    },
    [applyZoomChange, containerCenter, settle, slideOffset],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointers = pointersRef.current;
      const index = pointers.findIndex(p => p.pointerId === event.pointerId);
      if (index === -1) return;
      const active = pointers[index];

      if (pointers.length >= 2) event.stopPropagation();

      if (pointers.length === 2 && pinchRef.current) {
        const updated = pointers.map((p, i) =>
          i === index ? { ...p, clientX: event.clientX, clientY: event.clientY } : p,
        );
        pointersRef.current = updated;
        const [p0, p1] = updated;
        const currentDistance = Math.max(Math.hypot(p0.clientX - p1.clientX, p0.clientY - p1.clientY), 1);
        const targetZoom = (pinchRef.current.initialZoom / pinchRef.current.initialDistance) * currentDistance;
        const [anchorX, anchorY] = containerCenter((p0.clientX + p1.clientX) / 2, (p0.clientY + p1.clientY) / 2);
        applyZoomChange(targetZoom, anchorX, anchorY);
        return;
      }

      if (pointers.length === 1 && zoomRef.current > 1) {
        event.stopPropagation();
        const deltaX = (active.clientX - event.clientX) / zoomRef.current;
        const deltaY = (active.clientY - event.clientY) / zoomRef.current;
        pointersRef.current = [{ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, blocked: active.blocked }];
        applyPan(deltaX, deltaY);
      }
    },
    [applyPan, applyZoomChange, containerCenter],
  );

  const releasePointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    const index = pointers.findIndex(p => p.pointerId === event.pointerId);
    if (index === -1) return;
    const target = pointers[index];
    if (target.blocked) event.stopPropagation();
    const next = pointers.filter((_, i) => i !== index);
    pointersRef.current = next;
    if (next.length < 2) pinchRef.current = null;
  }, []);

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (slideOffset !== 0) return;
      if (touchZoomHandledRef.current) {
        touchZoomHandledRef.current = false;
        return;
      }
      const nextZoom = zoomRef.current > 1.01 ? 1 : DOUBLE_TAP_ZOOM;
      const [anchorX, anchorY] = containerCenter(event.clientX, event.clientY);
      applyZoomChange(nextZoom, anchorX, anchorY);
      settle();
    },
    [applyZoomChange, containerCenter, settle, slideOffset],
  );

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const img = wrapper.querySelector("img");
    if (!(img instanceof HTMLImageElement)) return;
    const measure = () => {
      const width = img.clientWidth;
      const height = img.clientHeight;
      if (width > 0 || height > 0) imageSizeRef.current = { width, height };
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => observer.disconnect();
  }, [rect.width, rect.height]);

  useLayoutEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  useLayoutEffect(() => {
    applyPan(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect.width, rect.height]);

  useLayoutEffect(() => {
    if (slideOffset !== 0 && zoomRef.current > 1) {
      commit(1, { x: 0, y: 0 });
    }
  }, [slideOffset, commit]);

  useLayoutEffect(() => {
    applyTransform();
  }, [applyTransform, zoom, offset]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (slideOffset !== 0) return;
      if (event.ctrlKey || event.metaKey || zoomRef.current > 1) {
        event.preventDefault();
        event.stopPropagation();
        const targetZoom = zoomRef.current * Math.pow(WHEEL_ZOOM_FACTOR, -event.deltaY);
        const [anchorX, anchorY] = containerCenter(event.clientX, event.clientY);
        applyZoomChange(targetZoom, anchorX, anchorY);
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [applyZoomChange, containerCenter, slideOffset]);

  useEffect(
    () => () => {
      if (settlingTimerRef.current) clearTimeout(settlingTimerRef.current);
    },
    [],
  );

  return (
    <div
      className={`client-zoomable-slide${zoom > 1 ? " is-zoomed" : ""}${settling ? " is-settling" : ""}`}
      onDoubleClick={onDoubleClick}
      onPointerCancel={releasePointer}
      onPointerDown={onPointerDown}
      onPointerLeave={releasePointer}
      onPointerMove={onPointerMove}
      onPointerUp={releasePointer}
      ref={wrapperRef}
      style={{ touchAction: slideOffset === 0 ? "none" : undefined }}
    >
      <ImageSlide
        imageFit={carousel.imageFit}
        imageProps={carousel.imageProps}
        offset={slideOffset}
        onClick={() => on.click?.({ index: currentIndex })}
        rect={rect}
        render={render}
        slide={slide}
      />
    </div>
  );
}