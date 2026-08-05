// src/pages/AfricanFood.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { Seo } from "../components/Seo";
import CategoriesMenu from "../components/CategoriesMenu";
import { listManageProducts, listProducts, type Product } from "../services/products";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";
import { listActiveCountries, type CountryConfig } from "../services/countries";
import { useLocationCity } from "../context/LocationContext";
import { useViewer } from "../hooks/useViewer";

function GridSkeleton() {
  return (
    <div className="row g-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={i}>
          <div className="card h-100 border-0 shadow-sm af-skeleton-card">
            <div
              className="placeholder w-100"
              style={{ aspectRatio: "1 / 1", borderRadius: "18px 18px 0 0" }}
            />
            <div className="card-body">
              <div className="placeholder col-8 mb-2" />
              <div className="placeholder col-6 mb-2" />
              <div className="placeholder col-4" />
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

type Channel = "african-food";

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

export default function AfricanFood() {
  const { city } = useLocationCity();
  const navigate = useNavigate();
  const params = useParams();
  const viewer = useViewer();

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

  // ✅ Filtres vendeur/fournisseur + pays
  const [shopFilter, setShopFilter] = useState<number | "">("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => {
    let mounted = true;
    listActiveCountries()
      .then((list) => {
        if (mounted) setCountries(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const shopOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of items) {
      const anyP = p as any;
      const sid = Number(anyP.shop_id || 0);
      if (!sid || map.has(sid)) continue;
      map.set(sid, String(anyP.shop_name || `Boutique #${sid}`));
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

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
      if (viewer.loading) return;

      const isAdmin = viewer.role === "ADMIN";
      const isPro =
        viewer.role === "VENDEUR" || viewer.role === "RESTAURANT" || viewer.role === "FOURNISSEUR";

      let resProducts: any;

      if (isAdmin) {
        resProducts = await listManageProducts({
          page,
          pageSize,
          onlyActive: true,
          vertical: "FOOD",
        } as any);
      } else if (isPro) {
        const shopId = Number(viewer.actingShopId || 0) || null;
        if (!shopId) {
          setItems([]);
          setTotal(0);
          setError("Aucune boutique active. Sélectionne une boutique avant de voir tes produits.");
          return;
        }

        resProducts = await listManageProducts({
          page,
          pageSize,
          onlyActive: true,
          vertical: "FOOD",
          shop_id: shopId,
        } as any);
      } else {
        resProducts = await listProducts({
          page,
          pageSize,
          channel: "african-food" as Channel,
          onlyActive: true,
          shop_id: shopFilter || undefined,
          country_code: countryFilter || undefined,
        } as any);
      }

      if (ac.signal.aborted) return;

      const rawItems = resProducts.items || [];
      const windowKey = getWindowKey();

      const seedStr = [
        "african-food",
        `win:${windowKey}`,
        `city:${city || "all"}`,
        `page:${page}`,
        `cat:${categorySlugParam || "all"}`,
        `sub:${subSlugParam || "all"}`,
        `role:${String(viewer.role || "guest")}`,
        `shop:${String(viewer.actingShopId || "none")}`,
      ].join("|");

      setItems(seededShuffle(rawItems, seedStr));
      setTotal(resProducts.pageInfo?.total ?? 0);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [
    page,
    pageSize,
    city,
    categorySlugParam,
    subSlugParam,
    viewer.loading,
    viewer.role,
    viewer.actingShopId,
    shopFilter,
    countryFilter,
  ]);

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

  const subById = useMemo(() => {
    const map: Record<number, SubCategory> = {};
    for (const s of subCategoriesAll) map[(s as any).id] = s;
    return map;
  }, [subCategoriesAll]);

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
    const list = subsByCatId[(selectedCategory as any).id] || [];
    return (
      list.find((s) => String((s as any).slug || "").toLowerCase() === subSlugParam) || null
    );
  }, [subSlugParam, selectedCategory, subsByCatId]);

  useEffect(() => {
    if (!categoriesAll.length) return;
    if (categorySlugParam && !selectedCategory) {
      navigate("/african-food", { replace: true });
    }
  }, [categoriesAll.length, categorySlugParam, selectedCategory, navigate]);

  const filteredBySearch = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  const filtered = useMemo(() => {
    let out = filteredBySearch;

    if (selectedCategory) {
      out = out.filter((p) => {
        const cid = Number((p as any).category_id || 0);
        if (!cid) return false;
        const c = categoriesById[cid];
        return (
          c &&
          String((c as any).slug || "").toLowerCase() ===
            String((selectedCategory as any).slug || "").toLowerCase()
        );
      });
    }

    if (selectedSubCategory) {
      out = out.filter((p) => {
        const sid = Number((p as any).sub_category_id || 0);
        if (!sid) return false;
        const s = subById[sid];
        return (
          s &&
          String((s as any).slug || "").toLowerCase() ===
            String((selectedSubCategory as any).slug || "").toLowerCase()
        );
      });
    }

    return out;
  }, [filteredBySearch, selectedCategory, selectedSubCategory, categoriesById, subById]);

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
    if (selectedSubCategory) return (selectedSubCategory as any).name || "Produits";
    if (selectedCategory) return (selectedCategory as any).name || "Produits";
    return "Cuisine africaine en ligne";
  }, [selectedCategory, selectedSubCategory]);

  const subtitle = useMemo(() => {
    if (selectedSubCategory) {
      return "Découvre une sélection gourmande et ciblée de cette sous-catégorie.";
    }
    if (selectedCategory) {
      return "Explore les meilleurs plats, produits frais et spécialités africaines de cette catégorie.";
    }
    return "Plats, sauces, grillades et spécialités culinaires africaines, livrés directement au Maroc.";
  }, [selectedCategory, selectedSubCategory]);

  const activeCategoryId = (selectedCategory as any)?.id ?? null;
  const activeSubCategoryId = (selectedSubCategory as any)?.id ?? null;

  const showFiltersBar = !!selectedCategory || !!selectedSubCategory;
  const loadingAny = loading || loadingMeta || viewer.loading;

  return (
    <section className="container-xxl py-4">
      <Seo title={title} description={subtitle} path="/african-food" />
      <style>{`
        .af-skeleton-card{
          border-radius: var(--duu-radius-lg);
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.06);
        }

        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
          font-weight: 900;
          border-radius: var(--duu-radius-sm);
        }
        .btn-duu:hover{ filter: brightness(.96); }
        .btn-duu:focus,
        .btn-duu:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .35) !important;
        }

        .af-hero{
          border-radius: var(--duu-radius-xl);
          border: 1px solid rgba(0,0,0,.08);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.08), transparent 55%),
            #fff;
          box-shadow: var(--duu-shadow-md);
          padding: 16px;
        }

        .af-kicker{
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

        .af-title{
          color: var(--duu-black);
          font-weight: 950;
          letter-spacing: -.02em;
        }

        .af-subtitle{
          color: rgba(0,0,0,.62);
          font-weight: 600;
          line-height: 1.45;
        }

        .af-toolbar{
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .af-filter-wrap{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
        }

        .af-filter-icon{
          width: 42px;
          height: 42px;
          border-radius: var(--duu-radius-sm);
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
          border-radius: var(--duu-radius-sm) !important;
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

        .af-search{
          position: relative;
        }
        .af-search .form-control{
          min-height: 46px;
          border-radius: var(--duu-radius-sm);
          padding-left: 42px;
          border-color: rgba(0,0,0,.10);
        }
        .af-search .form-control:focus{
          border-color: rgba(var(--duu-yellow-rgb), .55);
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .25);
        }
        .af-search-icon{
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(0,0,0,.45);
          pointer-events: none;
          z-index: 2;
        }
        .af-clear-btn{
          border-radius: var(--duu-radius-sm) !important;
          font-weight: 900 !important;
        }

        .af-chip-row{
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

        .af-soft-btn{
          border: 1px solid rgba(0,0,0,.12);
          background: #fff;
          border-radius: var(--duu-radius-sm);
          font-weight: 800;
        }

        .af-subcats{
          display:flex;
          flex-wrap:wrap;
          gap: 10px;
          margin-top: 12px;
        }
        .af-subcats .btn{
          border-radius: 999px;
          font-weight: 800;
          padding: 7px 12px;
        }

        .af-topline{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          margin: 18px 0 12px;
        }

        .af-count{
          color: rgba(0,0,0,.56);
          font-size: .9rem;
          font-weight: 700;
        }

        .promo-wrap{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: var(--duu-radius-lg);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.09), transparent 55%),
            #fff;
          box-shadow: var(--duu-shadow-md);
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

        .af-pagination{
          margin-top: 18px;
          display:flex;
          justify-content:flex-end;
          align-items:center;
        }
        .af-pagination .btn-group .btn{
          min-width: 42px;
          border-radius: var(--duu-radius-sm) !important;
          font-weight: 900;
        }

        @media (min-width: 768px){
          .af-toolbar{
            grid-template-columns: minmax(250px, auto) minmax(280px, 420px);
            justify-content: space-between;
            align-items: center;
          }
        }
      `}</style>

      <div className="af-hero">
        <div className="d-flex flex-column gap-2">
          <div className="af-kicker">🍽️ DUUMINI Food</div>

          <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3">
            <div className="min-w-0">
              <h1 className="h3 mb-1 af-title">{title}</h1>
              <div className="af-subtitle">{subtitle}</div>

              {(viewer.role === "ADMIN" ||
                viewer.role === "VENDEUR" ||
                viewer.role === "RESTAURANT" ||
                viewer.role === "FOURNISSEUR") && (
                <div className="small text-muted mt-2">
                  {viewer.role === "ADMIN"
                    ? "Mode admin : catalogue FOOD (manage)."
                    : viewer.actingShopId
                    ? `Mode pro : produits FOOD de la boutique #${viewer.actingShopId}.`
                    : "Mode pro : aucune boutique active."}
                </div>
              )}
            </div>
          </div>

          <div className="af-toolbar">
            <div className="af-filter-wrap duu-filter-btn">
              <span className="af-filter-icon" aria-hidden="true">
                <SlidersHorizontal size={18} />
              </span>

              <CategoriesMenu
                scope="african-food"
                title="Filtrer"
                variant="auto"
                activeCategoryId={activeCategoryId}
                activeSubCategoryId={activeSubCategoryId}
                onSelectCategory={(c) => {
                  setPage(1);
                  navigate(`/african-food/${(c as any).slug}`);
                }}
                onSelectSubCategory={(s) => {
                  setPage(1);
                  const cat = categoriesById[Number((s as any).category_id || 0)];
                  const catSlug = (cat as any)?.slug || (selectedCategory as any)?.slug || "";
                  if (!catSlug) return;
                  navigate(`/african-food/${catSlug}/${(s as any).slug}`);
                }}
              />
            </div>

            <div className="input-group af-search">
              <span className="af-search-icon">
                <Search size={16} />
              </span>

              <input
                className="form-control"
                placeholder="Rechercher un produit…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                aria-label="Rechercher"
              />
              <button
                className="btn btn-duu af-clear-btn"
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                disabled={!q}
              >
                Effacer
              </button>
            </div>

            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 220 }}
              aria-label="Filtrer par vendeur"
              value={shopFilter}
              onChange={(e) => {
                setPage(1);
                setShopFilter(e.target.value ? Number(e.target.value) : "");
              }}
            >
              <option value="">Tous les vendeurs</option>
              {shopOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 180 }}
              aria-label="Filtrer par pays"
              value={countryFilter}
              onChange={(e) => {
                setPage(1);
                setCountryFilter(e.target.value);
              }}
            >
              <option value="">Tous les pays</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag_emoji ? `${c.flag_emoji} ` : ""}
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {showFiltersBar && (
            <div className="af-chip-row">
              {selectedCategory && (
                <span className="filter-chip">
                  <span style={{ opacity: 0.7 }}>📦</span>
                  {(selectedCategory as any).name}
                </span>
              )}
              {selectedSubCategory && (
                <span className="filter-chip">
                  <span style={{ opacity: 0.7 }}>🏷️</span>
                  {(selectedSubCategory as any).name}
                </span>
              )}

              <button
                type="button"
                className="btn btn-sm af-soft-btn"
                onClick={() => {
                  setPage(1);
                  navigate("/african-food");
                }}
              >
                Tout afficher
              </button>
            </div>
          )}

          {selectedCategory && (
            <div className="af-subcats">
              <button
                type="button"
                className={"btn btn-sm " + (!selectedSubCategory ? "btn-dark" : "btn-outline-dark")}
                onClick={() => {
                  setPage(1);
                  navigate(`/african-food/${(selectedCategory as any).slug}`);
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
                      navigate(`/african-food/${(selectedCategory as any).slug}/${(s as any).slug}`);
                    }}
                  >
                    {(s as any).name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center mt-3">
          <span>{error}</span>
          <button className="btn btn-duu btn-sm" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}

      {!loadingAny && !error && (
        <div className="af-topline">
          <div className="af-count">
            {promoItems.length + normalItems.length} produit(s) affiché(s)
          </div>
        </div>
      )}

      {loadingAny ? (
        <GridSkeleton />
      ) : (
        <>
          {promoItems.length > 0 && (
            <div className="promo-wrap mb-4">
              <div className="promo-head">
                <div>
                  <h2 className="h6 promo-title">Promos du moment</h2>
                  <div className="promo-sub">Les meilleurs plats et offres à découvrir maintenant.</div>
                </div>
                <span className="promo-badge">🔥 {promoItems.length}</span>
              </div>

              <div className="p-3">
                <div className="row g-3">
                  {promoItems.slice(0, 12).map((p) => (
                    <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={(p as any).id}>
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {normalItems.length === 0 ? (
            <div className="text-center text-muted py-5">Aucun produit trouvé.</div>
          ) : (
            <div className="row g-3">
              {normalItems.map((p) => (
                <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={(p as any).id}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loadingAny && pages > 1 && (
        <div className="af-pagination">
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
      )}
    </section>
  );
}