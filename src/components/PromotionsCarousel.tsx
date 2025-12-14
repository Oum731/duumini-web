import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

function computePromoPrice(
  price: number,
  type: PromoDiscountType,
  value: number
) {
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
  // ✅ exclure food + promo_eligible doit être 1 + valeur > 0
  const isFood = String(p?.sub_category || "").toLowerCase() === "food";
  return (
    !isFood &&
    Number(p?.promo_eligible ?? 0) === 1 &&
    Number(p?.promo_discount_value ?? 0) > 0
  );
}

/** Petit helper pour activer un "clignotant" sans JS lourd */
function useBlink(ms = 700) {
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

  // ✅ clignotant doux pour mettre en avant l’offre spéciale "CAN"
  const blink = useBlink(650);

  useEffect(() => {
    let cancelled = false;

    async function fetchPromos() {
      try {
        setLoading(true);

        // ✅ si tu as /api/products/promotions, il sera pris, sinon fallback
        try {
          const res = await api.get<Product[]>("/api/products/promotions", {
            query: { limit, onlyActive: 1 },
          });
          const promos = (res || []).filter(isRealPromo).slice(0, limit);
          if (!cancelled) setItems(promos);
          return;
        } catch {
          // fallback
        }

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

      // ✅ "CAN" (Maroc) : tag si le produit est une canette / boisson, ou si tu le marques
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

  // ✅ auto-scroll
  useEffect(() => {
    if (!scrollerRef.current || computed.length <= 1) return;

    const container = scrollerRef.current;

    const step = () => {
      const cards =
        container.querySelectorAll<HTMLElement>("[data-promo-card]");
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
    return () => window.clearInterval(t);
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
        .duu-promo-scroller{
          display:flex; gap:12px;
          overflow:hidden;
          scroll-behavior:smooth;
        }
        .duu-promo-card{
          width: 220px;
          flex: 0 0 auto;
          border-radius: 16px;
          overflow:hidden;
          cursor:pointer;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .duu-promo-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.08);
        }
        .duu-promo-img{
          width:100%;
          height: 160px;
          object-fit: cover;
          background: rgba(0,0,0,.05);
        }

        /* ===== Badges ===== */
        .duu-badge{
          position:absolute; top:10px; left:10px;
          background: var(--duu-red);
          color:#fff; font-weight:900;
          padding:6px 10px;
          border-radius:999px;
          font-size:.75rem;
          letter-spacing:.2px;
        }
        .duu-badge-free{
          position:absolute; top:10px; right:10px;
          background: var(--duu-yellow);
          color:#111; font-weight:900;
          padding:6px 10px;
          border-radius:999px;
          font-size:.75rem;
          border: 1px solid rgba(0,0,0,.08);
        }

        /* ===== Offre spéciale CAN (Maroc) + clignotant doux ===== */
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
          font-weight:900;
          color:#fff;
          background: linear-gradient(90deg, rgba(229,57,53,1), rgba(255,213,79,1));
          border: 1px solid rgba(0,0,0,.12);
          box-shadow: 0 .5rem 1.25rem rgba(0,0,0,.10);
        }
        .duu-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(255,255,255,.95);
          box-shadow: 0 0 0 3px rgba(255,255,255,.25);
        }
        .duu-dot.blink{
          animation: duuBlink 0.7s infinite;
        }
        @keyframes duuBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .25; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }

        .duu-price-old{
          text-decoration: line-through;
          color: rgba(0,0,0,.45);
          font-weight: 800;
          font-size: .9rem;
        }

        /* Mini ruban en haut du bloc */
        .duu-can-ribbon{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:6px 10px;
          border-radius:999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.65);
          font-weight: 800;
        }
        .duu-can-ribbon .pill{
          background: var(--duu-red);
          color:#fff;
          padding:2px 8px;
          border-radius:999px;
          font-size:.75rem;
          font-weight: 900;
        }

        /* CTA "Voir tout" qui attire l'oeil */
        .duu-btn-blink{
          position: relative;
        }
        .duu-btn-blink::after{
          content:"";
          position:absolute;
          inset:-6px;
          border-radius: 999px;
          border: 2px solid rgba(229,57,53,.25);
          opacity: .0;
          transform: scale(.92);
          animation: duuPulse 1.2s infinite;
          pointer-events:none;
        }
        @keyframes duuPulse{
          0%{ opacity:.0; transform: scale(.92); }
          40%{ opacity:.6; transform: scale(1.0); }
          100%{ opacity:0; transform: scale(1.08); }
        }
      `}</style>

      <div className="duu-promo-wrap">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
          <div>
            <div className="duu-can-ribbon mb-2">
              <span className={`duu-dot ${blink ? "blink" : ""}`} />
              <span className="pill">OFFRE CAN 🇲🇦</span>
              <span className="small" style={{ color: "rgba(0,0,0,.70)" }}>
                Spéciale CAN du Maroc — profitez des meilleures promos pendant
                la compétition 🇲🇦
              </span>
            </div>

            <h2
              className="h5 m-0"
              style={{ color: "var(--duu-black)", fontWeight: 900 }}
            >
              🔥 Offres spéciales CAN (Maroc)
            </h2>

            <div className="small text-muted">
              💥 Promo immédiate sur les produits éligibles • 🚚 Livraison
              offerte sur les promos
            </div>
          </div>

          <Link
            to={toAllLink}
            className={`btn btn-sm btn-duu ${blink ? "duu-btn-blink" : ""}`}
          >
            Voir toutes les offres
          </Link>
        </div>

        <div
          ref={scrollerRef}
          className="duu-promo-scroller"
          role="button"
          tabIndex={0}
          onClick={() => navigate(toAllLink)}
          onKeyDown={(e) => e.key === "Enter" && navigate(toAllLink)}
          title="Voir toutes les offres CAN"
        >
          {computed.map(({ p, promoPrice, cover, type, value, isCan }: any) => {
            const saved =
              type === "PERCENT"
                ? `-${Math.round(value)}%`
                : `-${moneyMAD(value)}`;

            return (
              <div
                className="card border-0 duu-promo-card"
                data-promo-card
                key={p.id}
              >
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

                  <span className="duu-badge">PROMO {saved}</span>
                  <span className="duu-badge-free">🚚 Livraison offerte</span>

                  {/* ✅ Badge spécial CAN (si produit canette/boisson) */}
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

                  {/* ✅ micro texte adapté CAN */}
                  <div className="small text-muted mt-1">
                    {isCan ? (
                      <>⚡ Offre CAN limitée — profitez maintenant</>
                    ) : (
                      <>✅ Promo valide sur produit éligible</>
                    )}
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
