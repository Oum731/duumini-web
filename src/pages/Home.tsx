// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import InstallPWA from "../components/InstallPWA";
import CategoriesMenu from "../components/CategoriesMenu";

import {
  listProducts,
  type Product,
  getSiteStatus,
  type SiteStatus,
} from "../services/products";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories } from "../services/subCategories";
import { moneyMAD } from "../utils/money";
import { imgUrl } from "../utils/media";

/* ===== Offline banner ===== */
function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
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
    <div className="alert alert-warning rounded-0 text-center small m-0 fw-semibold">
      Vous êtes hors-ligne.
    </div>
  );
}

/* ===== Site closed full message ===== */
function SiteClosedOnly({
  siteStatus,
}: {
  siteStatus: SiteStatus | null;
}) {
  if (!siteStatus?.is_closed) return null;

  const message =
    String(siteStatus.message || "").trim() ||
    "Le site est temporairement fermé. Merci de revenir plus tard.";

  return (
    <section className="site-closed-only-wrap">
      <div className="site-closed-only-card">
        <div className="site-closed-only-bg" />
        <div className="site-closed-only-ring site-closed-only-ring--one" />
        <div className="site-closed-only-ring site-closed-only-ring--two" />

        <div className="site-closed-only-content">
          <div className="site-closed-only-lock">
            <div className="site-closed-only-lock-core">
              <Lock size={34} />
            </div>
          </div>

          <div className="site-closed-only-alert">
            <AlertTriangle size={18} />
            <span>Information importante</span>
          </div>

          <h1 className="site-closed-only-title">
            Le site est temporairement fermé
          </h1>

          <p className="site-closed-only-message">{message}</p>

          <div className="site-closed-only-note">
            Merci de revenir plus tard.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Mini product card ===== */
function MiniCard({
  product,
  href,
  hint,
}: {
  product: Product;
  href: string;
  hint?: string | null;
}) {
  const anyP = product as any;
  const image = anyP.cover || anyP.image || anyP.images?.[0]?.url || null;
  const name = anyP.name ?? "Produit";
  const price = anyP.promo_price_client ?? anyP.price_client ?? anyP.price ?? 0;

  return (
    <Link
      to={href}
      className="text-reset text-decoration-none d-inline-block home-mini-link"
      style={{ width: 190 }}
      title={hint ? `${name} — Voir toute la catégorie` : name}
    >
      <article className="home-mini-card">
        <div className="home-mini-media">
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

          <span className="home-mini-badge">Voir</span>
        </div>

        <div className="home-mini-body">
          <div className="home-mini-name" title={name}>{name}</div>
          <div className="home-mini-price">{moneyMAD(price)}</div>
          {hint ? <div className="home-mini-hint">{hint}</div> : null}
        </div>
      </article>
    </Link>
  );
}

/* ===== Horizontal carousel ===== */
function AutoCarousel({
  items,
  itemHref,
  itemHint,
  autoMs = 2600,
}: {
  items: Product[];
  itemHref: (p: Product) => string;
  itemHint?: (p: Product) => string | null;
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

      const step = 204;
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
    <div ref={ref} className="duu-track">
      {items.map((p) => (
        <div key={(p as any).id} className="duu-track-item">
          <MiniCard
            product={p}
            href={itemHref(p)}
            hint={itemHint ? itemHint(p) : null}
          />
        </div>
      ))}
    </div>
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
  if (v === 1) return "white";
  return "dark";
}

type Vertical = "MARKET";

export default function Home() {
  const navigate = useNavigate();
  const [activeVertical] = useState<Vertical>("MARKET");
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [siteStatusLoading, setSiteStatusLoading] = useState(true);

  const results = useQueries({
    queries: [
      {
        queryKey: ["categories", { page: 1, pageSize: 500 }],
        queryFn: () => listCategories({ page: 1, pageSize: 500 }),
        staleTime: 5 * 60 * 1000,
        enabled: !siteStatus?.is_closed,
      },
      {
        queryKey: ["subCategories", { page: 1, pageSize: 2000 }],
        queryFn: () => listSubCategories({ page: 1, pageSize: 2000 }),
        staleTime: 10 * 60 * 1000,
        enabled: !siteStatus?.is_closed,
      },
      {
        queryKey: ["homeProducts", "african-market"],
        queryFn: () =>
          listProducts({
            page: 1,
            pageSize: 240,
            channel: "african-market",
            onlyActive: true,
          } as any),
        staleTime: 3 * 60 * 1000,
        enabled: !siteStatus?.is_closed,
      },
    ],
  });

  const catsQ = results[0];
  const subsQ = results[1];
  const marketQ = results[2];

  const loading =
    !siteStatus?.is_closed &&
    (catsQ.isLoading || subsQ.isLoading || marketQ.isLoading);

  const err =
    !siteStatus?.is_closed
      ? (catsQ.error as any)?.message ||
        (subsQ.error as any)?.message ||
        (marketQ.error as any)?.message ||
        null
      : null;

  const categories = (catsQ.data?.items || []) as Category[];
  const market = (marketQ.data?.items || []) as Product[];

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setSiteStatusLoading(true);
        const res = await getSiteStatus();
        if (!mounted) return;
        setSiteStatus(res);
      } catch {
        if (!mounted) return;
        setSiteStatus(null);
      } finally {
        if (mounted) setSiteStatusLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const categoriesById = useMemo(() => {
    const m: Record<number, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const marketByCat = useMemo(() => groupByCategoryId(market), [market]);

  function rootForVertical() {
    return "/african-market";
  }

  function routeForCategorySlug(catSlug: string) {
    return `${rootForVertical()}/${catSlug}`;
  }

  function routeForSubSlug(catSlug: string, subSlug: string) {
    return `${rootForVertical()}/${catSlug}/${subSlug}`;
  }

  const activeMap = useMemo(() => marketByCat, [marketByCat]);

  const categoryIdsWithProducts = useMemo(() => {
    const set = new Set<number>();
    for (const k of Object.keys(activeMap)) {
      const cid = Number(k);
      if ((activeMap[cid] || []).length) set.add(cid);
    }

    const arr = Array.from(set);
    arr.sort(
      (a, b) => (activeMap[b]?.length || 0) - (activeMap[a]?.length || 0),
    );
    return arr;
  }, [activeMap]);

  function itemHrefForProduct(p: Product) {
    const anyP = p as any;
    const cid = Number(anyP.category_id || 0);
    const cat = cid ? categoriesById[cid] : null;
    const catSlug = String((cat as any)?.slug || "").trim();
    if (cid && catSlug) return routeForCategorySlug(catSlug);
    return rootForVertical();
  }

  function hintForProduct(p: Product) {
    const anyP = p as any;
    const cid = Number(anyP.category_id || 0);
    const cat = cid ? categoriesById[cid] : null;
    const name = String((cat as any)?.name || "").trim();
    return name ? `Catégorie : ${name}` : null;
  }

  const siteClosed = !!siteStatus?.is_closed;

  return (
    <div className="home-page">
      <style>{`
        .home-page{
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.12), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.06), transparent 55%),
            #f8f9fa;
          min-height: 100%;
        }

        .home-shell{
          padding-bottom: 32px;
        }

        .site-closed-only-wrap{
          min-height: calc(100vh - 140px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px 0 24px;
          animation: siteClosedWrapIn .45s ease;
        }

        .site-closed-only-card{
          position: relative;
          width: 100%;
          max-width: 760px;
          overflow: hidden;
          border-radius: 30px;
          padding: 28px 22px;
          background:
            linear-gradient(145deg, rgba(17,17,17,.985), rgba(31,31,31,.965));
          border: 1px solid rgba(255,255,255,.08);
          box-shadow:
            0 24px 64px rgba(0,0,0,.20),
            0 0 0 1px rgba(255,255,255,.02) inset;
        }

        .site-closed-only-bg{
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(circle at 18% 18%, rgba(var(--duu-yellow-rgb),.22), transparent 26%),
            radial-gradient(circle at 82% 24%, rgba(255,255,255,.08), transparent 18%),
            radial-gradient(circle at 50% 100%, rgba(229,57,53,.22), transparent 28%);
          animation: siteClosedGlow 6s ease-in-out infinite alternate;
          pointer-events: none;
        }

        .site-closed-only-ring{
          position: absolute;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.06);
          pointer-events: none;
        }

        .site-closed-only-ring--one{
          width: 220px;
          height: 220px;
          top: -70px;
          right: -50px;
          animation: siteClosedFloat 7s ease-in-out infinite;
        }

        .site-closed-only-ring--two{
          width: 160px;
          height: 160px;
          left: -40px;
          bottom: -40px;
          animation: siteClosedFloat 8s ease-in-out infinite reverse;
        }

        .site-closed-only-content{
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .site-closed-only-lock{
          position: relative;
          margin-bottom: 16px;
        }

        .site-closed-only-lock::before{
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: 999px;
          background: rgba(var(--duu-yellow-rgb), .10);
          animation: siteClosedPulse 1.9s ease-in-out infinite;
        }

        .site-closed-only-lock-core{
          position: relative;
          width: 84px;
          height: 84px;
          border-radius: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(var(--duu-yellow-rgb), .14);
          color: var(--duu-yellow);
          border: 1px solid rgba(var(--duu-yellow-rgb), .22);
          box-shadow: 0 16px 34px rgba(0,0,0,.16);
          backdrop-filter: blur(4px);
        }

        .site-closed-only-alert{
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
          color: #fff1bf;
          font-size: .86rem;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .site-closed-only-title{
          margin: 0 0 10px;
          color: #fff;
          font-weight: 950;
          line-height: 1.06;
          letter-spacing: -.03em;
          font-size: clamp(1.7rem, 3.4vw, 2.7rem);
          max-width: 620px;
        }

        .site-closed-only-message{
          margin: 0;
          max-width: 620px;
          color: rgba(255,255,255,.84);
          font-size: 1rem;
          line-height: 1.65;
          font-weight: 600;
        }

        .site-closed-only-note{
          margin-top: 18px;
          color: rgba(255,255,255,.62);
          font-size: .9rem;
          font-weight: 700;
        }

        @keyframes siteClosedWrapIn{
          from{
            opacity: 0;
            transform: translateY(10px);
          }
          to{
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes siteClosedGlow{
          0%{
            transform: translate3d(0,0,0) scale(1);
          }
          100%{
            transform: translate3d(10px,-8px,0) scale(1.03);
          }
        }

        @keyframes siteClosedPulse{
          0%,100%{
            transform: scale(1);
            opacity: .55;
          }
          50%{
            transform: scale(1.08);
            opacity: .15;
          }
        }

        @keyframes siteClosedFloat{
          0%,100%{
            transform: translateY(0px);
          }
          50%{
            transform: translateY(10px);
          }
        }

        .home-hero{
          border-radius: var(--duu-radius-xl);
          border: 1px solid rgba(0,0,0,.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.94));
          box-shadow: var(--duu-shadow-lg);
          padding: 20px;
          overflow: hidden;
          position: relative;
        }

        .home-hero::before{
          content:"";
          position:absolute;
          inset:0;
          background:
            radial-gradient(420px 220px at 10% 0%, rgba(var(--duu-yellow-rgb),.18), transparent 60%),
            radial-gradient(320px 220px at 95% 20%, rgba(var(--duu-red-rgb),.10), transparent 55%);
          pointer-events:none;
        }

        .home-hero-inner{
          position: relative;
          z-index: 1;
        }

        .home-badges{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          margin-top: 16px;
        }

        .home-badge{
          display:inline-flex;
          align-items:center;
          gap:8px;
          border-radius:999px;
          background:#fff;
          border:1px solid rgba(0,0,0,.08);
          padding:8px 12px;
          font-size:.84rem;
          font-weight:800;
          color: var(--duu-black);
          box-shadow: var(--duu-shadow-sm);
        }

        .home-top-actions{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:10px;
          margin-top: 18px;
        }

        .home-market-pill{
          border-radius:999px !important;
          font-weight:900 !important;
          padding:10px 16px !important;
          box-shadow: 0 10px 20px rgba(0,0,0,.08);
        }

        .soft-action{
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 999px;
          padding: 10px 14px;
          font-weight: 900;
          background: #fff;
          text-decoration: none;
          color: var(--duu-black);
          white-space: nowrap;
          display:inline-flex;
          align-items:center;
          gap: 6px;
          box-shadow: var(--duu-shadow-sm);
          transition: .18s ease;
        }
        .soft-action:hover{
          color: var(--duu-black);
          transform: translateY(-1px);
          border-color: rgba(0,0,0,.16);
        }

        .home-toolbar{
          margin-top: 18px;
          display:flex;
          align-items:center;
          justify-content:flex-start;
        }

        .duu-filter-btn .btn,
        .duu-filter-btn .dropdown > .btn,
        .duu-filter-btn > .btn{
          border-color: rgba(0,0,0,.10) !important;
          color: var(--duu-black) !important;
          background: #fff !important;
          font-weight: 900;
          border-radius: var(--duu-radius-sm) !important;
          min-height: 46px;
          padding: 10px 14px !important;
          box-shadow: var(--duu-shadow-sm);
        }
        .duu-filter-btn .btn:hover,
        .duu-filter-btn .dropdown > .btn:hover,
        .duu-filter-btn > .btn:hover{
          border-color: rgba(0,0,0,.18) !important;
          background: #fff !important;
          color: var(--duu-black) !important;
        }
        .duu-filter-btn .btn:focus,
        .duu-filter-btn .dropdown > .btn:focus,
        .duu-filter-btn > .btn:focus,
        .duu-filter-btn .btn:focus-visible,
        .duu-filter-btn .dropdown > .btn:focus-visible,
        .duu-filter-btn > .btn:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb),.35) !important;
        }

        .filter-icon{
          width: 46px;
          height: 46px;
          border-radius: var(--duu-radius-sm);
          border: 1px solid rgba(0,0,0,.10);
          background: #fff;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow: var(--duu-shadow-sm);
        }

        .home-mini-link{
          transition: transform .18s ease;
        }
        .home-mini-link:hover{
          transform: translateY(-2px);
        }

        .home-mini-card{
          border-radius: var(--duu-radius-lg);
          border: 1px solid rgba(0,0,0,.06);
          background: #fff;
          overflow: hidden;
          box-shadow: var(--duu-shadow-sm);
        }

        .home-mini-media{
          position: relative;
          height: 154px;
          background: #f5f5f5;
          overflow: hidden;
        }

        .home-mini-badge{
          position: absolute;
          top: 10px;
          right: 10px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(17,17,17,.78);
          color: #fff;
          font-weight: 800;
          font-size: .76rem;
          backdrop-filter: blur(4px);
        }

        .home-mini-body{
          padding: 14px;
        }

        .home-mini-name{
          color: var(--duu-black);
          font-weight: 800;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 2.5em;
          font-size: .92rem;
        }

        .home-mini-price{
          color: var(--duu-black);
          font-weight: 950;
          margin-top: 8px;
          font-size: .95rem;
        }

        .home-mini-hint{
          color: rgba(0,0,0,.50);
          font-size: .78rem;
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .duu-track{
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 4px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .duu-track-item{
          scroll-snap-align: start;
        }
        .duu-track::-webkit-scrollbar{ height: 8px; }
        .duu-track::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,.16);
          border-radius: 999px;
        }
        .duu-track::-webkit-scrollbar-track{
          background: rgba(0,0,0,.05);
          border-radius: 999px;
        }

        .sec{
          border-radius: var(--duu-radius-lg);
          border: 1px solid rgba(0,0,0,.08);
          background: #fff;
          overflow: hidden;
          box-shadow: var(--duu-shadow-md);
        }

        .sec-head{
          padding: 16px 18px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }

        .head-yellow{
          background: linear-gradient(90deg, rgba(var(--duu-yellow-rgb),.26), rgba(var(--duu-yellow-rgb),.06));
        }
        .head-white{
          background: linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.015));
        }
        .head-dark{
          background: linear-gradient(90deg, rgba(17,17,17,.08), rgba(17,17,17,.03));
        }

        .sec-title{
          font-weight: 950;
          color: var(--duu-black);
          font-size: 1.02rem;
          line-height: 1.2;
        }
        .sec-sub{
          color: rgba(0,0,0,.56);
          font-size: .86rem;
          margin-top: 3px;
          font-weight: 600;
        }

        .sec-body{
          padding: 16px;
        }

        .home-empty{
          border-radius: var(--duu-radius-lg);
          border: 1px dashed rgba(0,0,0,.12);
          background: rgba(255,255,255,.75);
          padding: 54px 18px;
          text-align:center;
          color: rgba(0,0,0,.55);
          font-weight: 700;
        }

        @media (min-width: 992px){
          .home-hero{
            padding: 26px;
          }
        }

        @media (max-width: 575.98px){
          .home-shell{
            padding-bottom: 20px;
          }

          .site-closed-only-wrap{
            min-height: calc(100vh - 120px);
            padding: 8px 0 18px;
          }

          .site-closed-only-card{
            border-radius: 24px;
            padding: 22px 16px;
          }

          .site-closed-only-lock-core{
            width: 72px;
            height: 72px;
            border-radius: 20px;
          }

          .site-closed-only-title{
            font-size: 1.55rem;
          }

          .site-closed-only-message{
            font-size: .94rem;
          }

          .home-hero{
            border-radius: var(--duu-radius-lg);
            padding: 16px;
          }
          .home-mini-link{
            width: 172px !important;
          }
          .home-mini-media{
            height: 146px;
          }
          .sec-head{
            padding: 14px 14px;
          }
          .sec-body{
            padding: 14px;
          }
        }
      `}</style>

      <div className="home-shell">
        <OfflineBanner />

        <section className="container pt-3">
          <InstallPWA />

          {siteStatusLoading ? (
            <div className="text-muted small mt-2">Chargement…</div>
          ) : siteClosed ? (
            <SiteClosedOnly siteStatus={siteStatus} />
          ) : (
            <>
              <div className="home-hero">
                <div className="home-hero-inner">
                  <div className="d-flex flex-column gap-2">
                    <div className="home-badges">
                      <span className="home-badge">
                        <Package size={16} />
                        Produits sélectionnés
                      </span>
                      <span className="home-badge">
                        <ShieldCheck size={16} />
                        Achat simple et fiable
                      </span>
                    </div>

                    <div className="home-top-actions">
                      <button
                        type="button"
                        className="btn btn-dark home-market-pill"
                        disabled
                        style={{ cursor: "default", opacity: 1 }}
                      >
                        🛒 Market
                      </button>

                      <Link to={rootForVertical()} className="soft-action">
                        Voir tout <ChevronRight size={15} />
                      </Link>
                    </div>

                    <div className="home-toolbar">
                      <div className="duu-filter-btn d-flex align-items-center gap-2">
                        <span className="filter-icon" aria-hidden="true">
                          <SlidersHorizontal size={18} />
                        </span>

                        <CategoriesMenu
                          title="Filtrer les catégories"
                          variant="auto"
                          activeCategoryId={activeCategoryId}
                          activeSubCategoryId={activeSubCategoryId}
                          onSelectCategory={(c) => {
                            setActiveCategoryId(c.id);
                            setActiveSubCategoryId(null);
                            navigate(routeForCategorySlug(String((c as any).slug || "")));
                          }}
                          onSelectSubCategory={(s) => {
                            const sid = Number((s as any).id || 0);
                            const cid = Number((s as any).category_id || 0);
                            setActiveSubCategoryId(sid || null);
                            setActiveCategoryId(cid || null);

                            const cat = categoriesById[cid];
                            const catSlug = String((cat as any)?.slug || "");
                            if (!catSlug) return;

                            navigate(
                              routeForSubSlug(catSlug, String((s as any).slug || "")),
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>
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
                    onClick={() => {
                      catsQ.refetch();
                      subsQ.refetch();
                      marketQ.refetch();
                    }}
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {loading ? (
                <div className="text-muted small mt-3">Chargement…</div>
              ) : null}

              {!loading && !err && (
                <div className="d-flex flex-column gap-3 mt-3">
                  {categoryIdsWithProducts.map((cid, idx) => {
                    const cat = categoriesById[cid];
                    if (!cat) return null;

                    const list = activeMap[cid] || [];
                    if (!list.length) return null;

                    const items = list.slice(0, 18);

                    const v = pickSectionVariant(idx);
                    const headClass =
                      v === "yellow"
                        ? "head-yellow"
                        : v === "white"
                          ? "head-white"
                          : "head-dark";

                    const catSlug = String((cat as any).slug || "");
                    const mainLink = catSlug
                      ? routeForCategorySlug(catSlug)
                      : rootForVertical();

                    return (
                      <div key={`${activeVertical}-${cid}`} className="sec">
                        <div className={`sec-head ${headClass}`}>
                          <div className="min-w-0">
                            <div className="sec-title text-truncate">
                              {(cat as any).name}
                            </div>
                            <div className="sec-sub">
                              Une sélection de produits à découvrir
                            </div>
                          </div>

                          <Link to={mainLink} className="soft-action">
                            Explorer <ChevronRight size={14} />
                          </Link>
                        </div>

                        <div className="sec-body">
                          <AutoCarousel
                            items={items}
                            itemHref={itemHrefForProduct}
                            itemHint={hintForProduct}
                            autoMs={2600}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {!categoryIdsWithProducts.length && (
                    <div className="home-empty">
                      Aucun produit Market pour le moment.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}