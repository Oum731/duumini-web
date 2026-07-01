// src/components/PromotionsSection.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/http";
import type { Product } from "../services/products";
import { moneyMAD, toNum, toCents, fromCents, roundToMAD } from "../utils/money";
import { imgUrl } from "../utils/media";

type PromoDiscountType = "PERCENT" | "AMOUNT";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ promo stable en CENTIMES
 * - PERCENT: p - p*pct/100
 * - AMOUNT: p - value(MAD)
 */
function computePromoPriceStable(price: number, type: PromoDiscountType, value: number) {
  const baseC = roundToMAD(toCents(price || 0));
  if (!baseC) return 0;

  if (type === "PERCENT") {
    const pct = clamp(toNum(value), 0, 100);
    const off = Math.round((baseC * pct) / 100);
    return fromCents(roundToMAD(Math.max(0, baseC - off)));
  }

  const off = toCents(Math.max(0, toNum(value)));
  return fromCents(roundToMAD(Math.max(0, baseC - off)));
}

function hasRealPromo(p: any) {
  return !!p?.promo_eligible && Number(p?.promo_discount_value ?? 0) > 0;
}

/* ===== Skeleton ===== */
function PromoCardSkeleton() {
  return (
    <div className="card promo-card h-100 border-0 shadow-sm">
      <div className="promo-media placeholder w-100" />
      <div className="card-body">
        <div className="placeholder col-9 mb-2" style={{ height: 14, borderRadius: 6 }} />
        <div className="placeholder col-6 mb-3" style={{ height: 12, borderRadius: 6 }} />
        <div className="d-flex justify-content-between align-items-center">
          <div className="placeholder col-4" style={{ height: 14, borderRadius: 6 }} />
          <div className="placeholder col-3" style={{ height: 30, borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}

export default function PromotionsSection({
  title = "Promotions du moment",
  subtitle = "Profite des réductions disponibles aujourd’hui",
  limit = 12,
  channel = "all",
  onlyActive = true,
  ville,
  toAllLink = "/promos",
}: {
  title?: string;
  subtitle?: string;
  limit?: number;
  channel?: "all" | "african-food" | "african-market";
  onlyActive?: boolean;
  ville?: string;
  toAllLink?: string;
}) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function fetchPromos() {
    setLoading(true);
    setErr(null);

    try {
      // ✅ Endpoint dédié
      try {
        const query: any = { limit };
        if (onlyActive) query.onlyActive = 1;
        if (channel && channel !== "all") query.channel = channel;
        if (ville) query.ville = ville;

        const res = await api.get<Product[]>("/api/products/promotions", { query });
        const filtered = (res || []).filter((p: any) => hasRealPromo(p));
        setItems(filtered.slice(0, limit));
        setLoading(false);
        return;
      } catch {
        // fallback
      }

      // ✅ Fallback: list + filter
      const pageSize = Math.max(limit * 3, 40);
      const query: any = { page: 1, pageSize };
      if (onlyActive) query.onlyActive = 1;
      if (ville) query.ville = ville;

      let list: any;

      if (channel === "all") {
        list = await api.get<{ items: Product[] }>("/api/products", { query });
      } else {
        const path =
          channel === "african-food"
            ? "/api/products/african-food"
            : "/api/products/african-market";
        list = await api.get<{ items: Product[] }>(path, { query });
      }

      const arr = (list?.items || []).filter((p: any) => hasRealPromo(p));
      setItems(arr.slice(0, limit));
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, channel, onlyActive, ville]);

  const computed = useMemo(() => {
    return items.map((p: any) => {
      const type: PromoDiscountType = p?.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";
      const value = toNum(p?.promo_discount_value ?? 0);
      const basePrice = toNum(p?.price ?? 0);
      const promoPrice = computePromoPriceStable(basePrice, type, value);
      const cover = p?.cover || (p?.images?.[0]?.url ?? null);

      const saved =
        type === "PERCENT" ? `${Math.round(value)}%` : `${moneyMAD(value)}`;

      return { p, promoPrice, basePrice, cover, saved };
    });
  }, [items]);

  return (
    <section className="promo-section my-4">
      <style>{`
        .promo-section{
          border-radius: var(--duu-radius-md);
          background:
            radial-gradient(1200px 220px at 20% 0%, rgba(255,213,79,.35), transparent 60%),
            radial-gradient(900px 240px at 85% 10%, rgba(229,57,53,.10), transparent 55%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
          padding: 18px;
          border: 1px solid rgba(0,0,0,.06);
        }
        .promo-head{
          display:flex; gap:12px; align-items:flex-start; justify-content:space-between;
          margin-bottom: 12px;
        }
        .promo-title{
          margin:0;
          font-weight: 900;
          letter-spacing: .2px;
          color: var(--duu-black);
        }
        .promo-sub{
          margin:4px 0 0 0;
          color: rgba(0,0,0,.60);
          font-size: .95rem;
        }
        .promo-actions{
          display:flex; gap:10px; align-items:center;
          flex-wrap: wrap;
        }
        .btn-duu-soft{
          background: rgba(255,213,79,.35);
          color: var(--duu-black);
          border: 1px solid rgba(0,0,0,.08);
        }
        .btn-duu-soft:hover{ filter: brightness(.98); }
        .promo-grid{
          display:grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 12px;
        }
        .promo-col{ grid-column: span 12; }
        @media(min-width: 576px){ .promo-col{ grid-column: span 6; } }
        @media(min-width: 992px){ .promo-col{ grid-column: span 3; } }
        .promo-card{
          border-radius: var(--duu-radius-md);
          overflow: hidden;
          transition: transform .15s ease, box-shadow .15s ease;
          box-shadow: var(--duu-shadow-sm);
        }
        .promo-card:hover{
          transform: translateY(-2px);
          box-shadow: var(--duu-shadow-md) !important;
        }
        .promo-media{
          aspect-ratio: 1 / 1;
          object-fit: cover;
          background: rgba(0,0,0,.04);
        }
        .promo-badge{
          position:absolute;
          top: 10px;
          left: 10px;
          background: var(--duu-red);
          color:#fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 900;
          font-size: .78rem;
          box-shadow: var(--duu-shadow-sm);
        }
        .promo-shop{
          color: rgba(0,0,0,.6);
          font-size: .85rem;
        }
        .price-line{ display:flex; align-items:baseline; gap:10px; flex-wrap: wrap; }
        .price-now{ font-weight: 900; color: var(--duu-black); }
        .price-old{
          color: rgba(0,0,0,.45);
          text-decoration: line-through;
          font-weight: 700;
          font-size: .9rem;
        }
        .save-pill{
          background: rgba(229,57,53,.10);
          color: var(--duu-red);
          border: 1px solid rgba(229,57,53,.20);
          padding: 4px 8px;
          border-radius: 999px;
          font-weight: 800;
          font-size: .75rem;
        }
      `}</style>

      <div className="promo-head">
        <div>
          <h2 className="promo-title">{title}</h2>
          <p className="promo-sub">{subtitle}</p>
        </div>

        <div className="promo-actions">
          <button className="btn btn-sm btn-outline-dark" onClick={fetchPromos} disabled={loading}>
            Actualiser
          </button>
          <Link className="btn btn-sm btn-duu btn-duu-soft" to={toAllLink}>
            Voir tout
          </Link>
        </div>
      </div>

      {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

      {loading ? (
        <div className="promo-grid">
          {Array.from({ length: Math.min(limit, 8) }).map((_, i) => (
            <div className="promo-col" key={i}>
              <PromoCardSkeleton />
            </div>
          ))}
        </div>
      ) : computed.length === 0 ? (
        <div className="text-muted">Aucune promotion disponible pour le moment.</div>
      ) : (
        <div className="promo-grid">
          {computed.map(({ p, promoPrice, basePrice, cover, saved }: any) => (
            <div className="promo-col" key={p.id}>
              <div className="card promo-card h-100 border-0 shadow-sm">
                <div className="position-relative">
                  {cover ? (
                    <img src={imgUrl(cover)} alt={p.name} className="promo-media w-100" />
                  ) : (
                    <div className="promo-media w-100 d-flex align-items-center justify-content-center text-muted">
                      Pas d’image
                    </div>
                  )}

                  <div className="promo-badge">PROMO</div>
                </div>

                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div className="fw-semibold text-truncate" title={p.name} style={{ maxWidth: "100%" }}>
                      {p.name}
                    </div>
                    <span className="save-pill">- {saved}</span>
                  </div>

                  <div className="promo-shop mt-1 text-truncate">
                    {p.shop_name ? p.shop_name : "—"}
                  </div>

                  <div className="price-line mt-2">
                    <span className="price-now">{moneyMAD(promoPrice)}</span>
                    <span className="price-old">{moneyMAD(basePrice)}</span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <small className="text-muted">Stock: {Number((p as any).stock ?? 0)}</small>
                    <Link className="btn btn-sm btn-duu" to={`/products/${p.id}`}>
                      Voir
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
