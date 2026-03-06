// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import InstallPWA from "../components/InstallPWA";
import CategoriesMenu from "../components/CategoriesMenu";

import { listProducts, type Product } from "../services/products";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories } from "../services/subCategories";
import { API_BASE } from "../services/http";

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
    <div className="alert alert-warning rounded-0 text-center small m-0">
      Vous êtes hors-ligne.
    </div>
  );
}

/* ===== Mini product card (carrousel) ===== */
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
  const price = anyP.price_client ?? anyP.price ?? 0;

  return (
    <Link
      to={href}
      className="text-reset text-decoration-none d-inline-block home-mini-link"
      style={{ width: 184 }}
      title={hint ? `${name} — Voir toute la catégorie` : name}
    >
      <div className="card border-0 shadow-sm overflow-hidden home-mini-card">
        <div style={{ height: 136 }} className="bg-light position-relative">
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

          <span className="home-mini-badge position-absolute top-0 end-0 m-2">
            Voir
          </span>
        </div>

        <div className="card-body p-2 p-sm-3">
          <div className="small fw-semibold text-truncate">{name}</div>
          <div className="small home-mini-price">{moneyMAD(price)}</div>
          {hint ? (
            <div className="small text-muted text-truncate">{hint}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/* ===== Carrousel horizontal (scroll-snap) + auto-scroll ===== */
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
            <MiniCard
              product={p}
              href={itemHref(p)}
              hint={itemHint ? itemHint(p) : null}
            />
          </div>
        ))}
      </div>

      <style>{`
        .duu-track::-webkit-scrollbar{ height: 8px; }
        .duu-track::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.18); border-radius: 10px; }
        .duu-track::-webkit-scrollbar-track{ background: rgba(0,0,0,.06); border-radius: 10px; }
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

type Vertical = "FOOD" | "MARKET" | "FASHION";

export default function Home() {
  const navigate = useNavigate();
  const [activeVertical, setActiveVertical] = useState<Vertical>("FOOD");

  const results = useQueries({
    queries: [
      {
        queryKey: ["categories", { page: 1, pageSize: 500 }],
        queryFn: () => listCategories({ page: 1, pageSize: 500 }),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["subCategories", { page: 1, pageSize: 2000 }],
        queryFn: () => listSubCategories({ page: 1, pageSize: 2000 }),
        staleTime: 10 * 60 * 1000,
      },
      {
        queryKey: ["homeProducts", "african-food"],
        queryFn: () =>
          listProducts({
            page: 1,
            pageSize: 240,
            channel: "african-food",
            onlyActive: true,
          } as any),
        staleTime: 3 * 60 * 1000,
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
      },
      {
        queryKey: ["homeProducts", "fashion"],
        queryFn: () =>
          listProducts({
            page: 1,
            pageSize: 240,
            vertical: "FASHION",
            onlyActive: true,
          } as any),
        staleTime: 3 * 60 * 1000,
      },
    ],
  });

  const catsQ = results[0];
  const subsQ = results[1];
  const foodQ = results[2];
  const marketQ = results[3];
  const fashionQ = results[4];

  const loading =
    catsQ.isLoading ||
    subsQ.isLoading ||
    foodQ.isLoading ||
    marketQ.isLoading ||
    fashionQ.isLoading;

  const err =
    (catsQ.error as any)?.message ||
    (subsQ.error as any)?.message ||
    (foodQ.error as any)?.message ||
    (marketQ.error as any)?.message ||
    (fashionQ.error as any)?.message ||
    null;

  const categories = (catsQ.data?.items || []) as Category[];
  const food = (foodQ.data?.items || []) as Product[];
  const market = (marketQ.data?.items || []) as Product[];
  const fashion = (fashionQ.data?.items || []) as Product[];

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<number | null>(
    null,
  );

  const categoriesById = useMemo(() => {
    const m: Record<number, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const foodByCat = useMemo(() => groupByCategoryId(food), [food]);
  const marketByCat = useMemo(() => groupByCategoryId(market), [market]);
  const fashionByCat = useMemo(() => groupByCategoryId(fashion), [fashion]);

  function rootForVertical(v: Vertical) {
    if (v === "FASHION") return "/fashion";
    if (v === "FOOD") return "/african-food";
    return "/african-market";
  }
  function routeForCategorySlug(v: Vertical, catSlug: string) {
    return `${rootForVertical(v)}/${catSlug}`;
  }
  function routeForSubSlug(v: Vertical, catSlug: string, subSlug: string) {
    return `${rootForVertical(v)}/${catSlug}/${subSlug}`;
  }

  const activeMap = useMemo(() => {
    if (activeVertical === "FASHION") return fashionByCat;
    if (activeVertical === "FOOD") return foodByCat;
    return marketByCat;
  }, [activeVertical, fashionByCat, foodByCat, marketByCat]);

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
    if (cid && catSlug) return routeForCategorySlug(activeVertical, catSlug);
    return rootForVertical(activeVertical);
  }

  function hintForProduct(p: Product) {
    const anyP = p as any;
    const cid = Number(anyP.category_id || 0);
    const cat = cid ? categoriesById[cid] : null;
    const name = String((cat as any)?.name || "").trim();
    return name ? `Catégorie: ${name}` : null;
  }

  const heroTitle = useMemo(() => {
    if (activeVertical === "FOOD")
      return "Découvre les meilleurs produits Food";
    if (activeVertical === "MARKET") return "";
    return "Trouve les nouveautés Fashion";
  }, [activeVertical]);

  const heroSubtitle = useMemo(() => {
    if (activeVertical === "FOOD") {
      return "Plats, sauces, boissons et spécialités africaines à portée de main.";
    }
    if (activeVertical === "MARKET") {
      return "";
    }
    return "Mode, tailles, couleurs et tendances pour tous les styles.";
  }, [activeVertical]);

  return (
    <div className="pb-4" style={{ background: "#f8f9fa" }}>
      <style>{`
        .home-wrap{
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.18), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.10), transparent 55%),
            #f8f9fa;
          min-height: 100%;
        }

        .home-hero{
          border-radius: 22px;
          border: 1px solid rgba(0,0,0,.08);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.10), transparent 55%),
            #fff;
          box-shadow: 0 10px 26px rgba(0,0,0,.05);
          padding: 18px;
        }

        .home-kicker{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(var(--duu-yellow-rgb), .20);
          border: 1px solid rgba(0,0,0,.08);
          font-weight: 900;
          color: var(--duu-black);
          font-size: .82rem;
        }

        .home-title{
          color: var(--duu-black);
          font-weight: 950;
          letter-spacing: -.02em;
        }

        .home-subtitle{
          color: rgba(0,0,0,.62);
          font-weight: 600;
          line-height: 1.45;
        }

        .seg{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
          margin-top: 14px;
        }
        .seg .btn{
          border-radius: 999px;
          font-weight: 900;
          padding: 8px 14px;
        }

        .soft-action{
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 900;
          background: rgba(255,255,255,.75);
          text-decoration: none;
          color: var(--duu-black);
          white-space: nowrap;
          display:inline-flex;
          align-items:center;
          gap: 6px;
        }
        .soft-action:hover{
          color: var(--duu-red);
          border-color: rgba(0,0,0,.20);
        }

        .home-toolbar{
          margin-top: 14px;
          display:flex;
          align-items:center;
          justify-content:flex-end;
        }

        .duu-filter-btn .btn,
        .duu-filter-btn .dropdown > .btn,
        .duu-filter-btn > .btn{
          border-color: rgba(0,0,0,.16) !important;
          color: var(--duu-black) !important;
          background: rgba(255,255,255,.96) !important;
          font-weight: 900;
          border-radius: 14px !important;
          min-height: 42px;
          padding: 9px 12px !important;
        }
        .duu-filter-btn .btn:hover,
        .duu-filter-btn .dropdown > .btn:hover,
        .duu-filter-btn > .btn:hover{
          border-color: rgba(0,0,0,.28) !important;
          color: var(--duu-red) !important;
          background: rgba(255,255,255,.99) !important;
        }
        .duu-filter-btn .btn:focus,
        .duu-filter-btn .dropdown > .btn:focus,
        .duu-filter-btn > .btn:focus,
        .duu-filter-btn .btn:focus-visible,
        .duu-filter-btn .dropdown > .btn:focus-visible,
        .duu-filter-btn > .btn:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb),.35) !important;
          background: rgba(255,255,255,.99) !important;
          color: var(--duu-black) !important;
        }
        .duu-filter-btn .btn:active,
        .duu-filter-btn .dropdown > .btn:active,
        .duu-filter-btn > .btn:active{
          background: rgba(var(--duu-yellow-rgb),.20) !important;
          color: var(--duu-black) !important;
        }

        .filter-icon{
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.94);
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .home-mini-link{
          transition: transform .18s ease;
        }
        .home-mini-link:hover{
          transform: translateY(-2px);
        }
        .home-mini-card{
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,.06);
        }
        .home-mini-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(17,17,17,.72);
          color: #fff;
          font-weight: 800;
          font-size: .78rem;
        }
        .home-mini-price{
          color: var(--duu-black);
          font-weight: 900;
        }

        .sec{
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,.08);
          background: #fff;
          overflow: hidden;
          box-shadow: 0 10px 26px rgba(0,0,0,.05);
        }
        .sec-head{
          padding: 14px 16px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .head-yellow{
          background: linear-gradient(90deg, rgba(var(--duu-yellow-rgb),.40), rgba(var(--duu-yellow-rgb),.08));
        }
        .head-red{
          background: linear-gradient(90deg, rgba(var(--duu-red-rgb),.16), rgba(var(--duu-red-rgb),.05));
        }
        .head-dark{
          background: linear-gradient(90deg, rgba(17,17,17,.11), rgba(17,17,17,.04));
        }

        .sec-title{
          font-weight: 950;
          color: var(--duu-black);
        }
        .sec-sub{
          color: rgba(0,0,0,.56);
          font-size: .88rem;
          margin-top: 2px;
        }

        .home-empty{
          border-radius: 20px;
          border: 1px dashed rgba(0,0,0,.12);
          background: rgba(255,255,255,.7);
        }
      `}</style>

      <div className="home-wrap pb-4">
        <OfflineBanner />

        <section className="container pt-3">
          <InstallPWA />

          <div className="home-hero">
            <div className="d-flex flex-column gap-2">
              <div className="home-kicker">✨ DUUMINI</div>

              {(heroTitle || heroSubtitle) && (
                <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3">
                  <div className="min-w-0">
                    {heroTitle ? (
                      <h1 className="h3 mb-1 home-title">{heroTitle}</h1>
                    ) : null}
                    {heroSubtitle ? (
                      <div className="home-subtitle">{heroSubtitle}</div>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="seg">
                <button
                  type="button"
                  className={
                    "btn " +
                    (activeVertical === "FOOD"
                      ? "btn-dark"
                      : "btn-outline-dark")
                  }
                  onClick={() => {
                    setActiveVertical("FOOD");
                    setActiveCategoryId(null);
                    setActiveSubCategoryId(null);
                  }}
                >
                  🍽️ Food
                </button>
                <button
                  type="button"
                  className={
                    "btn " +
                    (activeVertical === "MARKET"
                      ? "btn-dark"
                      : "btn-outline-dark")
                  }
                  onClick={() => {
                    setActiveVertical("MARKET");
                    setActiveCategoryId(null);
                    setActiveSubCategoryId(null);
                  }}
                >
                  🛒 Market
                </button>
                <button
                  type="button"
                  className={
                    "btn " +
                    (activeVertical === "FASHION"
                      ? "btn-dark"
                      : "btn-outline-dark")
                  }
                  onClick={() => {
                    setActiveVertical("FASHION");
                    setActiveCategoryId(null);
                    setActiveSubCategoryId(null);
                  }}
                >
                  👕 Fashion
                </button>

                <Link
                  to={rootForVertical(activeVertical)}
                  className="soft-action ms-auto"
                >
                  Voir tout <ChevronRight size={14} />
                </Link>
              </div>

              <div className="home-toolbar">
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
                      navigate(
                        routeForCategorySlug(
                          activeVertical,
                          String((c as any).slug || ""),
                        ),
                      );
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
                        routeForSubSlug(
                          activeVertical,
                          catSlug,
                          String((s as any).slug || ""),
                        ),
                      );
                    }}
                  />
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
                  foodQ.refetch();
                  marketQ.refetch();
                  fashionQ.refetch();
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
                    : v === "red"
                      ? "head-red"
                      : "head-dark";

                const catSlug = String((cat as any).slug || "");
                const mainLink = catSlug
                  ? routeForCategorySlug(activeVertical, catSlug)
                  : rootForVertical(activeVertical);

                return (
                  <div key={`${activeVertical}-${cid}`} className="sec">
                    <div className={`sec-head ${headClass}`}>
                      <div className="min-w-0">
                        <div className="sec-title text-truncate">
                          {(cat as any).name}
                        </div>
                        <div className="sec-sub">
                          {activeVertical === "FOOD"
                            ? "Food"
                            : activeVertical === "MARKET"
                              ? "Market"
                              : "Fashion"}
                        </div>
                      </div>

                      <Link to={mainLink} className="soft-action">
                        Explorer <ChevronRight size={14} />
                      </Link>
                    </div>

                    <div className="p-3">
                      <AutoCarousel
                        items={items}
                        itemHref={itemHrefForProduct}
                        itemHint={hintForProduct}
                        autoMs={2500}
                      />
                    </div>
                  </div>
                );
              })}

              {!categoryIdsWithProducts.length && (
                <div className="home-empty text-center text-muted py-5">
                  Aucun produit{" "}
                  {activeVertical === "FOOD"
                    ? "Food"
                    : activeVertical === "MARKET"
                      ? "Market"
                      : "Fashion"}{" "}
                  pour le moment.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
