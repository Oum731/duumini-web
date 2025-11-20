// src/components/GuestOrderWidget.tsx
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "duumini:lastOrderInfo";
const MINIMIZED_KEY = "duumini:guestWidgetMinimized";

type GuestOrderStatus = "OPEN" | "PREPARATION" | "DELIVERY" | "DONE" | "CANCELLED";

type GuestOrderInfo = {
  id: number;
  code: string; // ✅ code alphanumérique pour l'affichage
  etaStart: string;
  etaEnd: string;
  etaTarget: string;
  createdAt: string;
  deliveryMode: "EXPRESS" | "SIMPLE";
  guest: boolean;
  status?: GuestOrderStatus; // ✅ statut optionnel de la commande
  done?: boolean;            // ✅ flags éventuels venant du front
  isDone?: boolean;
};

/* ------- Helpers format ------- */
function formatTimeLabel(d: Date): string {
  const s = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return s.replace(":", "h");
}

function formatCountdown(target: Date): string | null {
  const now = Date.now();
  const diff = target.getTime() - now;
  if (diff <= 0) return null;

  const sec = Math.floor(diff / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;

  if (m >= 1) return `${m}min ${s}s`;
  return `${s}s`;
}

export default function GuestOrderWidget() {
  const { user } = useAuth();
  const [info, setInfo] = useState<GuestOrderInfo | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [minimized, setMinimized] = useState(false);

  // 🧹 Helper global pour nettoyer les infos invité
  const clearStorage = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(MINIMIZED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // ✅ Si un utilisateur se connecte → on masque immédiatement le widget invité
  useEffect(() => {
    if (user) {
      clearStorage();
      setInfo(null);
    }
  }, [user, clearStorage]);

  // 🔁 Sync avec localStorage + tick pour le compte à rebours
  useEffect(() => {
    // En SSR ou si window n'existe pas (sécurité)
    if (typeof window === "undefined") return;

    function syncFromStorage() {
      // Si user connecté → on ne montre rien, même si des données traînent
      if (user) {
        setInfo(null);
        return;
      }

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setInfo(null);
          return;
        }

        const parsed = JSON.parse(raw);

        // pas un invité → on ignore
        if (!parsed?.guest) {
          setInfo(null);
          return;
        }

        // Essaie de récupérer un statut depuis le stockage
        const status: GuestOrderStatus | undefined =
          parsed.status || parsed.orderStatus || parsed.state;

        // ✅ Détection "commande terminée"
        const doneFlag =
          parsed.done === true ||
          parsed.isDone === true ||
          status === "DONE" ||
          status === "CANCELLED";

        // ✅ Si DONE ou CANCELLED (ou done=true) → on nettoie et on masque
        if (doneFlag) {
          clearStorage();
          setInfo(null);
          return;
        }

        const isMinimized = window.localStorage.getItem(MINIMIZED_KEY) === "1";

        const numericId =
          typeof parsed.id === "number" ? parsed.id : Number(parsed.id) || 0;
        const code =
          parsed.displayCode ||
          parsed.code ||
          (numericId
            ? numericId.toString(36).toUpperCase()
            : String(parsed.id ?? ""));

        setInfo({
          id: numericId,
          code,
          createdAt: parsed.createdAt,
          etaStart: parsed.etaStart,
          etaEnd: parsed.etaEnd,
          etaTarget: parsed.etaTarget,
          deliveryMode:
            parsed.deliveryMode === "EXPRESS" ? "EXPRESS" : "SIMPLE",
          guest: true,
          status,
          done: parsed.done === true,
          isDone: parsed.isDone === true,
        });
        setMinimized(isMinimized);
      } catch {
        setInfo(null);
      }
    }

    // Lecture initiale + boucle
    syncFromStorage();
    const t = window.setInterval(() => {
      setNowTs(Date.now());
      syncFromStorage(); // ✅ se met à jour tout seul régulièrement
    }, 1000);

    return () => {
      window.clearInterval(t);
    };
  }, [user, clearStorage]);

  const handleClosePanel = useCallback(() => {
    setMinimized(true);
    try {
      window.localStorage.setItem(MINIMIZED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const handleOpenPanel = useCallback(() => {
    setMinimized(false);
    try {
      window.localStorage.setItem(MINIMIZED_KEY, "0");
    } catch {
      /* ignore */
    }
  }, []);

  // ✅ Si user connecté → on ne rend jamais le widget
  if (user) return null;

  // Pas d'info → rien à afficher
  if (!info) return null;

  const etaStart = new Date(info.etaStart);
  const etaEnd = new Date(info.etaEnd);
  const etaTarget = new Date(info.etaTarget);

  // Fallback : si la fenêtre de livraison est largement passée → on considère que c'est "done"
  const toleranceMs = 2 * 60 * 60 * 1000; // 2h après ETA cible
  if (nowTs - etaTarget.getTime() > toleranceMs) {
    clearStorage();
    return null;
  }

  const intervalLabel = `${formatTimeLabel(etaStart)} - ${formatTimeLabel(
    etaEnd
  )}`;
  const countdown = formatCountdown(etaTarget);

  /* ========= Bouton flottant minimisé (bas gauche) ========= */
  if (minimized) {
    return (
      <div
        className="position-fixed"
        style={{
          bottom: "1rem",
          left: "1rem",
          zIndex: 2000,
        }}
      >
        <button
          type="button"
          className="btn btn-duu shadow-sm"
          style={{
            borderRadius: 999,
            fontSize: "0.85rem",
            padding: "0.45rem 0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
          onClick={handleOpenPanel}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--duu-red)",
            }}
          />
          <span>Suivre ma commande</span>
        </button>
      </div>
    );
  }

  /* ========= Panneau complet (bas droite, au-dessus du scroll/cart) ========= */
  return (
    <div
      className="position-fixed"
      style={{
        bottom: "5.5rem", // laisse la place au ScrollTop + FloatingCart (~84px)
        right: "1rem",
        zIndex: 1999,
        maxWidth: 360,
        width: "calc(100% - 2rem)",
      }}
    >
      <div
        className="shadow-lg rounded-3 p-3"
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid rgba(0,0,0,.06)",
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
        }}
      >
        {/* En-tête */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div
              className="small fw-semibold text-uppercase"
              style={{ color: "var(--duu-black)", fontSize: "0.7rem" }}
            >
              Suivi commande
            </div>
            <div
              className="small"
              style={{ color: "var(--duu-black)", opacity: 0.8 }}
            >
              Commande #{info.code}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClosePanel}
            className="btn btn-sm btn-outline-secondary"
            style={{
              lineHeight: 1,
              padding: "0.15rem 0.4rem",
              fontSize: "0.8rem",
            }}
            aria-label="Réduire le suivi de commande"
          >
            ⎯
          </button>
        </div>

        {/* Contenu */}
        <div className="small mb-1" style={{ color: "var(--duu-black)" }}>
          Livraison estimée{" "}
          <strong style={{ color: "var(--duu-red)" }}>{intervalLabel}</strong>{" "}
          {info.deliveryMode === "EXPRESS" ? "(Express)" : ""}.
        </div>

        {countdown && (
          <div className="small">
            Arrivée estimée dans{" "}
            <strong style={{ color: "var(--duu-red)" }}>{countdown}</strong>.
          </div>
        )}

        <div className="small text-muted mt-2">
          Vous pouvez continuer à naviguer, nous gardons cet aperçu pour vous.
        </div>
      </div>
    </div>
  );
}
