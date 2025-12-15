import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, api } from "../services/http";
import type { Product } from "../services/products";
import CanKickLottie from "./CanKickLottie";

type PromoDiscountType = "PERCENT" | "AMOUNT";

const PROMO_END_ISO = "2026-01-22T23:59:59+01:00";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  return `${Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
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
  return !isFood && Number(p?.promo_eligible ?? 0) === 1 && Number(p?.promo_discount_value ?? 0) > 0;
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
}: {
  limit?: number;
  intervalMs?: number;
  toAllLink?: string;
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
      const type: PromoDiscountType = p?.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";
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

  const timeStr = `${String(cd.hours).padStart(2, "0")}:${String(cd.mins).padStart(2, "0")}:${String(
    cd.secs
  ).padStart(2, "0")}`;

  return (
    <section className="container-xxl mt-4">
      <style>{`
        .can-wrap{
          position: relative;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 20px;
          padding: 14px;
          overflow: hidden;
          background:
            radial-gradient(1100px 320px at 10% 0%, rgba(255,213,79,.35), transparent 60%),
            radial-gradient(900px 280px at 90% 10%, rgba(229,57,53,.16), transparent 55%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
        }
        .can-head{
          display:flex; gap:10px; align-items:flex-start; justify-content:space-between;
          cursor:pointer; user-select:none;
        }
        .can-pill{
          display:inline-flex; align-items:center; gap:8px;
          padding:7px 10px; border-radius:999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.74);
          font-weight: 950;
        }
        .can-dot{ width:10px;height:10px;border-radius:50%; background: rgba(229,57,53,.95); box-shadow: 0 0 0 3px rgba(229,57,53,.20); }
        .can-dot.blink{ animation: canBlink .7s infinite; }
        @keyframes canBlink{ 0%{opacity:1} 50%{opacity:.25; transform:scale(.75)} 100%{opacity:1} }
        .can-tag{
          background: var(--duu-red, #E53935);
          color:#fff; padding:2px 10px; border-radius:999px;
          font-size:.80rem; font-weight:980; letter-spacing:.25px;
        }
        .can-title{ margin:8px 0 2px 0; font-weight:990; line-height:1.1; }
        .can-sub{ color: rgba(0,0,0,.62); font-weight:800; }

        .can-meta{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:10px; }
        .can-chip{
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 10px; border-radius:999px; font-weight:900; font-size:.82rem;
          background: rgba(255,255,255,.78); border: 1px solid rgba(0,0,0,.10);
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

        .can-scroller{
          display:flex; gap:12px; overflow-x:auto; overflow-y:hidden;
          scroll-behavior:smooth; scroll-snap-type:x mandatory; -webkit-overflow-scrolling: touch;
          margin-top: 12px; padding-bottom: 2px;
        }
        .can-scroller::-webkit-scrollbar{ height: 6px; }
        .can-scroller::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.12); border-radius: 999px; }

        .can-card{
          width: 220px; flex: 0 0 auto; border-radius: 16px; overflow:hidden;
          cursor:pointer; scroll-snap-align:start;
          box-shadow: 0 .35rem 1.25rem rgba(0,0,0,.06);
          background:#fff;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .can-card:hover{ transform: translateY(-2px); box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.10); }

        .can-img{ width:100%; height:160px; object-fit:cover; background: rgba(0,0,0,.05); }

        .can-badge{
          position:absolute; top:10px; left:10px;
          display:inline-flex; align-items:center; gap:6px;
          background: var(--duu-red, #E53935); color:#fff;
          font-weight:980; padding:6px 10px; border-radius:999px; font-size:.75rem;
          max-width: calc(100% - 20px); white-space: nowrap;
        }
        .can-badge-can{
          position:absolute; left:10px; bottom:10px;
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border-radius:999px; font-size:.75rem; font-weight:980;
          color:#fff; background: linear-gradient(90deg, rgba(229,57,53,1), rgba(255,213,79,1));
          border: 1px solid rgba(0,0,0,.12);
          box-shadow: 0 .5rem 1.25rem rgba(0,0,0,.12);
        }
        .can-old{ text-decoration:line-through; color: rgba(0,0,0,.45); font-weight:800; font-size:.9rem; }

        @media (max-width: 576px){
          .can-card{ width:172px; border-radius:14px; }
          .can-img{ height:132px; }
          .can-badge, .can-badge-can{ font-size:.70rem; padding:5px 9px; }
          .can-chip{ font-size:.78rem; padding:6px 9px; }
          .can-title{ font-size:1.04rem; }
          .can-sub{ font-size:.88rem; }
        }
      `}</style>

      <div className="can-wrap">
        <div
          className="can-head"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Voir toutes les promos CAN"
        >
          <div style={{ minWidth: 0 }}>
            <div className="can-pill">
              <span className={`can-dot ${blink ? "blink" : ""}`} />
              <span className="can-tag">🔥 Promos CAN 2025</span>
              <span style={{ fontWeight: 900, color: "rgba(0,0,0,.75)" }}>Coupe d’Afrique</span>
            </div>

            <div className="can-sub">Fin le 22 janvier</div>

            <div className="can-meta">
              <span className={`can-chip can-count ${pulseClass}`}>
                ⏳ {cd.isOver ? "Terminé" : `Reste ${cd.days}j ${timeStr}`}
              </span>
              <span className="can-chip">
                <CanKickLottie size={30} showTeam={false} />
              </span>
            </div>

            <div className="small text-muted mt-2" style={{ fontWeight: 700 }}>
              *Livraison offerte sur produits éligibles.
            </div>
          </div>

          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(0,0,0,.10)",
              background: "rgba(255,255,255,.78)",
              flex: "0 0 auto",
            }}
            aria-hidden="true"
          >
            ›
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="can-scroller"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Voir toutes les promos CAN"
        >
          {computed.map(({ p, promoPrice, cover, type, value, isCan }: any) => {
            const saved = type === "PERCENT" ? `-${Math.round(value)}%` : `-${moneyMAD(value)}`;

            return (
              <div className="card border-0 can-card" data-promo-card key={p.id}>
                <div className="position-relative">
                  {cover ? (
                    <img className="can-img" src={imgUrl(cover)} alt={p.name} loading="lazy" />
                  ) : (
                    <div className="can-img d-flex align-items-center justify-content-center text-muted">
                      Image
                    </div>
                  )}

                  <span className="can-badge">PROMO {saved}</span>

                  {isCan && (
                    <span className="can-badge-can">
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
                    <div className="can-old">{moneyMAD(p.price)}</div>
                  </div>

                  <div className="small text-muted mt-1">{cd.isOver ? "⏳ CAN terminée" : "🔥 Supporters : fonce"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
