import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, api } from "../services/http";
import type { Product } from "../services/products";
import CanKickLottie, { type CanOffer } from "./CanKickLottie";

type PromoDiscountType = "PERCENT" | "AMOUNT";
const PROMO_END_ISO = "2026-01-22T23:59:59+01:00";

function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} MAD`;
}

function computePromoPrice(price: number, type: PromoDiscountType, value: number) {
  const p = Number(price || 0);
  const v = Number(value || 0);
  if (!p || !v) return p;

  if (type === "PERCENT") {
    const pct = Math.max(0, Math.min(100, v));
    return Math.max(0, Number((p - (p * pct) / 100).toFixed(2)));
  }
  return Math.max(0, Number((p - v).toFixed(2)));
}

function isRealPromo(p: any) {
  const isFood = String(p?.sub_category || "").toLowerCase() === "food";
  return (
    !isFood &&
    Number(p?.promo_eligible ?? 0) === 1 &&
    Number(p?.promo_discount_value ?? 0) > 0
  );
}

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

export default function PromotionsCarousel({
  limit = 10,
  intervalMs = 3200,
  toAllLink = "/promos",
  offer,
}: {
  limit?: number;
  intervalMs?: number;
  toAllLink?: string;
  offer?: CanOffer;
}) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const navigate = useNavigate();

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

  useEffect(() => {
    let cancelled = false;

    async function fetchPromos() {
      try {
        setLoading(true);

        try {
          const res = await api.get<Product[]>("/api/products/promotions", {
            query: { limit, onlyActive: 1 },
          });
          const promos = (res || []).filter(isRealPromo).slice(0, limit);
          if (!cancelled) setItems(promos);
          return;
        } catch {}

        const res = await api.get<{ items: Product[] }>("/api/products", {
          query: { page: 1, pageSize: 120, onlyActive: 1 },
        });

        const promos = (res.items || []).filter(isRealPromo).slice(0, limit);
        if (!cancelled) setItems(promos);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPromos();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const computed = useMemo(() => {
    return items.map((p: any) => {
      const type: PromoDiscountType =
        p?.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";
      const value = Number(p?.promo_discount_value ?? 0);
      const promoPrice = computePromoPrice(Number(p?.price ?? 0), type, value);
      const cover = p?.cover || p?.images?.[0]?.url || null;
      const isCan = Boolean(p?.promo_can);
      return { p, type, value, promoPrice, cover, isCan };
    });
  }, [items]);

  useEffect(() => {
    if (!scrollerRef.current || computed.length <= 1) return;

    const container = scrollerRef.current;
    let paused = false;

    const onPointerDown = () => (paused = true);
    const onPointerUp = () => (paused = false);

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    const step = () => {
      if (paused) return;
      const cards = container.querySelectorAll<HTMLElement>("[data-promo-card]");
      if (!cards.length) return;

      indexRef.current += 1;
      if (indexRef.current >= cards.length) {
        indexRef.current = 0;
        container.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      const el = cards[indexRef.current];
      container.scrollTo({ left: el.offsetLeft - 12, behavior: "smooth" });
    };

    const t = window.setInterval(step, intervalMs);
    return () => {
      window.clearInterval(t);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [computed, intervalMs]);

  if (loading || computed.length === 0) return null;

  const headline = "Spécial CAN • Duumini";

  return (
    <section className="container-xxl mt-4">
      <style>{`
        .can-ticket{
          position:relative;
          border: 1px solid rgba(0,0,0,.07);
          border-radius: 18px;
          overflow: hidden;
          background:
            radial-gradient(1200px 320px at 15% 0%, rgba(255,213,79,.42), transparent 60%),
            radial-gradient(900px 280px at 90% 10%, rgba(229,57,53,.18), transparent 55%),
            linear-gradient(180deg, rgba(255,255,255,.74), rgba(255,255,255,.48));
          box-shadow: 0 .9rem 2.2rem rgba(0,0,0,.10);
        }

        /* ✅ Bandeau jaune (avant le visuel) */
        .can-banner{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding: 10px 12px;
          background: var(--duu-yellow, #FFD54F);
          border-bottom: 1px solid rgba(0,0,0,.10);
        }
        .can-banner-left{
          display:flex;
          flex-direction:column;
          gap:2px;
          min-width:0;
        }
        .can-banner-title{
          font-weight: 990;
          color: rgba(0,0,0,.92);
          line-height: 1.05;
          letter-spacing: .2px;
          font-size: .98rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .can-banner-sub{
          font-weight: 850;
          color: rgba(0,0,0,.70);
          font-size: .86rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .can-banner-badge{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,.86);
          color:#fff;
          font-weight: 980;
          letter-spacing: .2px;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 .5rem 1.1rem rgba(0,0,0,.12);
          white-space: nowrap;
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

        /* effet ticket perforé (léger, pro) */
        .can-ticket::before, .can-ticket::after{
          content:"";
          position:absolute;
          top: 132px; /* ⬅️ ajusté car on a ajouté le bandeau */
          width: 26px; height: 26px;
          border-radius: 999px;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(0,0,0,.10);
          z-index: 3;
        }
        .can-ticket::before{ left:-13px; }
        .can-ticket::after{ right:-13px; }

        .can-grid{
          display:grid;
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 12px;
          align-items: center;
        }

        .can-visual{
          border-radius: 18px;
          overflow:hidden;
          border: 1px solid rgba(0,0,0,.08);
          background: rgba(255,255,255,.25);
          box-shadow: 0 .8rem 2.2rem rgba(0,0,0,.10);
          min-height: 210px;
        }

        .can-right{ min-width:0; }

        .can-actions{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          margin-top: 6px;
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
          font-weight: 980;
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

        .can-cta{
          margin-left:auto;
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.86);
          font-weight: 950;
          color: rgba(0,0,0,.82);
          white-space: nowrap;
        }

        .duu-scroller{
          display:flex;
          gap:12px;
          overflow-x:auto;
          overflow-y:hidden;
          scroll-behavior:smooth;
          scroll-snap-type: x mandatory;
          padding: 10px 12px 14px 12px;
          -webkit-overflow-scrolling: touch;
        }
        .duu-scroller::-webkit-scrollbar{ height: 6px; }
        .duu-scroller::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,.12);
          border-radius: 999px;
        }

        .duu-card{
          width: 220px;
          flex: 0 0 auto;
          border-radius: 16px;
          overflow:hidden;
          cursor:pointer;
          transition: transform .15s ease, box-shadow .15s ease;
          scroll-snap-align: start;
          box-shadow: 0 .35rem 1.25rem rgba(0,0,0,.06);
          background: #fff;
          border: 1px solid rgba(0,0,0,.06);
        }
        .duu-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.10);
        }
        .duu-img{ width:100%; height:160px; object-fit:cover; background: rgba(0,0,0,.05); }

        .duu-badge{
          position:absolute; top:10px; left:10px;
          display:inline-flex;
          align-items:center;
          gap:6px;
          background: var(--duu-red, #E53935);
          color:#fff;
          font-weight:980;
          padding:6px 10px;
          border-radius:999px;
          font-size:.75rem;
          letter-spacing:.2px;
          max-width: calc(100% - 20px);
          white-space: nowrap;
        }

        .duu-badge-can{
          position:absolute;
          left: 10px;
          bottom: 10px;
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:6px 10px;
          border-radius:999px;
          font-size:.75rem;
          font-weight:980;
          color:#fff;
          background: linear-gradient(90deg, rgba(229,57,53,1), rgba(255,213,79,1));
          border: 1px solid rgba(0,0,0,.12);
          box-shadow: 0 .5rem 1.25rem rgba(0,0,0,.12);
          max-width: calc(100% - 20px);
          white-space: nowrap;
        }

        .duu-old{ text-decoration: line-through; color: rgba(0,0,0,.45); font-weight: 850; font-size: .9rem; }

        @media (min-width: 992px){
          .can-grid{ grid-template-columns: 1.05fr .95fr; gap: 14px; padding: 14px; }
          .can-visual{ min-height: 230px; }
        }
        @media (max-width: 576px){
          .duu-card{ width: 172px; border-radius: 14px; }
          .duu-img{ height: 132px; }
          .can-banner-title{ font-size: .94rem; }
          .can-banner-sub{ font-size: .82rem; }
        }
      `}</style>

      <div
        className="can-ticket"
        role="button"
        tabIndex={0}
        onClick={() => navigate(toAllLink)}
        onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
        title="Voir les offres CAN"
      >
        {/* ✅ NOUVEAU BANDEAU JAUNE AVANT LE VISUEL */}
        <div className="can-banner">
          <div className="can-banner-left">
            <div className="can-banner-title">{headline}</div>
          </div>

          <div className="can-banner-badge" aria-hidden="true">
            <span className={`can-dot ${blink ? "blink" : ""}`} />
            CAN
          </div>
        </div>

        <div className="can-grid">
          <div className="can-visual">
            <CanKickLottie variant="hero" offer={offer} blink={blink} />
          </div>

          <div className="can-right">
            <div className="can-actions">
              <span className={`can-count ${pulseClass}`}>
                ⏳ {cd.isOver ? "Terminé" : `${cd.days}j ${timeStr}`}
              </span>

              <span className="can-cta">
                🔥 Voir les offres <span aria-hidden="true">›</span>
              </span>
            </div>
          </div>
        </div>

        {/* ✅ ton carrousel produits (même logique + auto-scroll) */}
        <div
          ref={scrollerRef}
          className="duu-scroller"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Voir les promos CAN"
        >
          {computed.map(({ p, promoPrice, cover, type, value, isCan }: any) => {
            const saved = type === "PERCENT" ? `-${Math.round(value)}%` : `-${moneyMAD(value)}`;

            return (
              <div className="card border-0 duu-card" data-promo-card key={p.id}>
                <div className="position-relative">
                  {cover ? (
                    <img className="duu-img" src={imgUrl(cover)} alt={p.name} loading="lazy" />
                  ) : (
                    <div className="duu-img d-flex align-items-center justify-content-center text-muted">
                      Image
                    </div>
                  )}

                  <span className="duu-badge">PROMO {saved}</span>

                  {isCan && (
                    <span className="duu-badge-can">
                      <span className={`can-dot ${blink ? "blink" : ""}`} />
                      CAN
                    </span>
                  )}
                </div>

                <div className="card-body p-2">
                  <div
                    className="fw-semibold small mb-1"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      minHeight: "2.4em",
                    }}
                  >
                    {p.name}
                  </div>

                  <div className="d-flex align-items-baseline gap-2">
                    <div className="fw-bold">{moneyMAD(promoPrice)}</div>
                    <div className="duu-old">{moneyMAD(p.price)}</div>
                  </div>

                  <div className="small text-muted mt-1">
                    {cd.isOver ? "Offre terminée" : "⚡ Offre CAN"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
