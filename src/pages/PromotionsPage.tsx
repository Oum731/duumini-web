import { useEffect, useMemo, useState } from "react";
import { api } from "../services/http";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { getPromoMeta, isRealPromo } from "../lib/promotions";
import CanKickLottie, { type CanOffer } from "../components/CanKickLottie";

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

  const offer: CanOffer = useMemo(
    () => ({
      label: "OFFRE CAN 2025",
      title: "Promo & Livraison gratuite",
    }),
    []
  );

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
    return [...list].sort(
      (a: any, b: any) => Number(b?.promo_discount_value ?? 0) - Number(a?.promo_discount_value ?? 0)
    );
  }, [items]);

  return (
    <div className="container-xxl py-4">
      <style>{`
        .can-card{
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,.06);
          background:
            radial-gradient(900px 320px at 10% 0%, rgba(255,213,79,.36), transparent 60%),
            radial-gradient(900px 280px at 92% 10%, rgba(229,57,53,.18), transparent 55%),
            linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.55));
          overflow:hidden;
        }
        .can-grid{
          display:grid;
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 12px;
        }
        .can-anim-wrap{
          border-radius: 18px;
          overflow:hidden;
          background: rgba(255,255,255,.25);
          border: 1px solid rgba(0,0,0,.08);
          box-shadow: 0 .8rem 2.2rem rgba(0,0,0,.10);
          aspect-ratio: 2 / 1;
        }
        .can-text{
          min-width:0;
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        .can-chip{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:8px 12px;
          border-radius: 999px;
          border: 1px dashed rgba(0,0,0,.16);
          background: rgba(255,255,255,.80);
          font-weight: 950;
          width: fit-content;
        }
        .can-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,1);
          box-shadow: 0 0 0 3px rgba(229,57,53,.18);
        }
        .can-dot.blink{ animation: canBlink .7s infinite; }
        @keyframes canBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .25; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }
        .can-pill{
          background: var(--duu-red, #E53935);
          color:#fff;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: .82rem;
          font-weight: 950;
          letter-spacing: .2px;
        }
        .can-title{
          margin: 0;
          font-weight: 990;
          letter-spacing: .2px;
          line-height: 1.06;
        }
        .can-sub{
          font-weight: 800;
          color: rgba(0,0,0,.62);
          margin: 0;
        }
        .can-meta{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
        }
        .can-count{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: var(--duu-yellow, #FFD54F);
          border: 1px solid rgba(0,0,0,.14);
          color:#111;
          font-weight: 950;
          box-shadow: 0 .6rem 1.3rem rgba(255,213,79,.35);
          white-space: nowrap;
        }
        @keyframes canPulseNormal { 0%{transform:scale(1)} 50%{transform:scale(1.03)} 100%{transform:scale(1)} }
        @keyframes canPulseSoon { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
        @keyframes canPulseD1 { 0%{transform:scale(1)} 50%{transform:scale(1.07)} 100%{transform:scale(1)} }
        .pulse-normal{ animation: canPulseNormal 1.25s ease-in-out infinite; }
        .pulse-soon{ animation: canPulseSoon 1.05s ease-in-out infinite; }
        .pulse-d1{ animation: canPulseD1 .78s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){
          .pulse-normal, .pulse-soon, .pulse-d1{ animation:none; }
        }
        .can-note{
          padding: 10px 12px 12px 12px;
          border-top: 1px dashed rgba(0,0,0,.10);
          font-weight: 800;
          color: rgba(0,0,0,.60);
          background: rgba(255,255,255,.55);
        }
        @media (min-width: 992px){
          .can-grid{
            grid-template-columns: 1fr 1fr;
            align-items: center;
            gap: 14px;
            padding: 14px;
          }
          .can-anim-wrap{ aspect-ratio: 16 / 9; }
        }
      `}</style>

      <div className="can-card mb-3">
        <div className="can-grid">
          <div className="can-anim-wrap">
            <CanKickLottie variant="hero" className="w-100 h-100" offer={offer} blink={blink} />
          </div>

          <div className="can-text">
           

            <p className="can-sub">Fin le 22 janvier 2026</p>

            <div className="can-meta">
              <span className={`can-count ${pulseClass}`}>
                ⏳ {cd.isOver ? "Terminé" : `${cd.days}j ${timeStr}`}
              </span>

              
              <button
                type="button"
                className="btn btn-sm btn-outline-dark ms-auto"
                onClick={fetchPromos}
                disabled={loading}
                title="Actualiser"
              >
                {loading ? "…" : "Actualiser"}
              </button>
            </div>

          </div>
        </div>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}

      {loading ? (
        <div className="text-muted">Chargement des offres CAN…</div>
      ) : canItems.length === 0 ? (
        <div className="text-muted">Aucune offre CAN pour le moment.</div>
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
                  badgeText={`OFFRE CAN ${promo.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
