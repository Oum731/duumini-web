// src/components/GuestOrderWidget.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { mad } from "../store/cart";

const STORAGE_KEY = "duumini:lastOrderInfo";
const MINIMIZED_KEY = "duumini:guestWidgetMinimized";

type GuestOrderStatus = "OPEN" | "PREPARATION" | "DELIVERY" | "DONE" | "CANCELLED";
type DeliveryMode = "CASABLANCA" | "CITY";

type GuestOrderInfo = {
  id: number | string;
  code: string;

  etaStart?: string | null;
  etaEnd?: string | null;
  etaTarget?: string | null;

  createdAt?: string | null;
  deliveryMode?: DeliveryMode;

  guest: boolean;

  city?: string | null;
  currency?: string | null;
  total?: number | null;

  status?: GuestOrderStatus;
  done?: boolean;
  isDone?: boolean;
};

function formatTimeLabel(d: Date): string {
  const s = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return s.replace(":", "h");
}

function clampToDeliveryHours(d: Date): { inHours: boolean; nextSlot?: Date } {
  // Horaires : 09h00 - 20h00
  const startH = 9;
  const endH = 20;

  const x = new Date(d);
  const h = x.getHours();
  const m = x.getMinutes();

  const afterStart = h > startH || (h === startH && m >= 0);
  const beforeEnd = h < endH || (h === endH && m <= 0);
  const inHours = afterStart && beforeEnd;

  if (inHours) return { inHours: true };

  const next = new Date(x);
  if (h < startH) {
    next.setHours(startH, 0, 0, 0);
    return { inHours: false, nextSlot: next };
  }

  // après 20h → lendemain 09h
  next.setDate(next.getDate() + 1);
  next.setHours(startH, 0, 0, 0);
  return { inHours: false, nextSlot: next };
}

function formatCountdown(target: Date): string | null {
  const now = Date.now();
  const diff = target.getTime() - now;
  if (diff <= 0) return null;

  const sec = Math.floor(diff / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m >= 1) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function deliveryLabel(mode?: DeliveryMode) {
  if (mode === "CASABLANCA") return "Casablanca (25 DH)";
  if (mode === "CITY") return "Hors Casablanca (dès 60 DH)";
  return "Livraison";
}

function safeUpper(x: any) {
  return String(x ?? "").trim().toUpperCase();
}

function inferDeliveryMode(raw: any): DeliveryMode {
  const s = safeUpper(raw);
  return s.includes("CASA") ? "CASABLANCA" : "CITY";
}

export default function GuestOrderWidget({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();

  const [info, setInfo] = useState<GuestOrderInfo | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [minimized, setMinimized] = useState(false);

  // ✅ pour éviter chevauchement avec LocationGate (bouton bas gauche)
  const [hasCityButton, setHasCityButton] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);

  const clearStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(MINIMIZED_KEY);
    } catch {
      // ignore
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

        const isMin = window.localStorage.getItem(MINIMIZED_KEY) === "1";

        const numericId = typeof parsed.id === "number" ? parsed.id : Number(parsed.id) || 0;
        const code =
          parsed.displayCode ||
          parsed.code ||
          (numericId ? numericId.toString(36).toUpperCase() : String(parsed.id ?? ""));

        const deliveryMode: DeliveryMode = inferDeliveryMode(parsed.deliveryMode);

        const currency = parsed.currency ? String(parsed.currency).toUpperCase() : "MAD";
        const total = parsed.total != null ? Number(parsed.total) : null;

        setInfo({
          id: parsed.id ?? numericId,
          code,

          createdAt: parsed.createdAt || null,
          etaStart: parsed.etaStart || null,
          etaEnd: parsed.etaEnd || null,
          etaTarget: parsed.etaTarget || null,

          deliveryMode,
          guest: true,

          status,
          done: parsed.done === true,
          isDone: parsed.isDone === true,

          city: parsed.city ?? null,
          total: Number.isFinite(total as any) ? (total as number) : null,
          currency,
        });

        setMinimized(isMin);
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
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MINIMIZED_KEY, "1");
    } catch {}
  }, []);

  const handleOpenPanel = useCallback(() => {
    setMinimized(false);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MINIMIZED_KEY, "0");
    } catch {}
  }, []);

  const minimizedBottom = hasCityButton ? "4.5rem" : "1rem";

  // ✅ Message livraison précis (09h → 20h) + countdown
  const deliveryMessage = useMemo(() => {
    if (!info) return null;

    const start = info.etaStart ? new Date(info.etaStart) : null;
    const end = info.etaEnd ? new Date(info.etaEnd) : null;
    const target = info.etaTarget ? new Date(info.etaTarget) : null;

    const hoursText = "Nous livrons uniquement entre 09h et 20h.";

    const countdown =
      target && !isNaN(target.getTime()) ? formatCountdown(target) : null;

    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        title: "Livraison en cours de traitement",
        subtitle: hoursText,
        intervalLabel: null as string | null,
        countdown,
        note: "Votre commande est confirmée. Nous vous appelons si besoin.",
      };
    }

    const c1 = clampToDeliveryHours(start);
    const c2 = clampToDeliveryHours(end);
    const baseInterval = `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;

    if (!c1.inHours || !c2.inHours) {
      const nextSlot = c1.nextSlot || c2.nextSlot || null;
      const nextLabel = nextSlot ? formatTimeLabel(nextSlot) : "09h00";

      return {
        title: "Livraison programmée",
        subtitle: hoursText,
        intervalLabel: baseInterval,
        countdown,
        note: `La plage estimée dépasse nos horaires. Livraison au prochain créneau (à partir de ${nextLabel}).`,
      };
    }

    return {
      title: "Livraison estimée",
      subtitle: hoursText,
      intervalLabel: baseInterval,
      countdown,
      note: null as string | null,
    };
  }, [info, nowTs]);

  // ✅ overlay rendu (peut être null)
  let overlay: React.ReactNode = null;

  if (!user && info) {
    const target = info.etaTarget ? new Date(info.etaTarget) : null;

    // ✅ auto-clean si widget trop vieux
    if (target && !isNaN(target.getTime())) {
      const toleranceMs = 2 * 60 * 60 * 1000;
      if (nowTs - target.getTime() > toleranceMs) clearStorage();
    }

    const dlvLabel = deliveryLabel(info.deliveryMode);

    if (minimized) {
      if (!isCityModalOpen) {
        overlay = (
          <div
            className="position-fixed"
            style={{ bottom: minimizedBottom, left: "1rem", zIndex: 2100 }}
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
                gap: "0.45rem",
              }}
              onClick={handleOpenPanel}
              aria-label="Ouvrir le suivi de commande"
            >
              <span
                aria-hidden="true"
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
            maxWidth: 380,
            width: "calc(100% - 2rem)",
          }}
        >
          <div
            className="shadow-lg p-3"
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            }}
          >
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div style={{ minWidth: 0 }}>
                <div
                  className="small fw-semibold text-uppercase"
                  style={{ color: "var(--duu-black)", fontSize: "0.7rem", letterSpacing: 0.6 }}
                >
                  Suivi commande
                </div>
                <div className="small" style={{ color: "var(--duu-black)", opacity: 0.9 }}>
                  Commande <strong>#{info.code}</strong>
                  <span className="text-muted"> • {dlvLabel}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClosePanel}
                className="btn btn-sm btn-outline-secondary"
                style={{ lineHeight: 1, padding: "0.15rem 0.45rem", fontSize: "0.85rem" }}
                aria-label="Réduire le suivi de commande"
                title="Réduire"
              >
                ⎯
              </button>
            </div>

            {deliveryMessage && (
              <div className="small mb-2" style={{ color: "var(--duu-black)" }}>
                <div className="fw-semibold">{deliveryMessage.title}</div>

                {deliveryMessage.intervalLabel && (
                  <div className="mt-1">
                    Plage estimée :{" "}
                    <strong style={{ color: "var(--duu-red)" }}>
                      {deliveryMessage.intervalLabel}
                    </strong>
                  </div>
                )}

                <div className="text-muted mt-1">{deliveryMessage.subtitle}</div>

                {deliveryMessage.note && (
                  <div className="alert alert-warning py-2 px-2 mt-2 mb-0 small">
                    {deliveryMessage.note}
                  </div>
                )}
              </div>
            )}

            {deliveryMessage?.countdown && (
              <div className="small">
                Arrivée estimée dans{" "}
                <strong style={{ color: "var(--duu-red)" }}>
                  {deliveryMessage.countdown}
                </strong>
                .
              </div>
            )}

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
              <div className="small text-muted">{info.city ? `Ville: ${info.city}` : "Ville: —"}</div>

              {info.total != null && (
                <div className="small">
                  Total: <strong>{mad(info.total)}</strong>{" "}
                  <span className="text-muted">{info.currency || "MAD"}</span>
                </div>
              )}
            </div>

            <div className="small text-muted mt-2">
              Vous pouvez continuer à naviguer, nous gardons cet aperçu pour vous.
            </div>
          </div>
        </div>
      );
    }
  }

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