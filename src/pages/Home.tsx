// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import InstallPWA from "../components/InstallPWA";
import CategoriesMenu from "../components/CategoriesMenu";
import PromotionsCarousel from "../components/PromotionsCarousel"; // ✅ ré-activé
import { listProducts, type Product } from "../services/products";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";
import { API_BASE } from "../services/http";

/* ===== Opening config ===== */
export const DUUMINI_SLOGAN = "Les goûts de ton pays, partout où tu te trouves";
export const DUUMINI_OPEN_ISO = "2025-12-21T20:00:00+01:00";
export const CAN_PROMO_END_ISO = "2026-01-22T23:59:59+01:00"; // ✅ utilisé ici

/* 📞 WhatsApp infos (utilisé uniquement en mode fermeture) */
const DUUMINI_WHATSAPP = "+212623677884";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} MAD`;
}

/* ===== Countdown Hook (fermeture) ===== */
function useCountdown(targetIso: string) {
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}

/* ===== Offline banner ===== */
function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="alert alert-warning rounded-0 text-center small m-0">
      Vous êtes hors-ligne.
    </div>
  );
}

/* ===== PAGE FERMETURE (TA VERSION) ===== */
function LaunchOnlyPage() {
  const cd = useCountdown(DUUMINI_OPEN_ISO);

  const wa = DUUMINI_WHATSAPP.replace(/\D/g, "");
  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(
    "Bonjour Duumini 👋 Je souhaite plus d’informations sur le lancement."
  )}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(900px 420px at 15% 0%, rgba(255,213,79,.35), transparent 60%), radial-gradient(900px 320px at 90% 10%, rgba(229,57,53,.16), transparent 55%), #fafafa",
      }}
      className="d-flex align-items-start justify-content-center pt-4 pb-4"
    >
      <style>{`
        .blink-emoji{
          animation: blinkEmoji .8s infinite;
          display:inline-block;
        }
        @keyframes blinkEmoji{
          0%{ opacity:1; transform:scale(1); }
          50%{ opacity:.25; transform:scale(.8); }
          100%{ opacity:1; transform:scale(1); }
        }

        .launch-shell { width: 100%; }
        .launch-card { border-radius: 18px; }
        .launch-hero { padding: 14px 14px 10px; background: #FFD54F; }
        .launch-body { padding: 14px; }
        .launch-countdown { font-variant-numeric: tabular-nums; }
        .launch-note { line-height: 1.25; }

        .announce-pulse-wrap{
          background:#FFD54F;
          position:relative;
          overflow:hidden;
        }
        .announce-pulse-wrap::before{
          content:"";
          position:absolute;
          inset: -20%;
          background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.65), transparent 55%);
          opacity:.0;
          transform: scale(.95);
          animation: announceGlow 1.6s ease-in-out infinite;
          pointer-events:none;
        }
        @keyframes announceGlow{
          0%{ opacity:.05; transform: scale(.97); }
          50%{ opacity:.45; transform: scale(1.02); }
          100%{ opacity:.05; transform: scale(.97); }
        }

        .announce-img{
          display:block;
          width:100%;
          max-height:460px;
          object-fit:contain;
          transform: translateZ(0);
          animation: announceScale 1.6s ease-in-out infinite;
        }
        @keyframes announceScale{
          0%{ transform: scale(1); }
          50%{ transform: scale(1.015); }
          100%{ transform: scale(1); }
        }

        @media (max-width: 420px){
          .launch-body { padding: 12px; }
          .launch-hero { padding: 12px; }
          .announce-img{ max-height: 420px; }
        }
      `}</style>

      <OfflineBanner />

      <div className="container launch-shell" style={{ maxWidth: 720 }}>
        <div className="card border-0 shadow-lg overflow-hidden launch-card">
          <div className="launch-hero d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2 fw-bold">
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#111",
                  color: "#fff",
                }}
                className="d-flex align-items-center justify-content-center"
              >
                D
              </div>
              DUUMINI
            </div>
            <span className="badge bg-dark">
              <span className="blink-emoji">🔥</span> LANCEMENT
            </span>
          </div>

          <div className="announce-pulse-wrap">
            <img
              src="/annonce.jpeg"
              alt="Annonce Duumini"
              className="announce-img"
              loading="eager"
            />
          </div>

          <div className="card-body d-flex flex-column gap-3 launch-body">
            <div className="d-flex flex-column gap-1">
              <h1 className="h5 fw-bold m-0">
                Ouverture le 21 décembre 2025 à 20h{" "}
                <span className="blink-emoji">🎉</span>
              </h1>
              <p className="text-muted m-0 launch-note">
                MAroc • Paiement à la livraison
              </p>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-light text-dark p-2 launch-countdown">
                ⏳ {cd.days}j {cd.hours}h {cd.mins}m {cd.secs}s
              </span>
              <span className="small text-muted fw-semibold">
                WhatsApp pour être informé <span className="blink-emoji">👇</span>
              </span>
            </div>

            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-success fw-bold"
            >
              💬 WhatsApp – plus d’infos
            </a>

            <InstallPWA />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Mini product card (carrousel) ===== */
function MiniCard({ product, href }: { product: Product; href: string }) {
  const anyP = product as any;
  const image = anyP.cover || anyP.image || anyP.images?.[0]?.url || null;
  const name = anyP.name ?? "Produit";
  const price = anyP.price_client ?? anyP.price ?? 0;

  return (
    <Link
      to={href}
      className="text-reset text-decoration-none d-inline-block"
      style={{ width: 176 }}
      title={name}
    >
      <div
        className="card border-0 shadow-sm overflow-hidden"
        style={{ borderRadius: 16 }}
      >
        <div style={{ height: 128 }} className="bg-light position-relative">
          {image ? (
            <img
              src={imgUrl(image)}
              alt={name}
              className="w-100 h-100"
              style={{ objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted small">
              Image indisponible
            </div>
          )}
        </div>

        <div className="card-body p-2">
          <div className="small fw-semibold text-truncate">{name}</div>
          <div className="small" style={{ color: "var(--duu-black)" }}>
            {moneyMAD(price)}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ===== Carrousel horizontal (scroll-snap) + auto-scroll ===== */
function AutoCarousel({
  items,
  itemHref,
  autoMs = 2600,
}: {
  items: Product[];
  itemHref: (p: Product) => string;
  autoMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!items.length) return;
    const el = ref.current;
    if (!el) return;

    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const node = ref.current;
      if (!node) return;

      const step = 196;
      const max = node.scrollWidth - node.clientWidth;

      if (node.scrollLeft >= max - 8) {
        node.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      node.scrollBy({ left: step, behavior: "smooth" });
    };

    const id = window.setInterval(tick, autoMs);

    const stop = () => {
      stopped = true;
      window.clearInterval(id);
    };

    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("mousedown", stop);

    return () => {
      window.clearInterval(id);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("mousedown", stop);
    };
  }, [items.length, autoMs]);

  return (
    <>
      <div
        ref={ref}
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 6,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        className="duu-track"
      >
        {items.map((p) => (
          <div key={(p as any).id} style={{ scrollSnapAlign: "start" }}>
            <MiniCard product={p} href={itemHref(p)} />
          </div>
        ))}
      </div>

      <style>{`
        .duu-track::-webkit-scrollbar{ height: 8px; }
        .duu-track::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,.18);
          border-radius: 10px;
        }
        .duu-track::-webkit-scrollbar-track{
          background: rgba(0,0,0,.06);
          border-radius: 10px;
        }
      `}</style>
    </>
  );
}

/* ===== Grouping helpers ===== */
function groupByCategoryId(items: Product[]) {
  const m: Record<number, Product[]> = {};
  for (const p of items) {
    const cid = Number((p as any).category_id || 0);
    if (!cid) continue;
    if (!m[cid]) m[cid] = [];
    m[cid].push(p);
  }
  return m;
}

function pickSectionVariant(i: number) {
  const v = i % 3;
  if (v === 0) return "yellow";
  if (v === 1) return "red";
  return "dark";
}

/* ===== HOME ===== */
export default function Home() {
  const navigate = useNavigate();

  /* ===== Opening gate ===== */
  const openAt = useMemo(() => new Date(DUUMINI_OPEN_ISO).getTime(), []);
  const promoEndAt = useMemo(() => new Date(CAN_PROMO_END_ISO).getTime(), []);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const isOpen = now >= openAt;

  // ✅ PROMO active UNIQUEMENT après ouverture (et jusqu'à la fin de promo)
  const isPromoLive = now >= openAt && now <= promoEndAt;

  /* ===== Data ===== */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [, setSubs] = useState<SubCategory[]>([]);
  const [food, setFood] = useState<Product[]>([]);
  const [market, setMarket] = useState<Product[]>([]);

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<number | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const [catsRes, subsRes, foodRes, marketRes] = await Promise.all([
          listCategories({ page: 1, pageSize: 500 }),
          listSubCategories({ page: 1, pageSize: 2000 }),
          listProducts({
            page: 1,
            pageSize: 240,
            channel: "african-food",
            onlyActive: true,
          } as any),
          listProducts({
            page: 1,
            pageSize: 240,
            channel: "african-market",
            onlyActive: true,
          } as any),
        ]);

        if (cancelled) return;

        setCategories(catsRes.items || []);
        setSubs(subsRes.items || []);
        setFood(foodRes.items || []);
        setMarket(marketRes.items || []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriesById = useMemo(() => {
    const m: Record<number, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const foodByCat = useMemo(() => groupByCategoryId(food), [food]);
  const marketByCat = useMemo(() => groupByCategoryId(market), [market]);

  const categoryIdsWithProducts = useMemo(() => {
    const set = new Set<number>();
    for (const k of Object.keys(foodByCat)) {
      if ((foodByCat[Number(k)] || []).length) set.add(Number(k));
    }
    for (const k of Object.keys(marketByCat)) {
      if ((marketByCat[Number(k)] || []).length) set.add(Number(k));
    }

    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ca = (foodByCat[a]?.length || 0) + (marketByCat[a]?.length || 0);
      const cb = (foodByCat[b]?.length || 0) + (marketByCat[b]?.length || 0);
      return cb - ca;
    });

    return arr;
  }, [foodByCat, marketByCat]);

  function toProduct(p: Product) {
    const anyP = p as any;
    const idOrSlug = anyP.slug || anyP.id;
    return `/products/${idOrSlug}`;
  }

  // ✅ redirection intelligente (sans afficher Food/Market)
  function routeForCategorySlug(catSlug: string, categoryId: number) {
    const hasFood = (foodByCat[categoryId] || []).length > 0;
    const hasMarket = (marketByCat[categoryId] || []).length > 0;
    if (hasFood) return `/african-food/${catSlug}`;
    if (hasMarket) return `/african-market/${catSlug}`;
    return `/african-market`;
  }

  function routeForSubSlug(categoryId: number, catSlug: string, subSlug: string) {
    const hasFood = (foodByCat[categoryId] || []).length > 0;
    const hasMarket = (marketByCat[categoryId] || []).length > 0;
    if (hasFood) return `/african-food/${catSlug}/${subSlug}`;
    if (hasMarket) return `/african-market/${catSlug}/${subSlug}`;
    return `/african-market`;
  }

  // ✅ AVANT OUVERTURE : on retourne TA page fermeture (inchangée)
  if (!isOpen) return <LaunchOnlyPage />;

  return (
    <div className="pb-4" style={{ background: "#f8f9fa" }}>
      <style>{`
        .home-wrap{
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(255,213,79,.18), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(229,57,53,.10), transparent 55%),
            #f8f9fa;
          min-height: 100%;
        }

        .sec{
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,.08);
          background: #fff;
          overflow: hidden;
          box-shadow: 0 10px 26px rgba(0,0,0,.05);
        }
        .sec-head{
          padding: 12px 14px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .head-yellow{ background: linear-gradient(90deg, rgba(255,213,79,.55), rgba(255,213,79,.10)); }
        .head-red{ background: linear-gradient(90deg, rgba(229,57,53,.18), rgba(229,57,53,.06)); }
        .head-dark{ background: linear-gradient(90deg, rgba(17,17,17,.12), rgba(17,17,17,.04)); }

        .soft-action{
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 999px;
          padding: 6px 10px;
          font-weight: 900;
          background: rgba(255,255,255,.65);
          text-decoration: none;
          color: var(--duu-black);
          white-space: nowrap;
        }
        .soft-action:hover{ color: var(--duu-red); border-color: rgba(0,0,0,.20); }

        .filter-bar{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          margin-top: 10px;
        }

        .duu-filter-btn .btn,
        .duu-filter-btn .dropdown > .btn,
        .duu-filter-btn > .btn{
          border-color: rgba(0,0,0,.22) !important;
          color: var(--duu-black) !important;
          background: rgba(255,255,255,.92) !important;
          font-weight: 900;
          border-radius: 14px !important;
          padding: 10px 12px !important;
        }
        .duu-filter-btn .btn:hover,
        .duu-filter-btn .dropdown > .btn:hover,
        .duu-filter-btn > .btn:hover{
          border-color: rgba(0,0,0,.32) !important;
          color: var(--duu-red) !important;
          background: rgba(255,255,255,.98) !important;
        }
        .duu-filter-btn .btn:focus,
        .duu-filter-btn .dropdown > .btn:focus,
        .duu-filter-btn > .btn:focus,
        .duu-filter-btn .btn:focus-visible,
        .duu-filter-btn .dropdown > .btn:focus-visible,
        .duu-filter-btn > .btn:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(255,213,79,.40) !important;
          background: rgba(255,255,255,.98) !important;
          color: var(--duu-black) !important;
        }
        .duu-filter-btn .btn:active,
        .duu-filter-btn .dropdown > .btn:active,
        .duu-filter-btn > .btn:active{
          background: rgba(255,213,79,.20) !important;
          color: var(--duu-black) !important;
        }

        .filter-icon{
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.92);
          display:flex;
          align-items:center;
          justify-content:center;
        }
      `}</style>

      <div className="home-wrap pb-4">
        <OfflineBanner />

        <section className="container pt-3">
          <InstallPWA />

          {/* ✅ PROMO: active seulement après ouverture (et jusqu’à la fin de promo) */}
          {isPromoLive && (
            <div className="mt-2">
              <PromotionsCarousel />
            </div>
          )}

          {/* ✅ Juste le bouton Filtrer (pas de hero, pas de whatsapp, pas de paiement) */}
          <div className="filter-bar">
            <div className="duu-filter-btn d-flex align-items-center gap-2">
              <span className="filter-icon" aria-hidden="true">
                <SlidersHorizontal size={18} />
              </span>

              <CategoriesMenu
                title="Filtrer"
                variant="auto"
                activeCategoryId={activeCategoryId}
                activeSubCategoryId={activeSubCategoryId}
                onSelectCategory={(c) => {
                  setActiveCategoryId(c.id);
                  setActiveSubCategoryId(null);
                  navigate(routeForCategorySlug(String(c.slug || ""), c.id));
                }}
                onSelectSubCategory={(s) => {
                  setActiveSubCategoryId(s.id);
                  setActiveCategoryId(s.category_id);

                  const cat = categoriesById[s.category_id];
                  const catSlug = String(cat?.slug || "");
                  if (!catSlug) return;

                  navigate(
                    routeForSubSlug(s.category_id, catSlug, String(s.slug || ""))
                  );
                }}
              />
            </div>
          </div>

          {err && (
            <div className="alert alert-danger mt-3 d-flex justify-content-between align-items-center">
              <span>{err}</span>
              <button
                className="btn btn-sm"
                style={{
                  background: "var(--duu-yellow)",
                  border: "none",
                  fontWeight: 900,
                }}
                onClick={() => window.location.reload()}
              >
                Recharger
              </button>
            </div>
          )}

          {loading ? <div className="text-muted small mt-3">Chargement…</div> : null}

          {/* ✅ Sections catégories */}
          {!loading && !err && (
            <div className="d-flex flex-column gap-3 mt-3">
              {categoryIdsWithProducts.map((cid, idx) => {
                const cat = categoriesById[cid];
                if (!cat) return null;

                const f = foodByCat[cid] || [];
                const m = marketByCat[cid] || [];
                const total = f.length + m.length;
                if (total === 0) return null;

                const mixed = [...f.slice(0, 12), ...m.slice(0, 12)].slice(0, 18);

                const v = pickSectionVariant(idx);
                const headClass =
                  v === "yellow"
                    ? "head-yellow"
                    : v === "red"
                    ? "head-red"
                    : "head-dark";

                const mainLink = routeForCategorySlug(String(cat.slug || ""), cid);

                return (
                  <div key={cid} className="sec">
                    <div className={`sec-head ${headClass}`}>
                      <div className="min-w-0">
                        <div className="fw-bold text-truncate">{cat.name}</div>
                      </div>

                      <Link to={mainLink} className="soft-action">
                        Explorer <ChevronRight size={14} />
                      </Link>
                    </div>

                    <div className="p-3">
                      <AutoCarousel items={mixed} itemHref={toProduct} autoMs={2500} />
                    </div>
                  </div>
                );
              })}

              {!categoryIdsWithProducts.length && (
                <div className="text-center text-muted py-5">
                  Aucune catégorie avec produits pour le moment.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
