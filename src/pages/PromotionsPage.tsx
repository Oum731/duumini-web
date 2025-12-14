import { useEffect, useMemo, useState } from "react";
import { api } from "../services/http";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { getPromoMeta, isRealPromo } from "../lib/promotions";

/* =========================
   CONFIG CAN
   ========================= */
const PROMO_END_ISO = "2026-01-22T23:59:59+01:00"; // ✅ fin 22 janvier (heure Maroc)

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

/** ✅ OFFRE CAN = produits en promo (hors food + hors boissons) */
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

  const canItems = useMemo(() => items.filter((p: any) => isCanProductOffer(p)), [items]);

  return (
    <div className="container-xxl py-4">
      <style>{`
        .duu-hero{
          position: relative;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 20px;
          padding: 16px;
          overflow: hidden;
          background:
            radial-gradient(1100px 320px at 10% 0%, rgba(255,213,79,.35), transparent 60%),
            radial-gradient(900px 280px at 90% 10%, rgba(229,57,53,.16), transparent 55%),
            radial-gradient(700px 240px at 70% 90%, rgba(0,150,80,.08), transparent 60%),
            linear-gradient(180deg, rgba(17,17,17,.02), rgba(17,17,17,0));
        }
        .duu-hero:before{
          content:"";
          position:absolute; inset:0;
          background:
            linear-gradient(135deg, rgba(229,57,53,.08) 0%, transparent 40%),
            linear-gradient(45deg, rgba(255,213,79,.08) 0%, transparent 40%),
            repeating-linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.04) 1px, transparent 1px, transparent 18px);
          opacity:.55;
          pointer-events:none;
        }

        .duu-chip{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:8px 12px;
          border-radius: 999px;
          border: 1px dashed rgba(0,0,0,.18);
          background: rgba(255,255,255,.72);
          font-weight: 980;
          flex-wrap: wrap;
          max-width: 100%;
          position: relative;
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
          font-size: .80rem;
          font-weight: 980;
          letter-spacing: .25px;
        }
        .duu-pill.blink{ animation: duuPillBlink .85s infinite; }
        @keyframes duuPillBlink{
          0%{ filter: brightness(1); transform: scale(1); }
          50%{ filter: brightness(1.2); transform: scale(1.03); }
          100%{ filter: brightness(1); transform: scale(1); }
        }

        .duu-title{
          margin: 10px 0 4px 0;
          font-weight: 980;
          line-height: 1.12;
          letter-spacing: .2px;
          position: relative;
        }

        .duu-sub{
          color: rgba(0,0,0,.62);
          font-weight: 780;
          font-size: .95rem;
          position: relative;
        }

        .duu-meta{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top: 10px;
          position: relative;
        }

        .duu-badge{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:6px 10px;
          border-radius:999px;
          font-weight: 900;
          font-size: .82rem;
          background: rgba(255,255,255,.76);
          border: 1px solid rgba(0,0,0,.10);
          color: rgba(0,0,0,.78);
        }
        .duu-badge-strong{
          background: linear-gradient(90deg, rgba(229,57,53,.18), rgba(255,213,79,.20));
        }
        .duu-badge-green{
          background: rgba(0,150,80,.10);
        }

        .duu-note{
          margin-top: 8px;
          color: rgba(0,0,0,.56);
          font-size: .90rem;
          font-weight: 700;
          position: relative;
        }

        @media (max-width: 576px){
          .duu-hero{ padding: 14px; border-radius: 18px; }
          .duu-title{ font-size: 1.12rem; }
          .duu-sub{ font-size: .90rem; }
          .duu-badge{ font-size: .78rem; }
        }
      `}</style>

      <div className="duu-hero mb-3">
        <div className="d-flex flex-column flex-sm-row align-items-sm-start justify-content-between gap-2">
          <div style={{ minWidth: 0 }}>
            <div className="duu-chip">
              <span className={`duu-dot ${blink ? "blink" : ""}`} />
              <span className={`duu-pill ${blink ? "blink" : ""}`}>OFFRE CAN 🇲🇦</span>
              <span style={{ fontWeight: 900, color: "rgba(0,0,0,.75)" }}>
                Coupe d’Afrique • Maroc • Vibre CAN 2025 🔥
              </span>
            </div>

            <h1 className="duu-title">🏆 Offres CAN 2025 — Sélection “ambiance stade”</h1>
            <div className="duu-sub">
              Des promos pour supporters • Des prix qui font du bruit • Duumini en mode CAN
            </div>

            <div className="duu-meta">
              <span className="duu-badge duu-badge-strong">
                ⏳ {cd.isOver ? "Offre terminée" : `Reste ${cd.days}j ${timeStr}`}
              </span>
              <span className="duu-badge duu-badge-green">🇲🇦 Maroc</span>
              <span className="duu-badge">🎉 Prix CAN</span>
              <span className="duu-badge">🚚 Livraison offerte*</span>
            </div>

            <div className="duu-note">
              {cd.isOver ? (
                "⏳ L’offre CAN est terminée."
              ) : (
                <>
                  Fin le <b>22 janvier</b> • *Livraison offerte sur les produits éligibles.
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-dark"
            onClick={fetchPromos}
            disabled={loading}
            title="Actualiser"
            style={{ position: "relative" }}
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
