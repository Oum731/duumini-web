// src/pages/PromotionsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import { api } from "../services/http";
import type { Product } from "../services/products";
import { getPromoMeta, isRealPromo } from "../lib/promotions";
import CanKickLottie, { type CanOffer } from "../components/CanKickLottie";
import { LoadingState } from "../components/ui/Spinner";
import { Seo } from "../components/Seo";

const PROMO_END_ISO = "2026-01-22T23:59:59+01:00";

/* =========================
 * Helpers UI
 * ========================= */

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

/* =========================
 * Filtres "produits CAN"
 * ========================= */

function normToken(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function subToken(p: any) {
  const bySlug = normToken(p?.sub_category_slug);
  if (bySlug) return bySlug;

  const byName = normToken(p?.sub_category_name);
  if (byName) return byName;

  const id = p?.sub_category_id;
  if (id != null && String(id).trim() !== "") return normToken(String(id));

  return "";
}

function isFoodLike(p: any) {
  const t = subToken(p);
  if (t) return t === "food" || t.includes("food") || t.includes("alimentation");
  return normToken(p?.category) === "food";
}

function looksLikeDrink(p: any) {
  const name = normToken(p?.name);
  const cat =
    normToken(p?.category_name) ||
    normToken(p?.category_slug) ||
    normToken(p?.category) ||
    "";

  const sub = normToken(p?.sub_category_name) || normToken(p?.sub_category_slug) || "";
  const hay = `${name} ${cat} ${sub}`;

  return (
    hay.includes("boisson") ||
    hay.includes("boissons") ||
    hay.includes("soda") ||
    hay.includes("cola") ||
    hay.includes("jus") ||
    hay.includes("eau") ||
    hay.includes("energy") ||
    hay.includes("canette") ||
    hay.includes("cannette")
  );
}

function isCanProductOffer(p: any) {
  if (Number(p?.promo_can ?? 0) === 1) return true;
  if (isFoodLike(p)) return false;
  if (looksLikeDrink(p)) return false;
  return true;
}

/* =========================
 * Safe unwrap API response
 * ========================= */
function unwrap<T>(res: any): T {
  if (res == null) return res as T;
  if (Array.isArray(res)) return res as T;
  if (typeof res === "object") {
    if ("items" in res) return res as T;
    if ("data" in res) return (res as any).data as T;
    if ("result" in res) return (res as any).result as T;
  }
  return res as T;
}

function asArray<T>(x: any): T[] {
  const v = unwrap<any>(x);
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object" && Array.isArray(v.items)) return v.items;
  return [];
}

/* =========================
 * Header animé isolé (IMPORTANT iOS)
 * ========================= */
const PromoHeader = React.memo(function PromoHeader({
  offer,
  loading,
  onRefresh,
}: {
  offer: CanOffer;
  loading: boolean;
  onRefresh: () => void;
}) {
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

  return (
    <div className="can-card mb-3">
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
        .can-title{
          font-weight: 950;
          letter-spacing: .2px;
          margin: 0;
          color: #111;
          line-height: 1.15;
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
        @keyframes canPulseSoon   { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
        @keyframes canPulseD1     { 0%{transform:scale(1)} 50%{transform:scale(1.07)} 100%{transform:scale(1)} }
        .pulse-normal{ animation: canPulseNormal 1.25s ease-in-out infinite; }
        .pulse-soon{ animation: canPulseSoon 1.05s ease-in-out infinite; }
        .pulse-d1{ animation: canPulseD1 .78s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){
          .pulse-normal, .pulse-soon, .pulse-d1{ animation:none; }
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

      <div className="can-grid">
        <div className="can-anim-wrap">
          <CanKickLottie variant="hero" className="w-100 h-100" offer={offer} blink={blink} />
        </div>

        <div className="can-text">
          <h2 className="can-title">{offer.title}</h2>
          <p className="can-sub">Fin le 22 janvier 2026</p>

          <div className="can-meta">
            <span className={`can-count ${pulseClass}`}>
              ⏳ {cd.isOver ? "Terminé" : `${cd.days}j ${timeStr}`}
            </span>

            <button
              type="button"
              className="btn btn-sm btn-outline-dark ms-auto"
              onClick={onRefresh}
              disabled={loading}
              title="Actualiser"
            >
              {loading ? "…" : "Actualiser"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function PromotionsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const offer: CanOffer = useMemo(
    () => ({
      label: "OFFRE CAN 2025",
      title: "Promo & Livraison Casablanca 25 DH • Hors Casablanca dès 60 DH (selon la ville).",
    }),
    []
  );

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      try {
        const res = await api.get<any>("/api/products/promotions", {
          query: { limit: 250, onlyActive: 1 },
        });
        const arr = asArray<Product>(res);
        setItems(arr.filter(isRealPromo));
        return;
      } catch {
        // fallback
      }

      const res2 = await api.get<any>("/api/products", {
        query: { page: 1, pageSize: 250, onlyActive: 1 },
      });
      const arr2 = asArray<Product>(res2);
      setItems(arr2.filter(isRealPromo));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const canItems = useMemo(() => {
    const list = (items || []).filter((p: any) => isCanProductOffer(p));
    return [...list].sort(
      (a: any, b: any) => Number(b?.promo_discount_value ?? 0) - Number(a?.promo_discount_value ?? 0)
    );
  }, [items]);

  // ✅ IMPORTANT: on mémorise le rendu de la grille => pas de rerender sur le timer du header
  const grid = useMemo(() => {
    if (loading) return <LoadingState label="Chargement des offres CAN…" />;

    if (canItems.length === 0) {
      return (
        <div className="alert alert-light border small">
          Aucune offre CAN pour le moment. Revenez bientôt 👀
        </div>
      );
    }

    return (
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
    );
  }, [canItems, loading]);

  return (
    <div className="container-xxl py-4">
      <Seo
        title="Promotions"
        description="Profitez des offres et promotions en cours sur DUUMINI, à travers l'Afrique."
        path="/promos"
      />
      <PromoHeader offer={offer} loading={loading} onRefresh={fetchPromos} />

      {err && <div className="alert alert-danger py-2">{err}</div>}

      {grid}
    </div>
  );
}
