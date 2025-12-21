// src/components/GuestOrderWidget.tsx
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "duumini:lastOrderInfo";
const MINIMIZED_KEY = "duumini:guestWidgetMinimized";

type GuestOrderStatus = "OPEN" | "PREPARATION" | "DELIVERY" | "DONE" | "CANCELLED";

type GuestOrderInfo = {
  id: number;
  code: string;
  etaStart: string;
  etaEnd: string;
  etaTarget: string;
  createdAt: string;
  deliveryMode: "EXPRESS" | "SIMPLE";
  guest: boolean;
  status?: GuestOrderStatus;
  done?: boolean;
  isDone?: boolean;
};

function formatTimeLabel(d: Date): string {
  const s = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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

export default function GuestOrderWidget({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<GuestOrderInfo | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [minimized, setMinimized] = useState(false);

  // ✅ pour éviter chevauchement avec LocationGate (bouton bas gauche)
  const [hasCityButton, setHasCityButton] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);

  const clearStorage = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(MINIMIZED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (user) {
      clearStorage();
      setInfo(null);
    }
  }, [user, clearStorage]);

  // ✅ Détecte le bouton LocationGate (sans toucher LocationGate)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      const cityBtn = document.querySelector(
        'button[aria-label="Changer ma ville de livraison"]'
      ) as HTMLButtonElement | null;

      setHasCityButton(!!cityBtn);

      // ⚠️ IMPORTANT: on ne doit pas détecter "n'importe quel .modal"
      // sinon dès qu'une autre modal apparaît → ton widget peut disparaître (ok)
      // mais surtout, si un style modal-open reste collé, ça perturbe le scroll.
      // Ici on check seulement la modal de LocationGate (elle a une backdrop + modal show)
      const hasBackdrop = !!document.querySelector(".modal-backdrop.fade.show");
      const hasModal = !!document.querySelector(".modal.fade.show");
      setIsCityModalOpen(hasBackdrop && hasModal);
    };

    check();
    const t = window.setInterval(check, 350);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function syncFromStorage() {
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

        if (!parsed?.guest) {
          setInfo(null);
          return;
        }

        const status: GuestOrderStatus | undefined =
          parsed.status || parsed.orderStatus || parsed.state;

        const doneFlag =
          parsed.done === true ||
          parsed.isDone === true ||
          status === "DONE" ||
          status === "CANCELLED";

        if (doneFlag) {
          clearStorage();
          setInfo(null);
          return;
        }

        const isMinimized = window.localStorage.getItem(MINIMIZED_KEY) === "1";

        const numericId = typeof parsed.id === "number" ? parsed.id : Number(parsed.id) || 0;
        const code =
          parsed.displayCode ||
          parsed.code ||
          (numericId ? numericId.toString(36).toUpperCase() : String(parsed.id ?? ""));

        setInfo({
          id: numericId,
          code,
          createdAt: parsed.createdAt,
          etaStart: parsed.etaStart,
          etaEnd: parsed.etaEnd,
          etaTarget: parsed.etaTarget,
          deliveryMode: parsed.deliveryMode === "EXPRESS" ? "EXPRESS" : "SIMPLE",
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

    syncFromStorage();
    const t = window.setInterval(() => {
      setNowTs(Date.now());
      syncFromStorage();
    }, 1000);

    return () => window.clearInterval(t);
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

  // ✅ empilement bas-gauche si bouton ville présent
  const minimizedBottom = hasCityButton ? "4.5rem" : "1rem";

  // ✅ overlay rendu (peut être null)
  let overlay: React.ReactNode = null;

  // ✅ si user connecté → overlay jamais affiché
  if (!user && info) {
    const etaStart = new Date(info.etaStart);
    const etaEnd = new Date(info.etaEnd);
    const etaTarget = new Date(info.etaTarget);

    const toleranceMs = 2 * 60 * 60 * 1000;
    if (nowTs - etaTarget.getTime() > toleranceMs) {
      clearStorage();
    } else {
      const intervalLabel = `${formatTimeLabel(etaStart)} - ${formatTimeLabel(etaEnd)}`;
      const countdown = formatCountdown(etaTarget);

      if (minimized) {
        if (!isCityModalOpen) {
          overlay = (
            <div
              className="position-fixed"
              style={{
                bottom: minimizedBottom,
                left: "1rem",
                zIndex: 2100,
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
      } else {
        overlay = (
          <div
            className="position-fixed"
            style={{
              bottom: "5.5rem",
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
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div
                    className="small fw-semibold text-uppercase"
                    style={{ color: "var(--duu-black)", fontSize: "0.7rem" }}
                  >
                    Suivi commande
                  </div>
                  <div className="small" style={{ color: "var(--duu-black)", opacity: 0.8 }}>
                    Commande #{info.code}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="btn btn-sm btn-outline-secondary"
                  style={{ lineHeight: 1, padding: "0.15rem 0.4rem", fontSize: "0.8rem" }}
                  aria-label="Réduire le suivi de commande"
                >
                  ⎯
                </button>
              </div>

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
    }
  }

  // ✅ IMPORTANT: on rend TOUJOURS le site + l’overlay par dessus
  return (
    <>
      {children ?? null}
      {overlay}
      <style>{`
        .btn-duu{
          background: var(--duu-yellow, #FFD54F);
          color: #1f1f1f;
          border: none;
        }
        .btn-duu:hover{ filter: brightness(0.95); }
      `}</style>
    </>
  );
}
