import { useEffect, useMemo, useState } from "react";
import { api } from "../services/http";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { getPromoMeta, isRealPromo } from "../lib/promotions";
import CanKickLottie from "../components/CanKickLottie";

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

  const timeStr = `${String(cd.hours).padStart(2, "0")}:${String(cd.mins).padStart(2, "0")}:${String(
    cd.secs
  ).padStart(2, "0")}`;

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

  const canItems = useMemo(() => {
    const list = items.filter((p: any) => isCanProductOffer(p));
    // ✅ tri auto : plus grosse remise d’abord
    return [...list].sort((a: any, b: any) => {
      const av = Number(a?.promo_discount_value ?? 0);
      const bv = Number(b?.promo_discount_value ?? 0);
      return bv - av;
    });
  }, [items]);

  return (
    <div className="container-xxl py-4">
      <style>{`
        .can-hero{
          position: relative;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 22px;
          padding: 16px;
          overflow: hidden;
          background:
            radial-gradient(1200px 380px at 12% 0%, rgba(255,213,79,.45), transparent 62%),
            radial-gradient(1000px 320px at 90% 15%, rgba(229,57,53,.20), transparent 60%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
        }
        .can-hero:before{
          content:"";
          position:absolute; inset:0;
          background:
            linear-gradient(135deg, rgba(229,57,53,.08) 0%, transparent 42%),
            repeating-linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.04) 1px, transparent 1px, transparent 18px);
          opacity:.55;
          pointer-events:none;
        }
        .can-chip{
          display:inline-flex; align-items:center; gap:10px;
          padding:8px 12px; border-radius:999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.72);
          font-weight:980; flex-wrap:wrap;
          position: relative;
        }
        .can-dot{ width:10px;height:10px;border-radius:50%; background: rgba(229,57,53,.95); box-shadow: 0 0 0 3px rgba(229,57,53,.20); }
        .can-dot.blink{ animation: canBlink .7s infinite; }
        @keyframes canBlink{ 0%{opacity:1} 50%{opacity:.25; transform:scale(.75)} 100%{opacity:1} }

        .can-pill{
          background: var(--duu-red, #E53935); color:#fff;
          padding:2px 10px; border-radius:999px;
          font-size:.80rem; font-weight:980; letter-spacing:.25px;
        }
        .can-pill.blink{ animation: canPillBlink .85s infinite; }
        @keyframes canPillBlink{ 0%{filter:brightness(1)} 50%{filter:brightness(1.2); transform:scale(1.03)} 100%{filter:brightness(1)} }

        .can-title{
          margin: 10px 0 4px 0;
          font-weight: 990;
          line-height: 1.08;
          position: relative;
        }
        .can-sub{
          color: rgba(0,0,0,.62);
          font-weight: 800;
          position: relative;
        }

        .can-meta{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px; position:relative; }
        .can-badge{
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 10px; border-radius:999px;
          font-weight: 900; font-size:.82rem;
          background: rgba(255,255,255,.78);
          border: 1px solid rgba(0,0,0,.10);
          color: rgba(0,0,0,.82);
        }
        .can-count{
          background: var(--duu-yellow, #FFD54F);
          color:#111; border: 1px solid rgba(0,0,0,.12);
          will-change: transform;
        }

        @keyframes canPulseNormal {
          0% { transform: scale(1); box-shadow: 0 .35rem .9rem rgba(255,213,79,.30); }
          50% { transform: scale(1.025); box-shadow: 0 .55rem 1.15rem rgba(255,213,79,.45); }
          100% { transform: scale(1); box-shadow: 0 .35rem .9rem rgba(255,213,79,.30); }
        }
        .pulse-normal{ animation: canPulseNormal 1.25s ease-in-out infinite; }

        @keyframes canPulseSoon {
          0% { transform: scale(1); box-shadow: 0 .45rem 1.05rem rgba(255,213,79,.42); }
          50% { transform: scale(1.045); box-shadow: 0 .75rem 1.55rem rgba(255,213,79,.65); }
          100% { transform: scale(1); box-shadow: 0 .45rem 1.05rem rgba(255,213,79,.42); }
        }
        .pulse-soon{ animation: canPulseSoon 1.05s ease-in-out infinite; }

        @keyframes canPulseD1 {
          0% { transform: scale(1); box-shadow: 0 .55rem 1.25rem rgba(255,213,79,.55); }
          50% { transform: scale(1.06); box-shadow: 0 1rem 2rem rgba(255,213,79,.85); }
          100% { transform: scale(1); box-shadow: 0 .55rem 1.25rem rgba(255,213,79,.55); }
        }
        .pulse-d1{ animation: canPulseD1 .78s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce){
          .pulse-normal, .pulse-soon, .pulse-d1{ animation: none; }
        }
      `}</style>

      <div className="can-hero mb-3">
        <div className="d-flex flex-column flex-sm-row align-items-sm-start justify-content-between gap-2" style={{ position: "relative" }}>
          <div style={{ minWidth: 0 }}>
            <div className="can-chip">
              <span className={`can-dot ${blink ? "blink" : ""}`} />
              <span className={`can-pill ${blink ? "blink" : ""}`}>CAN 2025</span>
              <span style={{ fontWeight: 900, color: "rgba(0,0,0,.75)" }}>Mode Coupe d’Afrique 🏆</span>
            </div>

            <div className="can-sub">Maroc • Fin le 22 janvier</div>

            <div className="can-meta">
              <span className={`can-badge can-count ${pulseClass}`}>
                ⏳ {cd.isOver ? "Terminé" : `Reste ${cd.days}j ${timeStr}`}
              </span>
              <CanKickLottie size={34} showTeam />
            </div>
          </div>

          <button type="button" className="btn btn-sm btn-outline-dark" onClick={fetchPromos} disabled={loading}>
            {loading ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}

      {loading ? (
        <div className="text-muted">Chargement des offres CAN…</div>
      ) : canItems.length === 0 ? (
        <div className="text-muted">Aucune offre CAN disponible pour le moment.</div>
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
                  badgeText={`SUPPORTERS ${promo.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
