import { useEffect, useMemo, useState } from "react";
import { api } from "../services/http";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { getPromoMeta, isRealPromo } from "../lib/promotions";

/* =========================
   CONFIG CAN
   ========================= */
const PROMO_END_ISO = "2026-01-22T23:59:59+01:00";

function useBlink(ms = 650) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setInterval(() => setOn((v) => !v), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return on;
}

function useCountdown(endIso: string) {
  const end = useMemo(() => new Date(endIso).getTime(), [endIso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const diff = Math.max(0, end - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return { diff, days, hours, mins, secs, isOver: diff <= 0 };
}

function isFood(p: any) {
  return String(p?.sub_category || p?.category || "").toLowerCase() === "food";
}

/** OFFRE CAN = produits en promo (hors food + hors boissons) */
function isCanProductOffer(p: any) {
  if (Number(p?.promo_can ?? 0) === 1) return true;

  if (isFood(p)) return false;

  const name = String(p?.name || "").toLowerCase();
  const cat = String(p?.category_name || p?.category || "").toLowerCase();

  const looksLikeDrink =
    cat.includes("boisson") ||
    cat.includes("boissons") ||
    cat.includes("soda") ||
    cat.includes("jus") ||
    cat.includes("eau") ||
    name.includes("boisson") ||
    name.includes("boissons") ||
    name.includes("canette") ||
    name.includes("cannette") ||
    name.includes("soda") ||
    name.includes("cola") ||
    name.includes("jus") ||
    name.includes("eau") ||
    name.includes("energy");

  return !looksLikeDrink;
}

export default function PromotionsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const blink = useBlink(650);
  const cd = useCountdown(PROMO_END_ISO);

  const urgency = useMemo(() => {
    if (cd.isOver) return "OVER" as const;
    if (cd.days <= 0) return "D1" as const;
    if (cd.days <= 7) return "SOON" as const;
    return "NORMAL" as const;
  }, [cd.days, cd.isOver]);

  const pulseClass =
    urgency === "D1" ? "pulse-d1" : urgency === "SOON" ? "pulse-soon" : "pulse-normal";

  const timeStr = `${String(cd.hours).padStart(2, "0")}:${String(cd.mins).padStart(
    2,
    "0"
  )}:${String(cd.secs).padStart(2, "0")}`;

  async function fetchPromos() {
    setLoading(true);
    setErr(null);
    try {
      try {
        const res = await api.get<Product[]>("/api/products/promotions", {
          query: { limit: 250, onlyActive: 1 },
        });
        setItems((res || []).filter(isRealPromo));
        return;
      } catch {}

      const res = await api.get<{ items: Product[] }>("/api/products", {
        query: { page: 1, pageSize: 250, onlyActive: 1 },
      });
      setItems((res.items || []).filter(isRealPromo));
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPromos();
  }, []);

  // tri: meilleures promos d'abord (score %)
  const canItems = useMemo(() => {
    const list = items.filter((p: any) => isCanProductOffer(p));

    return list
      .map((p: any) => {
        const promo = getPromoMeta(p);
        const type = String(p?.promo_discount_type || "PERCENT").toUpperCase();
        const value = Number(p?.promo_discount_value ?? 0);
        const price = Number(p?.price ?? 0);

        let score = 0;
        if (promo) {
          score =
            type === "PERCENT"
              ? value
              : price > 0
              ? (value / price) * 100
              : 0;
        }
        return { p, promo, score };
      })
      .filter((x) => !!x.promo)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [items]);

  return (
    <div className="container-xxl py-4">
      <style>{`
        .duu-zone{
          position: relative;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 20px;
          padding: 16px;
          overflow: hidden;
          background:
            radial-gradient(900px 260px at 0% 0%, rgba(255,213,79,.32), transparent 60%),
            radial-gradient(900px 260px at 100% 20%, rgba(229,57,53,.12), transparent 55%),
            linear-gradient(180deg, rgba(0,0,0,.02), transparent);
        }

        .duu-strip{
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .duu-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,.95);
          box-shadow: 0 0 0 3px rgba(229,57,53,.18);
        }
        .duu-dot.blink{ animation: duuBlink .7s infinite; }
        @keyframes duuBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .25; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }

        .duu-tag{
          background: linear-gradient(90deg, rgba(229,57,53,1), rgba(255,213,79,1));
          color:#111;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 980;
          font-size: .82rem;
          border: 1px solid rgba(0,0,0,.12);
        }

        .duu-h1{
          margin: 10px 0 4px 0;
          font-weight: 980;
          line-height: 1.12;
          letter-spacing: .2px;
        }
        .duu-sub{
          color: rgba(0,0,0,.62);
          font-weight: 780;
          font-size: .95rem;
        }

        .duu-meta{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top: 10px;
        }

        .duu-badge{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:6px 10px;
          border-radius:999px;
          font-weight: 900;
          font-size: .82rem;
          background: rgba(255,255,255,.86);
          border: 1px solid rgba(0,0,0,.10);
          color: rgba(0,0,0,.78);
        }

        .duu-badge-strong{
          background: var(--duu-yellow, #FFD54F);
          color:#111;
          border: 1px solid rgba(0,0,0,.12);
          will-change: transform;
        }

        @keyframes duuPulseNormal {
          0% { transform: scale(1); box-shadow: 0 .35rem .9rem rgba(255,213,79,.30); }
          50% { transform: scale(1.02); box-shadow: 0 .55rem 1.15rem rgba(255,213,79,.45); }
          100% { transform: scale(1); box-shadow: 0 .35rem .9rem rgba(255,213,79,.30); }
        }
        .pulse-normal{ animation: duuPulseNormal 1.25s ease-in-out infinite; }

        @keyframes duuPulseSoon {
          0% { transform: scale(1); box-shadow: 0 .45rem 1.05rem rgba(255,213,79,.42); }
          50% { transform: scale(1.04); box-shadow: 0 .75rem 1.55rem rgba(255,213,79,.65); }
          100% { transform: scale(1); box-shadow: 0 .45rem 1.05rem rgba(255,213,79,.42); }
        }
        .pulse-soon{ animation: duuPulseSoon 1.05s ease-in-out infinite; }

        @keyframes duuPulseD1 {
          0% { transform: scale(1); box-shadow: 0 .55rem 1.25rem rgba(255,213,79,.55); }
          50% { transform: scale(1.06); box-shadow: 0 1rem 2rem rgba(255,213,79,.85); }
          100% { transform: scale(1); box-shadow: 0 .55rem 1.25rem rgba(255,213,79,.55); }
        }
        .pulse-d1{ animation: duuPulseD1 .78s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce){
          .pulse-normal, .pulse-soon, .pulse-d1{ animation: none; }
        }

        .duu-note{
          margin-top: 8px;
          color: rgba(0,0,0,.56);
          font-size: .90rem;
          font-weight: 700;
        }

        @media (max-width: 576px){
          .duu-zone{ padding: 14px; border-radius: 18px; }
          .duu-h1{ font-size: 1.12rem; }
          .duu-sub{ font-size: .90rem; }
          .duu-badge{ font-size: .78rem; }
        }
      `}</style>

      <div className="duu-zone mb-3">
        <div className="d-flex flex-column flex-sm-row align-items-sm-start justify-content-between gap-2">
          <div style={{ minWidth: 0 }}>
            <div className="duu-strip">
              <span className={`duu-dot ${blink ? "blink" : ""}`} />
              <span className="duu-tag">ZONE CAN 2025</span>
            </div>

            {/* Texte différent du carousel + très court */}
            <h1 className="duu-h1">⚽ Promos CAN — Coupe d’Afrique</h1>
            <div className="duu-sub">Top remises • Produits (hors boissons)</div>

            <div className="duu-meta">
              <span className={`duu-badge duu-badge-strong ${pulseClass}`}>
                ⏳ {cd.isOver ? "Terminé" : `Reste ${cd.days}j ${timeStr}`}
              </span>
              <span className="duu-badge">🏟️ Supporters</span>
              <span className="duu-badge">🚚 Livraison offerte*</span>
            </div>

            <div className="duu-note">
              {cd.isOver ? "CAN terminée." : <>Fin <b>22 janvier</b> • *sur produits éligibles</>}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-dark"
            onClick={fetchPromos}
            disabled={loading}
            title="Actualiser"
          >
            {loading ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}

      {loading ? (
        <div className="text-muted">Chargement…</div>
      ) : canItems.length === 0 ? (
        <div className="text-muted">Aucune promo CAN disponible.</div>
      ) : (
        <div className="row g-3">
          {canItems.map((p: any) => {
            const promo = getPromoMeta(p);
            if (!promo) return null;

            return (
              <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={p.id}>
                <ProductCard
                  product={p}
                  priceOverride={promo.promoPrice}
                  oldPrice={promo.oldPrice}
                  badgeText={`🏟️ Supporters • CAN ${promo.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
