// src/pages/Fashion.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
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
          <div
            className="card h-100 border-0 shadow-sm"
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
            <div className="d-flex">
              <div className="placeholder" style={{ width: "52%", minHeight: 190 }} />
              <div className="card-body" style={{ flex: 1 }}>
                <div className="placeholder col-8 mb-2" />
                <div className="placeholder col-5 mb-2" />
                <div className="placeholder col-10" />
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

/** ✅ Détection robuste "promo" (même logique que Market/Food) */
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

  // search debounce
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

  /** ✅ meta (cats/subs) */
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

  /** ✅ produits */
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

  /** ✅ IMPORTANT: on ne filtre plus les catégories par "ids présents dans les produits"
   *  => c’est CategoriesMenu qui filtre selon la page (scope="fashion")
   */
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

  // maps (sur tout le catalogue)
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

  // URL invalide → redirect
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

  // search filter
  const filteredBySearch = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  // category/subcategory filter
  const filtered = useMemo(() => {
    let out = filteredBySearch;

    if (selectedCategory) {
      out = out.filter((p) => Number((p as any).category_id || 0) === Number((selectedCategory as any).id));
    }

    if (selectedSubCategory) {
      out = out.filter((p) => Number((p as any).sub_category_id || 0) === Number((selectedSubCategory as any).id));
    }

    return out;
  }, [filteredBySearch, selectedCategory, selectedSubCategory]);

  /** ✅ promos + normal (sans doublons) */
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

  const activeCategoryId = (selectedCategory as any)?.id ?? null;
  const activeSubCategoryId = (selectedSubCategory as any)?.id ?? null;
  const showFiltersBar = !!selectedCategory || !!selectedSubCategory;

  const loadingAny = loading || loadingMeta;

  return (
    <section className="container-xxl py-4">
      <style>{`
        .fashion-hero{
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,.08);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.18), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.10), transparent 55%),
            #fff;
          padding: 14px;
          box-shadow: 0 10px 24px rgba(0,0,0,.05);
        }
        .fashion-kicker{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(var(--duu-yellow-rgb), .22);
          border: 1px solid rgba(0,0,0,.10);
          font-weight: 900;
          color: var(--duu-black);
        }
        .fashion-sub{ color: rgba(0,0,0,.6); font-weight: 600; }

        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
          font-weight: 900;
        }
        .btn-duu:hover{ filter: brightness(.96); }
        .btn-duu:focus,
        .btn-duu:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .35) !important;
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

        .filter-chip{
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(255,255,255,.75);
          font-weight: 800;
          display:inline-flex;
          align-items:center;
          gap: 8px;
        }
        .soft-clear{
          border: 1px solid rgba(0,0,0,.12);
          background: #fff;
          border-radius: 12px;
          font-weight: 800;
        }

        .promo-wrap{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 18px;
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.18), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.10), transparent 55%),
            #fff;
          box-shadow: 0 10px 24px rgba(0,0,0,.05);
          overflow: hidden;
        }
        .promo-head{
          padding: 12px 14px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          font-weight: 900;
          color: var(--duu-black);
        }
        .promo-badge{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(var(--duu-red-rgb), .08);
          border: 1px solid rgba(var(--duu-red-rgb), .20);
          font-weight: 900;
        }
      `}</style>

      <div className="fashion-hero mb-3">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2">
          <div className="min-w-0">
            <div className="fashion-kicker">👗 DUUMINI Fashion</div>
            <h1 className="h4 mb-1 mt-2" style={{ color: "var(--duu-black)" }}>
              {title}
            </h1>
            <div className="fashion-sub">Tailles • Couleurs • Nouveautés — Paiement à la livraison</div>
          </div>

          <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center justify-content-end gap-2">
            <div className="d-flex align-items-center gap-2 flex-shrink-0 duu-filter-btn">
              <span
                className="d-inline-flex align-items-center justify-content-center"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "rgba(255,255,255,.92)",
                }}
                aria-hidden="true"
              >
                <SlidersHorizontal size={18} />
              </span>

              {/* ✅ le menu se filtre tout seul pour Fashion */}
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

            <div className="input-group" style={{ maxWidth: 420 }}>
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
                className="btn btn-duu"
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
        </div>

        {showFiltersBar && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            {selectedCategory && (
              <span className="filter-chip">
                <span style={{ opacity: 0.7 }}>🧷</span>
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
              className="btn btn-sm soft-clear"
              onClick={() => {
                setPage(1);
                navigate("/fashion");
              }}
            >
              Tout afficher
            </button>
          </div>
        )}

        {selectedCategory && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
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
        )}
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button className="btn btn-duu btn-sm" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}

      {loadingAny ? (
        <GridSkeleton />
      ) : (
        <>
          {promoItems.length > 0 && (
            <div className="promo-wrap mb-3">
              <div className="promo-head">
                <span>Promos du moment</span>
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
          )}

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

      {!loadingAny && pages > 1 && (
        <div className="d-flex justify-content-end align-items-center mt-3">
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
