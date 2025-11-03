// src/components/ScrollTopButton.tsx
import { useEffect, useState, useCallback } from "react";

type Props = {
  threshold?: number;        // px avant d'afficher le bouton
  offsetBottom?: number;     // px marge bas
  offsetRight?: number;      // px marge droite
  label?: string;
};

export default function ScrollTopButton({
  threshold = 400,
  offsetBottom = 24,
  offsetRight = 20,
  label = "Revenir en haut",
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) window.scrollTo(0, 0);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={label}
      title={label}
      style={{
        position: "fixed",
        right: `max(${offsetRight}px, env(safe-area-inset-right))`,
        bottom: `max(${offsetBottom}px, env(safe-area-inset-bottom))`,
        zIndex: 1050,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: `translateY(${visible ? 0 : 8}px)`,
        transition: "opacity .2s ease, transform .2s ease",
        background: "var(--duu-yellow)",
        color: "var(--duu-black)",
        border: "1px solid rgba(0,0,0,.1)",
        width: 46,
        height: 46,
        borderRadius: "50%",
        boxShadow: "0 6px 18px rgba(0,0,0,.15)",
      }}
      className="btn"
    >
      {/* Flèche simple (↑) en SVG pour rester léger */}
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
           viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
