// src/pages/AfricanMarket.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
        <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={i}>
          <div className="card h-100 border-0">
            <div
              className="placeholder w-100"
              style={{ aspectRatio: "1 / 1", borderRadius: ".5rem .5rem 0 0" }}
            />
            <div className="card-body">
              <div className="placeholder col-8 mb-2" />
              <div className="placeholder col-5" />
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

type Channel = "african-market";

export default function AfricanMarket() {
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
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

  const abortRef = useRef<AbortController | null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);

  async function refresh() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      // ✅ On ne filtre plus par ville côté API
      const [resProducts, resCats, resSubs] = await Promise.all([
        listProducts({
          page,
          pageSize,
          channel: "african-market" as Channel,
          onlyActive: true,
        }),
        listCategories({ page: 1, pageSize: 500 }),
        listSubCategories({ page: 1, pageSize: 2000 }),
      ]);

      if (ac.signal.aborted) return;

      const rawItems = resProducts.items || [];
      const windowKey = getWindowKey();

      // ✅ On garde city seulement pour le random stable (pas envoyé à l'API)
      const seedStr = [
        "african-market",
        `win:${windowKey}`,
        `city:${city || "all"}`,
        `page:${page}`,
        `cat:${categorySlugParam || "all"}`,
        `sub:${subSlugParam || "all"}`,
      ].join("|");

      const finalItems = seededShuffle(rawItems, seedStr);

      setItems(finalItems);
      setTotal(resProducts.pageInfo?.total ?? 0);
      setCategories(resCats.items || []);
      setSubCategories(resSubs.items || []);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, city, categorySlugParam, subSlugParam]);

  // maps
  const categoriesById = useMemo(() => {
    const map: Record<number, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const categoriesBySlug = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) map[String(c.slug || "").toLowerCase()] = c;
    return map;
  }, [categories]);

  const subById = useMemo(() => {
    const map: Record<number, SubCategory> = {};
    for (const s of subCategories) map[s.id] = s;
    return map;
  }, [subCategories]);

  const subsByCatId = useMemo(() => {
    const m: Record<number, SubCategory[]> = {};
    for (const s of subCategories) {
      const cid = Number(s.category_id || 0);
      if (!cid) continue;
      if (!m[cid]) m[cid] = [];
      m[cid].push(s);
    }
    Object.keys(m).forEach((k) => {
      m[Number(k)].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    });
    return m;
  }, [subCategories]);

  const selectedCategory = useMemo(() => {
    if (!categorySlugParam) return null;
    return categoriesBySlug[categorySlugParam] || null;
  }, [categorySlugParam, categoriesBySlug]);

  const selectedSubCategory = useMemo(() => {
    if (!subSlugParam || !selectedCategory) return null;
    const list = subsByCatId[selectedCategory.id] || [];
    return list.find((s) => String(s.slug || "").toLowerCase() === subSlugParam) || null;
  }, [subSlugParam, selectedCategory, subsByCatId]);

  // URL invalide → redirect
  useEffect(() => {
    if (!categories.length) return;
    if (categorySlugParam && !selectedCategory) {
      navigate("/african-market", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length, categorySlugParam, selectedCategory]);

  // search filter
  const filteredBySearch = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  // category/subcategory filter (front)
  const filtered = useMemo(() => {
    let out = filteredBySearch;

    if (selectedCategory) {
      out = out.filter((p) => {
        const cid = Number((p as any).category_id || 0);
        if (!cid) return false;
        const c = categoriesById[cid];
        return (
          c &&
          String(c.slug || "").toLowerCase() === String(selectedCategory.slug || "").toLowerCase()
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
          String(s.slug || "").toLowerCase() === String(selectedSubCategory.slug || "").toLowerCase()
        );
      });
    }

    return out;
  }, [filteredBySearch, selectedCategory, selectedSubCategory, categoriesById, subById]);

  // ✅ titre simple
  const title = useMemo(() => {
    if (selectedSubCategory) return selectedSubCategory.name || "Produits";
    if (selectedCategory) return selectedCategory.name || "Produits";
    return "Produits";
  }, [selectedCategory, selectedSubCategory]);

  const activeCategoryId = selectedCategory?.id ?? null;
  const activeSubCategoryId = selectedSubCategory?.id ?? null;

  const showFiltersBar = !!selectedCategory || !!selectedSubCategory;

  return (
    <section className="container-xxl py-4">
      <style>{`
        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
          font-weight: 800;
        }
        .btn-duu:hover{ filter: brightness(.96); }
        .btn-duu:focus,
        .btn-duu:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(255,213,79,.40) !important;
        }

        /* ✅ Fix focus/active du bouton Filtrer (Bootstrap le rend noir sinon) */
        .duu-filter-btn .btn,
        .duu-filter-btn .dropdown > .btn,
        .duu-filter-btn > .btn{
          border-color: rgba(0,0,0,.22) !important;
          color: var(--duu-black) !important;
          background: rgba(255,255,255,.92) !important;
          font-weight: 800;
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
          transform: translateY(0);
          background: rgba(255,213,79,.20) !important;
          color: var(--duu-black) !important;
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
      `}</style>

      <div className="d-flex flex-column gap-2 mb-3">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2">
          <div className="min-w-0">
            <h1 className="h4 mb-0" style={{ color: "var(--duu-black)" }}>
              {title}
            </h1>
          </div>

          <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center justify-content-end gap-2">
            {/* ✅ Filtrer (icône + bouton) */}
            <div className="d-flex align-items-center gap-2 flex-shrink-0 duu-filter-btn">
              <span
                className="d-inline-flex align-items-center justify-content-center"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "rgba(255,255,255,.92)",
                }}
                aria-hidden="true"
              >
                <SlidersHorizontal size={18} />
              </span>

              <CategoriesMenu
                title="Filtrer"
                variant="auto"
                activeCategoryId={activeCategoryId}
                activeSubCategoryId={activeSubCategoryId}
                onSelectCategory={(c) => {
                  setPage(1);
                  navigate(`/african-market/${c.slug}`);
                }}
                onSelectSubCategory={(s) => {
                  setPage(1);
                  const cat = categoriesById[s.category_id];
                  const catSlug = cat?.slug || selectedCategory?.slug || "";
                  if (!catSlug) return;
                  navigate(`/african-market/${catSlug}/${s.slug}`);
                }}
              />
            </div>

            {/* Search */}
            <div className="input-group" style={{ maxWidth: 420 }}>
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

        {/* ✅ barre compacte filtres actifs */}
        {showFiltersBar && (
          <div className="d-flex flex-wrap align-items-center gap-2">
            {selectedCategory && (
              <span className="filter-chip">
                <span style={{ opacity: 0.7 }}>📦</span>
                {selectedCategory.name}
              </span>
            )}
            {selectedSubCategory && (
              <span className="filter-chip">
                <span style={{ opacity: 0.7 }}>🏷️</span>
                {selectedSubCategory.name}
              </span>
            )}

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setPage(1);
                navigate("/african-market");
              }}
            >
              Tout afficher
            </button>
          </div>
        )}

        {/* ✅ sous-catégories */}
        {selectedCategory && (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className={"btn btn-sm " + (!selectedSubCategory ? "btn-dark" : "btn-outline-dark")}
              onClick={() => {
                setPage(1);
                navigate(`/african-market/${selectedCategory.slug}`);
              }}
            >
              Tout
            </button>

            {(subsByCatId[selectedCategory.id] || []).map((s) => {
              const active = selectedSubCategory?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={"btn btn-sm " + (active ? "btn-dark" : "btn-outline-dark")}
                  onClick={() => {
                    setPage(1);
                    navigate(`/african-market/${selectedCategory.slug}/${s.slug}`);
                  }}
                >
                  {s.name}
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

      {loading ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted py-5">Aucun produit trouvé.</div>
      ) : (
        <div className="row g-3">
          {filtered.map((p) => (
            <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={p.id}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}

      {/* ✅ Pagination : pas de "X éléments" */}
      {!loading && pages > 1 && (
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
