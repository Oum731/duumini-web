// src/pages/Fashion.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import ProductCard from "../components/ProductCard";
import CategoriesMenu from "../components/CategoriesMenu";
import { listProducts, type Product } from "../services/products";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";
import { useLocationCity } from "../context/LocationContext";

function GridSkeleton() {
  return (
    <div className="row g-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div className="col-12 col-sm-6 col-md-6 col-lg-4" key={i}>
          <div className="card h-100 border-0 shadow-sm fa-skeleton-card">
            <div className="d-flex flex-column flex-sm-row h-100">
              <div className="placeholder fa-skeleton-media" />
              <div className="card-body flex-grow-1">
                <div className="placeholder col-8 mb-2" />
                <div className="placeholder col-5 mb-2" />
                <div className="placeholder col-10 mb-2" />
                <div className="placeholder col-7" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** ===== Random stable (seeded) ===== */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const out = arr.slice();
  const rand = mulberry32(hashSeed(seedStr));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const RANDOM_WINDOW_HOURS = 5;
function getWindowKey(now = Date.now()) {
  const win = RANDOM_WINDOW_HOURS * 60 * 60 * 1000;
  return Math.floor(now / win);
}

/** ✅ Détection robuste "promo" */
function isPromoProduct(p: Product) {
  const x = p as any;

  if (x.is_promo === true || x.promo === true || x.on_promo === true) return true;

  const promoPercent = Number(x.promo_percent ?? x.discount_percent ?? x.percent_off ?? 0) || 0;
  const promoAmount = Number(x.promo_amount ?? x.discount_amount ?? x.amount_off ?? 0) || 0;
  if (promoPercent > 0 || promoAmount > 0) return true;

  const price = Number(x.price_client ?? x.price ?? 0) || 0;
  const promoPrice =
    Number(x.promo_price_client ?? x.promo_price ?? x.price_promo ?? x.sale_price ?? 0) || 0;
  if (promoPrice > 0 && price > 0 && promoPrice < price) return true;

  if (String(x.promo_type || x.discount_type || "").trim()) {
    const v = Number(x.promo_value ?? x.discount_value ?? 0) || 0;
    if (v > 0) return true;
  }

  return false;
}

/** ✅ Uniq by id */
function uniqById(list: Product[]) {
  const seen = new Set<number>();
  const out: Product[] = [];
  for (const p of list) {
    const id = Number((p as any).id || 0);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

export default function Fashion() {
  const { city } = useLocationCity();
  const navigate = useNavigate();
  const params = useParams();

  const categorySlugParam = (params as any)?.categorySlug
    ? String((params as any).categorySlug).trim().toLowerCase()
    : "";

  const subSlugParam = (params as any)?.subCategorySlug
    ? String((params as any).subCategorySlug).trim().toLowerCase()
    : "";

  const [items, setItems] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);

  const abortProductsRef = useRef<AbortController | null>(null);
  const abortMetaRef = useRef<AbortController | null>(null);

  const loadMeta = useCallback(async () => {
    abortMetaRef.current?.abort();
    const ac = new AbortController();
    abortMetaRef.current = ac;

    setLoadingMeta(true);
    setError(null);

    try {
      const [resCats, resSubs] = await Promise.all([
        listCategories({ page: 1, pageSize: 500 }),
        listSubCategories({ page: 1, pageSize: 2000 }),
      ]);
      if (ac.signal.aborted) return;
      setAllCategories(resCats.items || []);
      setAllSubCategories(resSubs.items || []);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    return () => abortMetaRef.current?.abort();
  }, [loadMeta]);

  const loadProducts = useCallback(async () => {
    abortProductsRef.current?.abort();
    const ac = new AbortController();
    abortProductsRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      const resProducts = await listProducts({
        page,
        pageSize,
        onlyActive: true,
        vertical: "FASHION",
      } as any);

      if (ac.signal.aborted) return;

      const rawItems = resProducts.items || [];
      const windowKey = getWindowKey();

      const seedStr = [
        "fashion",
        `win:${windowKey}`,
        `city:${city || "all"}`,
        `page:${page}`,
        `cat:${categorySlugParam || "all"}`,
        `sub:${subSlugParam || "all"}`,
      ].join("|");

      setItems(seededShuffle(rawItems, seedStr));
      setTotal(resProducts.pageInfo?.total ?? 0);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [page, pageSize, city, categorySlugParam, subSlugParam]);

  useEffect(() => {
    loadProducts();
    return () => abortProductsRef.current?.abort();
  }, [loadProducts]);

  const refresh = useCallback(() => {
    loadProducts();
    if (!allCategories.length || !allSubCategories.length) loadMeta();
  }, [loadProducts, loadMeta, allCategories.length, allSubCategories.length]);

  const categoriesAll = useMemo(() => {
    const out = [...allCategories];
    out.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    return out;
  }, [allCategories]);

  const subCategoriesAll = useMemo(() => {
    const out = [...allSubCategories];
    out.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    return out;
  }, [allSubCategories]);

  const categoriesById = useMemo(() => {
    const map: Record<number, Category> = {};
    for (const c of categoriesAll) map[c.id] = c;
    return map;
  }, [categoriesAll]);

  const categoriesBySlug = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categoriesAll) map[String((c as any).slug || "").toLowerCase()] = c;
    return map;
  }, [categoriesAll]);

  const subsByCatId = useMemo(() => {
    const m: Record<number, SubCategory[]> = {};
    for (const s of subCategoriesAll) {
      const cid = Number((s as any).category_id || 0);
      if (!cid) continue;
      if (!m[cid]) m[cid] = [];
      m[cid].push(s);
    }
    Object.keys(m).forEach((k) => {
      m[Number(k)].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    });
    return m;
  }, [subCategoriesAll]);

  const selectedCategory = useMemo(() => {
    if (!categorySlugParam) return null;
    return categoriesBySlug[categorySlugParam] || null;
  }, [categorySlugParam, categoriesBySlug]);

  const selectedSubCategory = useMemo(() => {
    if (!subSlugParam || !selectedCategory) return null;
    const list = subsByCatId[selectedCategory.id] || [];
    return list.find((s) => String((s as any).slug || "").toLowerCase() === subSlugParam) || null;
  }, [subSlugParam, selectedCategory, subsByCatId]);

  useEffect(() => {
    if (!categoriesAll.length) return;

    if (categorySlugParam && !selectedCategory) {
      navigate("/fashion", { replace: true });
      return;
    }

    if (categorySlugParam && selectedCategory && subSlugParam && !selectedSubCategory) {
      navigate(`/fashion/${(selectedCategory as any).slug}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesAll.length, categorySlugParam, subSlugParam, selectedCategory, selectedSubCategory]);

  const filteredBySearch = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  const filtered = useMemo(() => {
    let out = filteredBySearch;

    if (selectedCategory) {
      out = out.filter(
        (p) => Number((p as any).category_id || 0) === Number((selectedCategory as any).id)
      );
    }

    if (selectedSubCategory) {
      out = out.filter(
        (p) => Number((p as any).sub_category_id || 0) === Number((selectedSubCategory as any).id)
      );
    }

    return out;
  }, [filteredBySearch, selectedCategory, selectedSubCategory]);

  const promoItems = useMemo(() => uniqById(filtered.filter(isPromoProduct)), [filtered]);

  const promoIds = useMemo(() => {
    const s = new Set<number>();
    for (const p of promoItems) s.add(Number((p as any).id || 0));
    return s;
  }, [promoItems]);

  const normalItems = useMemo(() => {
    if (!promoItems.length) return filtered;
    return filtered.filter((p) => !promoIds.has(Number((p as any).id || 0)));
  }, [filtered, promoItems.length, promoIds]);

  const title = useMemo(() => {
    if (selectedSubCategory) return (selectedSubCategory as any).name || "Fashion";
    if (selectedCategory) return (selectedCategory as any).name || "Fashion";
    return "Fashion";
  }, [selectedCategory, selectedSubCategory]);

  const subtitle = useMemo(() => {
    if (selectedSubCategory) {
      return "Une sélection ciblée de pièces élégantes, tendances et faciles à porter.";
    }
    if (selectedCategory) {
      return "Découvre les meilleurs articles de mode, matières et coupes de cette catégorie.";
    }
    return "Tailles • Couleurs • Nouveautés — Paiement à la livraison.";
  }, [selectedCategory, selectedSubCategory]);

  const activeCategoryId = (selectedCategory as any)?.id ?? null;
  const activeSubCategoryId = (selectedSubCategory as any)?.id ?? null;
  const showFiltersBar = !!selectedCategory || !!selectedSubCategory;

  const loadingAny = loading || loadingMeta;

  return (
    <section className="container-xxl py-4">
      <style>{`
        .fa-skeleton-card{
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.06);
        }
        .fa-skeleton-media{
          width: 100%;
          min-height: 220px;
        }
        @media (min-width: 576px){
          .fa-skeleton-media{
            width: 48%;
            min-height: 220px;
          }
        }

        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
          font-weight: 900;
          border-radius: 14px;
        }
        .btn-duu:hover{ filter: brightness(.96); }
        .btn-duu:focus,
        .btn-duu:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .35) !important;
        }

        .fashion-hero{
          border-radius: 22px;
          border: 1px solid rgba(0,0,0,.08);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.10), transparent 55%),
            #fff;
          padding: 18px;
          box-shadow: 0 10px 26px rgba(0,0,0,.05);
        }

        .fashion-kicker{
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

        .fashion-title{
          color: var(--duu-black);
          font-weight: 950;
          letter-spacing: -.02em;
        }

        .fashion-sub{
          color: rgba(0,0,0,.62);
          font-weight: 600;
          line-height: 1.45;
        }

        .fashion-toolbar{
          margin-top: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .fashion-filter-wrap{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
        }

        .fashion-filter-icon{
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.94);
          display:flex;
          align-items:center;
          justify-content:center;
          flex: 0 0 auto;
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
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .35) !important;
          background: rgba(255,255,255,.99) !important;
          color: var(--duu-black) !important;
        }

        .fashion-search{
          position: relative;
        }
        .fashion-search .form-control{
          min-height: 46px;
          border-radius: 14px;
          padding-left: 42px;
          border-color: rgba(0,0,0,.10);
        }
        .fashion-search .form-control:focus{
          border-color: rgba(var(--duu-yellow-rgb), .55);
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .25);
        }
        .fashion-search-icon{
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(0,0,0,.45);
          pointer-events: none;
          z-index: 2;
        }
        .fashion-clear-btn{
          border-radius: 12px !important;
          font-weight: 900 !important;
        }

        .fashion-chip-row{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap: 10px;
          margin-top: 14px;
        }

        .filter-chip{
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 999px;
          padding: 7px 11px;
          background: rgba(255,255,255,.88);
          font-weight: 800;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          color: var(--duu-black);
        }

        .soft-clear{
          border: 1px solid rgba(0,0,0,.12);
          background: #fff;
          border-radius: 12px;
          font-weight: 800;
        }

        .fashion-subcats{
          display:flex;
          flex-wrap:wrap;
          gap: 10px;
          margin-top: 12px;
        }
        .fashion-subcats .btn{
          border-radius: 999px;
          font-weight: 800;
          padding: 7px 12px;
        }

        .fashion-topline{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          margin: 18px 0 12px;
        }

        .fashion-count{
          color: rgba(0,0,0,.56);
          font-size: .9rem;
          font-weight: 700;
        }

        .promo-wrap{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 22px;
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.10), transparent 55%),
            #fff;
          box-shadow: 0 10px 24px rgba(0,0,0,.05);
          overflow: hidden;
        }
        .promo-head{
          padding: 14px 16px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .promo-title{
          font-weight: 950;
          color: var(--duu-black);
          margin: 0;
        }
        .promo-sub{
          color: rgba(0,0,0,.56);
          font-size: .88rem;
          margin-top: 2px;
        }
        .promo-badge{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(var(--duu-red-rgb), .08);
          border: 1px solid rgba(var(--duu-red-rgb), .20);
          font-weight: 900;
          color: var(--duu-red);
          white-space: nowrap;
        }

        .fashion-pagination{
          margin-top: 18px;
          display:flex;
          justify-content:flex-end;
          align-items:center;
        }
        .fashion-pagination .btn-group .btn{
          min-width: 42px;
          border-radius: 12px !important;
          font-weight: 900;
        }

        @media (min-width: 768px){
          .fashion-toolbar{
            grid-template-columns: minmax(250px, auto) minmax(280px, 420px);
            justify-content: space-between;
            align-items: center;
          }
        }
      `}</style>

      <div className="fashion-hero mb-3">
        <div className="d-flex flex-column gap-2">
          <div className="fashion-kicker">👗 DUUMINI Fashion</div>

          <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3">
            <div className="min-w-0">
              <h1 className="h3 mb-1 fashion-title">{title}</h1>
              <div className="fashion-sub">{subtitle}</div>
            </div>
          </div>

          <div className="fashion-toolbar">
            <div className="fashion-filter-wrap duu-filter-btn">
              <span className="fashion-filter-icon" aria-hidden="true">
                <SlidersHorizontal size={18} />
              </span>

              <CategoriesMenu
                scope="fashion"
                title="Filtrer"
                variant="auto"
                activeCategoryId={activeCategoryId}
                activeSubCategoryId={activeSubCategoryId}
                onSelectCategory={(c) => {
                  setPage(1);
                  navigate(`/fashion/${(c as any).slug}`);
                }}
                onSelectSubCategory={(s) => {
                  setPage(1);
                  const cat = categoriesById[Number((s as any).category_id || 0)];
                  const catSlug = (cat as any)?.slug || (selectedCategory as any)?.slug || "";
                  if (!catSlug) return;
                  navigate(`/fashion/${catSlug}/${(s as any).slug}`);
                }}
              />
            </div>

            <div className="input-group fashion-search">
              <span className="fashion-search-icon">
                <Search size={16} />
              </span>

              <input
                className="form-control"
                placeholder="Rechercher un article…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                aria-label="Rechercher"
              />
              <button
                className="btn btn-duu fashion-clear-btn"
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                disabled={!q}
              >
                Effacer
              </button>
            </div>
          </div>

          {showFiltersBar ? (
            <div className="fashion-chip-row">
              {selectedCategory ? (
                <span className="filter-chip">
                  <span style={{ opacity: 0.7 }}>🧷</span>
                  {(selectedCategory as any).name}
                </span>
              ) : null}
              {selectedSubCategory ? (
                <span className="filter-chip">
                  <span style={{ opacity: 0.7 }}>🏷️</span>
                  {(selectedSubCategory as any).name}
                </span>
              ) : null}

              <button
                type="button"
                className="btn btn-sm soft-clear"
                onClick={() => {
                  setPage(1);
                  navigate("/fashion");
                }}
              >
                Tout afficher
              </button>
            </div>
          ) : null}

          {selectedCategory ? (
            <div className="fashion-subcats">
              <button
                type="button"
                className={"btn btn-sm " + (!selectedSubCategory ? "btn-dark" : "btn-outline-dark")}
                onClick={() => {
                  setPage(1);
                  navigate(`/fashion/${(selectedCategory as any).slug}`);
                }}
              >
                Tout
              </button>

              {(subsByCatId[(selectedCategory as any).id] || []).map((s) => {
                const active = (selectedSubCategory as any)?.id === (s as any).id;
                return (
                  <button
                    key={(s as any).id}
                    type="button"
                    className={"btn btn-sm " + (active ? "btn-dark" : "btn-outline-dark")}
                    onClick={() => {
                      setPage(1);
                      navigate(`/fashion/${(selectedCategory as any).slug}/${(s as any).slug}`);
                    }}
                  >
                    {(s as any).name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button className="btn btn-duu btn-sm" onClick={refresh}>
            Réessayer
          </button>
        </div>
      ) : null}

      {!loadingAny && !error ? (
        <div className="fashion-topline">
          <div className="fashion-count">
            {promoItems.length + normalItems.length} article(s) affiché(s)
          </div>
        </div>
      ) : null}

      {loadingAny ? (
        <GridSkeleton />
      ) : (
        <>
          {promoItems.length > 0 ? (
            <div className="promo-wrap mb-4">
              <div className="promo-head">
                <div>
                  <h2 className="h6 promo-title">Promos du moment</h2>
                  <div className="promo-sub">
                    Les meilleures pièces mode et looks à ne pas manquer.
                  </div>
                </div>
                <span className="promo-badge">🔥 {promoItems.length}</span>
              </div>

              <div className="p-3">
                <div className="row g-3">
                  {promoItems.slice(0, 12).map((p) => (
                    <div className="col-12 col-sm-6 col-md-6 col-lg-4" key={(p as any).id}>
                      <ProductCard product={p} layout="fashion" miniDescMax={85} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {normalItems.length === 0 ? (
            <div className="text-center text-muted py-5">Aucun article trouvé.</div>
          ) : (
            <div className="row g-3">
              {normalItems.map((p) => (
                <div className="col-12 col-sm-6 col-md-6 col-lg-4" key={(p as any).id}>
                  <ProductCard product={p} layout="fashion" miniDescMax={85} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loadingAny && pages > 1 ? (
        <div className="fashion-pagination">
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Page précédente"
              title="Page précédente"
            >
              ◀
            </button>

            <span className="btn btn-sm btn-outline-dark disabled">
              {page} / {pages}
            </span>

            <button
              className="btn btn-sm btn-duu"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              aria-label="Page suivante"
              title="Page suivante"
            >
              ▶
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}