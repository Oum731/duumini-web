// src/components/NotificationBubble.tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRealtime } from "../context/RealtimeContext";

export default function NotificationBubble() {
  const { lastNotification, clearNotification } = useRealtime();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Si on change de page, on peut cacher la bulle
  useEffect(() => {
    if (lastNotification?.href && pathname === lastNotification.href) {
      clearNotification();
    }
  }, [pathname, lastNotification?.href]);

  if (!lastNotification) return null;

  const { title, message, href } = lastNotification;

  function handleClick() {
    if (href) {
      // On reste dans le SPA
      if (href.startsWith("http")) {
        window.location.href = href;
      } else {
        navigate(href);
      }
    }
    clearNotification();
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    clearNotification();
  }

  return (
    <div
      className="position-fixed"
      style={{
        right: 16,
        bottom: 96, // juste au-dessus du FloatingCartButton
        zIndex: 1080,
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="btn btn-light border shadow rounded-pill d-flex align-items-center gap-2 px-3 py-2"
        style={{
          maxWidth: "280px",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          className="d-inline-flex align-items-center justify-content-center rounded-circle me-1"
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
        <span className="flex-grow-1">
          <span className="d-block fw-semibold small">
            {title || "Notification"}
          </span>
          {message && (
            <span className="d-block small text-muted text-truncate">
              {message}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleClose}
          className="btn btn-sm btn-link text-muted p-0 ms-1"
          aria-label="Fermer"
          style={{ textDecoration: "none" }}
        >
          ×
        </button>
      </button>
    </div>
  );
}
