import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, api } from "../services/http";
import type { Product } from "../services/products";

type PromoDiscountType = "PERCENT" | "AMOUNT";

/* =========================
   CONFIG CAN
   ========================= */
const PROMO_END_ISO = "2026-01-22T23:59:59+01:00"; // ✅ fin 22 janvier (heure Maroc)

/* ===== Helpers ===== */
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

/** clignotant doux */
function useBlink(ms = 650) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setInterval(() => setOn((v) => !v), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return on;
}

/** compte à rebours */
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

  // ✅ intensité du pulse selon l'urgence (CAN vibes)
  const urgency = useMemo(() => {
    if (cd.isOver) return "OVER" as const;
    if (cd.days <= 0) return "D1" as const; // <= 24h
    if (cd.days <= 7) return "SOON" as const; // <= 7 jours
    return "NORMAL" as const;
  }, [cd.days, cd.isOver]);

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
      } catch (e) {
        console.error("[PromotionsCarousel] fetch error", e);
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

      const name = String(p?.name || "").toLowerCase();
      const isCan =
        Boolean(p?.promo_can) ||
        name.includes("can") ||
        name.includes("coupe") ||
        name.includes("afrique") ||
        name.includes("canette") ||
        name.includes("boisson") ||
        name.includes("soda");

      return { p, type, value, promoPrice, cover, isCan };
    });
  }, [items]);

  // ✅ auto-scroll (pause si user drag/scroll)
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

  const timeStr = `${String(cd.hours).padStart(2, "0")}:${String(cd.mins).padStart(
    2,
    "0"
  )}:${String(cd.secs).padStart(2, "0")}`;

  // ✅ classes pulse selon urgence
  const pulseClass =
    urgency === "D1" ? "pulse-d1" : urgency === "SOON" ? "pulse-soon" : "pulse-normal";

  return (
    <section className="container-xxl mt-4">
      <style>{`
        .duu-can-wrap{
          position: relative;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 20px;
          padding: 14px;
          overflow: hidden;
          background:
            radial-gradient(1100px 320px at 10% 0%, rgba(255,213,79,.35), transparent 60%),
            radial-gradient(900px 280px at 90% 10%, rgba(229,57,53,.16), transparent 55%),
            radial-gradient(700px 240px at 70% 90%, rgba(0,150,80,.08), transparent 60%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
        }
        .duu-can-wrap:before{
          content:"";
          position:absolute; inset:0;
          background:
            linear-gradient(135deg, rgba(229,57,53,.08) 0%, transparent 40%),
            linear-gradient(45deg, rgba(255,213,79,.08) 0%, transparent 40%),
            repeating-linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.04) 1px, transparent 1px, transparent 18px);
          opacity:.55;
          pointer-events:none;
        }

        .duu-can-head{
          position: relative;
          display:flex;
          gap:10px;
          align-items:flex-start;
          justify-content:space-between;
          cursor:pointer;
          user-select:none;
        }

        .duu-can-title{
          margin:0;
          font-weight: 980;
          color: var(--duu-black);
          line-height: 1.1;
          letter-spacing: .2px;
        }
        .duu-can-sub{
          color: rgba(0,0,0,.62);
          font-weight: 780;
          line-height: 1.2;
        }

        .duu-can-chevron{
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          border: 1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.78);
        }

        .duu-can-ribbon{
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          max-width: 100%;
          margin-bottom: 8px;
        }

        .duu-can-pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:7px 10px;
          border-radius:999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.74);
          font-weight: 950;
        }

        .duu-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,1);
          box-shadow: 0 0 0 3px rgba(229,57,53,.18);
        }
        .duu-dot.blink{ animation: duuBlink 0.7s infinite; }
        @keyframes duuBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .25; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }

        .duu-can-tag{
          background: var(--duu-red);
          color:#fff;
          padding:2px 8px;
          border-radius:999px;
          font-size:.78rem;
          font-weight: 980;
          letter-spacing: .35px;
          white-space: nowrap;
        }
        .duu-can-tag.blink{ animation: duuPillBlink .85s infinite; }
        @keyframes duuPillBlink{
          0%{ filter: brightness(1); transform: scale(1); }
          50%{ filter: brightness(1.25); transform: scale(1.03); }
          100%{ filter: brightness(1); transform: scale(1); }
        }

        .duu-can-meta{
          display:flex;
          gap:8px;
          flex-wrap: wrap;
          align-items:center;
        }
        .duu-chip{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:6px 10px;
          border-radius:999px;
          font-weight:900;
          font-size:.82rem;
          background: rgba(255,255,255,.76);
          border: 1px solid rgba(0,0,0,.10);
          color: rgba(0,0,0,.78);
        }

        /* ✅ compteur jaune CAN */
        .duu-chip-strong{
          background: var(--duu-yellow, #FFD54F);
          color:#111;
          border: 1px solid rgba(0,0,0,.12);
          will-change: transform;
        }

        /* 🔥 Pulse stade - NORMAL */
        @keyframes duuPulseNormal {
          0% { transform: scale(1); box-shadow: 0 .35rem .9rem rgba(255,213,79,.30); }
          50% { transform: scale(1.025); box-shadow: 0 .55rem 1.15rem rgba(255,213,79,.45); }
          100% { transform: scale(1); box-shadow: 0 .35rem .9rem rgba(255,213,79,.30); }
        }
        .pulse-normal{ animation: duuPulseNormal 1.25s ease-in-out infinite; }

        /* 🔥 Pulse plus fort quand on approche (≤ 7 jours) */
        @keyframes duuPulseSoon {
          0% { transform: scale(1); box-shadow: 0 .45rem 1.05rem rgba(255,213,79,.42); }
          50% { transform: scale(1.045); box-shadow: 0 .75rem 1.55rem rgba(255,213,79,.65); }
          100% { transform: scale(1); box-shadow: 0 .45rem 1.05rem rgba(255,213,79,.42); }
        }
        .pulse-soon{ animation: duuPulseSoon 1.05s ease-in-out infinite; }

        /* ⏱️ Pulse plus rapide à J-1 (≤ 24h) */
        @keyframes duuPulseD1 {
          0% { transform: scale(1); box-shadow: 0 .55rem 1.25rem rgba(255,213,79,.55); }
          50% { transform: scale(1.06); box-shadow: 0 1rem 2rem rgba(255,213,79,.85); }
          100% { transform: scale(1); box-shadow: 0 .55rem 1.25rem rgba(255,213,79,.55); }
        }
        .pulse-d1{ animation: duuPulseD1 .78s ease-in-out infinite; }

        /* Accessibilité */
        @media (prefers-reduced-motion: reduce){
          .pulse-normal, .pulse-soon, .pulse-d1{ animation: none; }
        }

        .duu-chip-green{
          background: rgba(0,150,80,.10);
        }

        .duu-can-scroller{
          position: relative;
          display:flex;
          gap:12px;
          overflow-x:auto;
          overflow-y:hidden;
          scroll-behavior:smooth;
          scroll-snap-type: x mandatory;
          padding-bottom: 2px;
          -webkit-overflow-scrolling: touch;
          margin-top: 10px;
        }
        .duu-can-scroller::-webkit-scrollbar{ height: 6px; }
        .duu-can-scroller::-webkit-scrollbar-thumb{
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
        }
        .duu-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.10);
        }

        .duu-img{
          width:100%;
          height: 160px;
          object-fit: cover;
          background: rgba(0,0,0,.05);
        }

        .duu-badge{
          position:absolute; top:10px; left:10px;
          display:inline-flex;
          align-items:center;
          gap:6px;
          background: var(--duu-red);
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

        .duu-old{
          text-decoration: line-through;
          color: rgba(0,0,0,.45);
          font-weight: 800;
          font-size: .9rem;
        }

        .duu-note{
          margin-top: 6px;
          color: rgba(0,0,0,.56);
          font-size: .85rem;
          font-weight: 700;
        }

        @media (max-width: 576px){
          .duu-can-wrap{ padding: 12px; border-radius: 18px; }
          .duu-can-title{ font-size: 1.04rem; }
          .duu-can-sub{ font-size: .88rem; }
          .duu-card{ width: 172px; border-radius: 14px; }
          .duu-img{ height: 132px; }
          .duu-badge, .duu-badge-can{ font-size: .70rem; padding: 5px 9px; }
          .duu-chip{ font-size: .78rem; padding: 6px 9px; }
        }
      `}</style>

      <div className="duu-can-wrap">
        <div
          className="duu-can-head"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Découvrir toutes les Offres CAN"
        >
          <div style={{ minWidth: 0, position: "relative" }}>
            <div className="duu-can-ribbon">
              <span className="duu-can-pill">
                <span className={`duu-dot ${blink ? "blink" : ""}`} />
                <span className={`duu-can-tag ${blink ? "blink" : ""}`}>
                  OFFRE CAN 🇲🇦
                </span>
                <span style={{ fontWeight: 900, color: "rgba(0,0,0,.75)" }}>
                  CAN 2025 • Maroc • Ambiance supporters 🔥
                </span>
              </span>
            </div>

            <h2 className="duu-can-title">🏆 Spécial CAN 2025 — Promos en mode “stade”</h2>

            {/* ✅ texte supprimé */}
            <div className="duu-can-sub">Coupe d’Afrique • Fin le 22 janvier</div>

            <div className="duu-can-meta mt-2">
              <span className={`duu-chip duu-chip-strong ${pulseClass}`}>
                ⏳ {cd.isOver ? "Offre terminée" : `Reste ${cd.days}j ${timeStr}`}
              </span>
              <span className="duu-chip duu-chip-green">🇲🇦 Maroc</span>
              <span className="duu-chip">🚚 Livraison offerte*</span>
              <span className="duu-chip">🎉 Prix supporters</span>
            </div>

            <div className="duu-note">*Livraison offerte sur les produits éligibles.</div>
          </div>

          <div className="duu-can-chevron" aria-hidden="true">
            ›
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="duu-can-scroller"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Découvrir toutes les offres CAN"
        >
          {computed.map(({ p, promoPrice, cover, type, value, isCan }: any) => {
            const saved =
              type === "PERCENT" ? `-${Math.round(value)}%` : `-${moneyMAD(value)}`;

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
                      <span className={`duu-dot ${blink ? "blink" : ""}`} />
                      CAN 🇲🇦
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
                    {cd.isOver
                      ? "⏳ Offre CAN terminée"
                      : isCan
                      ? "🔥 Ambiance CAN — profite maintenant"
                      : "🎉 Promo du moment"}
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
