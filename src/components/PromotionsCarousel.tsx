import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, api } from "../services/http";
import type { Product } from "../services/products";

type PromoDiscountType = "PERCENT" | "AMOUNT";

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
        name.includes("canette") ||
        name.includes("boisson") ||
        name.includes("soda");

      return { p, type, value, promoPrice, cover, isCan };
    });
  }, [items]);

  // ✅ auto-scroll (désactivé si l’utilisateur scroll/drag)
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

  return (
    <section className="container-xxl mt-4">
      <style>{`
        .duu-promo-wrap{
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 18px;
          background:
            radial-gradient(1200px 220px at 20% 0%, rgba(255,213,79,.35), transparent 60%),
            radial-gradient(900px 240px at 85% 10%, rgba(229,57,53,.10), transparent 55%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
          padding: 14px;
        }

        /* HEADER mobile-first: pas de bouton, tout est cliquable */
        .duu-promo-head{
          display:flex;
          gap:10px;
          align-items:flex-start;
          justify-content:space-between;
          cursor:pointer;
          user-select:none;
        }
        .duu-promo-title{
          margin:0;
          font-weight: 950;
          color: var(--duu-black);
          line-height: 1.15;
        }
        .duu-promo-sub{
          color: rgba(0,0,0,.62);
          font-weight: 700;
          line-height: 1.2;
        }
        .duu-promo-chevron{
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          border: 1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.75);
        }

        /* Ruban CAN + clignotement visible */
        .duu-can-ribbon{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:6px 10px;
          border-radius:999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.72);
          font-weight: 900;
          max-width: 100%;
        }
        .duu-can-ribbon .pill{
          background: var(--duu-red);
          color:#fff;
          padding:2px 8px;
          border-radius:999px;
          font-size:.75rem;
          font-weight: 950;
          letter-spacing: .3px;
          white-space: nowrap;
        }
        .duu-can-ribbon .pill.blink{
          animation: duuPillBlink .85s infinite;
        }
        @keyframes duuPillBlink{
          0%{ filter: brightness(1); transform: scale(1); }
          50%{ filter: brightness(1.25); transform: scale(1.03); }
          100%{ filter: brightness(1); transform: scale(1); }
        }

        .duu-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,1);
          box-shadow: 0 0 0 3px rgba(229,57,53,.18);
        }
        .duu-dot.blink{
          animation: duuBlink 0.7s infinite;
        }
        @keyframes duuBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .25; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }

        /* Scroller: mobile friendly (scroll-snap + overflow auto) */
        .duu-promo-scroller{
          display:flex;
          gap:12px;
          overflow-x:auto;
          overflow-y:hidden;
          scroll-behavior:smooth;
          scroll-snap-type: x mandatory;
          padding-bottom: 2px;
          -webkit-overflow-scrolling: touch;
        }
        .duu-promo-scroller::-webkit-scrollbar{
          height: 6px;
        }
        .duu-promo-scroller::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,.12);
          border-radius: 999px;
        }

        .duu-promo-card{
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
        .duu-promo-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.10);
        }

        .duu-promo-img{
          width:100%;
          height: 160px;
          object-fit: cover;
          background: rgba(0,0,0,.05);
        }

        /* Badges: sur desktop on garde séparé, sur mobile on empile (stack) pour éviter gêne */
        .duu-badge-stack{
          position:absolute; top:10px; left:10px;
          display:flex; flex-direction:column;
          gap:6px;
          max-width: calc(100% - 20px);
        }
        .duu-badge{
          display:inline-flex;
          align-items:center;
          gap:6px;
          background: var(--duu-red);
          color:#fff;
          font-weight:950;
          padding:6px 10px;
          border-radius:999px;
          font-size:.75rem;
          letter-spacing:.2px;
          width: fit-content;
          white-space: nowrap;
        }
        .duu-badge-free{
          display:inline-flex;
          align-items:center;
          gap:6px;
          background: var(--duu-yellow);
          color:#111;
          font-weight:950;
          padding:6px 10px;
          border-radius:999px;
          font-size:.75rem;
          border: 1px solid rgba(0,0,0,.08);
          width: fit-content;
          white-space: nowrap;
        }

        /* Badge CAN produit */
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
          font-weight:950;
          color:#fff;
          background: linear-gradient(90deg, rgba(229,57,53,1), rgba(255,213,79,1));
          border: 1px solid rgba(0,0,0,.12);
          box-shadow: 0 .5rem 1.25rem rgba(0,0,0,.12);
        }

        .duu-price-old{
          text-decoration: line-through;
          color: rgba(0,0,0,.45);
          font-weight: 800;
          font-size: .9rem;
        }

        /* ✅ Mobile optimisations */
        @media (max-width: 576px){
          .duu-promo-wrap{ padding: 12px; border-radius: 16px; }
          .duu-promo-title{ font-size: 1.02rem; }
          .duu-promo-sub{ font-size: .86rem; }
          .duu-promo-card{ width: 172px; border-radius: 14px; }
          .duu-promo-img{ height: 132px; }

          .duu-badge, .duu-badge-free, .duu-badge-can{
            font-size: .70rem;
            padding: 5px 9px;
          }

          /* Empêcher “Promo / Livraison” de se gêner */
          .duu-badge-stack{ gap: 5px; }
        }
      `}</style>

      <div className="duu-promo-wrap">
        {/* ✅ Pas de bouton: header cliquable */}
        <div
          className="duu-promo-head mb-2"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Voir toutes les promos"
        >
          <div style={{ minWidth: 0 }}>
            <div className="duu-can-ribbon mb-2">
              <span className={`duu-dot ${blink ? "blink" : ""}`} />
              <span className={`pill ${blink ? "blink" : ""}`}>OFFRE CAN 🇲🇦</span>
              <span
                className="small"
                style={{
                  color: "rgba(0,0,0,.70)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  display: "block",
                }}
              >
                Promos + livraison offerte (produits éligibles)
              </span>
            </div>

            <h2 className="duu-promo-title">🔥 Offres spéciales CAN</h2>
            <div className="duu-promo-sub">
              Promo immédiate • Livraison offerte sur les promos
            </div>
          </div>

          <div className="duu-promo-chevron" aria-hidden="true">
            ›
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="duu-promo-scroller"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Voir toutes les offres"
        >
          {computed.map(({ p, promoPrice, cover, type, value, isCan }: any) => {
            const saved =
              type === "PERCENT"
                ? `-${Math.round(value)}%`
                : `-${moneyMAD(value)}`;

            return (
              <div className="card border-0 duu-promo-card" data-promo-card key={p.id}>
                <div className="position-relative">
                  {cover ? (
                    <img
                      className="duu-promo-img"
                      src={imgUrl(cover)}
                      alt={p.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="duu-promo-img d-flex align-items-center justify-content-center text-muted">
                      Image
                    </div>
                  )}

                  {/* ✅ Stack: “Promo” + “Livraison offerte” sans se gêner */}
                  <div className="duu-badge-stack">
                    <span className="duu-badge">PROMO {saved}</span>
                    <span className="duu-badge-free">🚚 Livraison offerte</span>
                  </div>

                  {isCan && (
                    <span className="duu-badge-can">
                      <span className={`duu-dot ${blink ? "blink" : ""}`} />
                      Offre CAN 🇲🇦
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
                    <div className="duu-price-old">{moneyMAD(p.price)}</div>
                  </div>

                  <div className="small text-muted mt-1">
                    {isCan ? <>⚡ Offre CAN limitée — profitez maintenant</> : <>✅ Promo valide sur produit éligible</>}
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
