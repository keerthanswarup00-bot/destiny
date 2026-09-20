"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

type RevealProps = {
  children?: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "figure" | "section" | "span";
};

export function Reveal({ children, className = "", delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const classes = `reveal ${className}`.trim();
  const style: CSSProperties | undefined = delay > 0 ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delay > 0) (el as HTMLElement).style.setProperty("--reveal-delay", `${delay}ms`);
            el.classList.add("is-in");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  if (as === "figure") {
    return <figure ref={ref as Ref<HTMLElement>} className={classes} style={style}>{children}</figure>;
  }
  if (as === "section") {
    return <section ref={ref as Ref<HTMLElement>} className={classes} style={style}>{children}</section>;
  }
  if (as === "span") {
    return <span ref={ref as Ref<HTMLSpanElement>} className={classes} style={style}>{children}</span>;
  }
  return <div ref={ref as Ref<HTMLDivElement>} className={classes} style={style}>{children}</div>;
}