// src/pages/PromotionsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/http";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { getPromoMeta, isRealPromo } from "../lib/promotions";

function useBlink(ms = 650) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setInterval(() => setOn((v) => !v), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return on;
}

function isFood(p: any) {
  return String(p?.sub_category || p?.category || "").toLowerCase() === "food";
}

/** ✅ OFFRE CAN = produits (market) en promo, PAS boissons (tu peux ajuster) */
function isCanProductOffer(p: any) {
  // ✅ si tu ajoutes un champ dédié (recommandé)
  if (Number(p?.promo_can ?? 0) === 1) return true;

  // ✅ on exclut food
  if (isFood(p)) return false;

  // ✅ on exclut boissons/canettes/jus/etc.
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

  async function fetchPromos() {
    setLoading(true);
    setErr(null);
    try {
      try {
        const res = await api.get<Product[]>("/api/products/promotions", {
          query: { limit: 200, onlyActive: 1 },
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

  // ✅ CAN = seulement produits (hors food + hors boissons)
  const canItems = useMemo(() => items.filter((p: any) => isCanProductOffer(p)), [items]);

  return (
    <div className="container-xxl py-4">
      <style>{`
        .duu-can-hero{
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 18px;
          padding: 14px;
          background:
            radial-gradient(1200px 220px at 20% 0%, rgba(255,213,79,.35), transparent 60%),
            radial-gradient(900px 240px at 85% 10%, rgba(229,57,53,.10), transparent 55%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
        }
        .duu-can-chip{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:8px 12px;
          border-radius: 999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.70);
          font-weight: 900;
          flex-wrap: wrap;
        }
        .duu-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,.95);
          box-shadow: 0 0 0 3px rgba(229,57,53,.20);
        }
        .duu-dot.blink{ animation: duuBlink .7s infinite; }
        @keyframes duuBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .25; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }
        .duu-pill{
          background: var(--duu-red, #E53935);
          color:#fff;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: .78rem;
          font-weight: 900;
          letter-spacing: .2px;
        }
        .duu-sub{
          color: rgba(0,0,0,.60);
          font-weight: 700;
          font-size: .9rem;
        }
      `}</style>

      <div className="duu-can-hero mb-3">
        <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
          <div>
            <div className="duu-can-chip">
              <span className={`duu-dot ${blink ? "blink" : ""}`} />
              <span className="duu-pill">OFFRE CAN 🇲🇦</span>
              <span className="duu-sub">Promos spéciales sur les produits.</span>
            </div>
            <div className="small text-muted mt-2">
              ⏳ Offre limitée pendant la CAN. Profite maintenant !
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
