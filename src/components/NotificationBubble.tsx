import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRealtime } from "../context/RealtimeContext";

const AUTO_HIDE_MS = 7000; // ⏱️ 7 secondes

export default function NotificationBubble() {
  const { lastNotification, clearNotification } = useRealtime();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Si on change de page vers la cible → on ferme
  useEffect(() => {
    if (lastNotification?.href && pathname === lastNotification.href) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, lastNotification?.href]);

  // Apparition + auto-hide
  useEffect(() => {
    if (!lastNotification) return;

    setVisible(true);
    startAutoHide();

    return stopAutoHide;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNotification]);

  if (!lastNotification) return null;

  const { title, message, href } = lastNotification;

  function startAutoHide() {
    stopAutoHide();
    timerRef.current = window.setTimeout(() => {
      close();
    }, AUTO_HIDE_MS);
  }

  function stopAutoHide() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function close() {
    setVisible(false);
    setTimeout(clearNotification, 220); // ⏱️ laisse finir l’animation
  }

  function handleClick() {
    if (href) {
      if (href.startsWith("http")) {
        window.location.href = href;
      } else {
        navigate(href);
      }
    }
    close();
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    close();
  }

  return (
    <div
      className="position-fixed"
      style={{
        right: 16,
        bottom: 96,
        zIndex: 1080,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={stopAutoHide} // ⏸️ pause auto-hide
        onMouseLeave={startAutoHide}
        className="btn btn-light border shadow d-flex align-items-start gap-2 px-3 py-2"
        style={{
          maxWidth: 300,
          textAlign: "left",
          cursor: "pointer",

          /* anti-débordement */
          whiteSpace: "normal",
          wordBreak: "break-word",
          overflowWrap: "anywhere",

          /* 🎬 animation */
          opacity: visible ? 1 : 0,
          transform: visible
            ? "translateY(0) scale(1)"
            : "translateY(12px) scale(0.96)",
          transition: "opacity .22s ease, transform .22s ease",
        }}
      >
        {/* Icône */}
        <span
          className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          style={{
            width: 28,
            height: 28,
            backgroundColor: "var(--duu-yellow, #ffc107)",
            color: "#000",
            fontSize: 16,
          }}
        >
          🔔
        </span>

        {/* Texte */}
        <span className="flex-grow-1" style={{ minWidth: 0 }}>
          <span
            className="d-block fw-semibold small"
            style={{
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}
          >
            {title || "Notification"}
          </span>

          {message && (
            <span
              className="d-block small text-muted"
              style={{
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",

                /* limite à 3 lignes */
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {message}
            </span>
          )}
        </span>

        {/* Fermer */}
        <button
          type="button"
          onClick={handleClose}
          className="btn btn-sm btn-link text-muted p-0 ms-1 flex-shrink-0"
          aria-label="Fermer"
          style={{
            textDecoration: "none",
            lineHeight: 1,
            fontSize: 18,
          }}
        >
          ×
        </button>
      </button>
    </div>
  );
}
