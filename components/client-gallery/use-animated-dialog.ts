"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 200;

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Smooth open/close for native `<dialog>` modals.
 *
 * - Opening calls `showModal()`.
 * - Closing keeps the dialog mounted while a `.is-closing` class drives the
 *   exit transition, then calls `close()`.
 * - Escape (`cancel`) is intercepted so the modal animates out instead of
 *   disappearing instantly; the browser's native close event still notifies the
 *   parent via `onClose`.
 * - `prefers-reduced-motion` falls back to an instant close.
 *
 * The parent owns the `open` boolean and must call `onClose` whenever the dialog
 * asks to close (Escape, backdrop/cancel, or an explicit close action).
 */
export function useAnimatedDialog({
  open,
  onClose,
  durationMs = DEFAULT_DURATION_MS,
}: {
  open: boolean;
  onClose: () => void;
  durationMs?: number;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const reduceRef = useRef(false);
  const durationRef = useRef(durationMs);

  useEffect(() => {
    reduceRef.current = reducedMotion();
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open) {
      closingRef.current = false;
      // Reopening while an exit is in flight: drop the exit class so the
      // dialog enters visibly again (intentional imperative dialog sync).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClosing(false);
      if (!node.open) node.showModal();
      return;
    }
    if (!node.open || closingRef.current) return;
    closingRef.current = true;
    if (reduceRef.current) {
      node.close();
      closingRef.current = false;
      return;
    }
    setClosing(true);
    const timer = setTimeout(() => {
      if (node.open) node.close();
    }, Math.max(0, durationRef.current));
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handleCancel = (event: Event) => {
      // Keep the dialog visible so it can animate out; the parent flips `open`.
      event.preventDefault();
      onClose();
    };
    const handleClose = () => {
      closingRef.current = false;
      setClosing(false);
      onClose();
    };
    node.addEventListener("cancel", handleCancel);
    node.addEventListener("close", handleClose);
    return () => {
      node.removeEventListener("cancel", handleCancel);
      node.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  return { dialogRef, closing };
}