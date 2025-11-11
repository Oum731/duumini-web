// src/pages/AfricanMarket.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "../components/ProductCard";
import { listProducts, type Product } from "../services/products";
import { listCategories, type Category } from "../services/categories";

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

export default function AfricanMarket() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const abortRef = useRef<AbortController | null>(null);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

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
      const [resProducts, resCats] = await Promise.all([
        listProducts({ page, pageSize, channel: "african-market" }),
        listCategories({ page: 1, pageSize: 100 }),
      ]);
      if (ac.signal.aborted) return;
      setItems(resProducts.items);
      setTotal(resProducts.pageInfo.total);
      setCategories(resCats.items);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh();
  }, [page, pageSize]);

  const categoriesById = useMemo(() => {
    const map: Record<number, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const MARKET_CATS = ["viandes-volailles", "epices", "frais-surgeles"];
  const marketCategories = useMemo(
    () => categories.filter((c) => MARKET_CATS.includes(c.slug)),
    [categories]
  );

  const filteredBySearch = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  const filtered = useMemo(() => {
    if (!categoryFilter) return filteredBySearch;
    return filteredBySearch.filter((p) => {
      if (!p.category_id) return false;
      const cat = categoriesById[p.category_id];
      return cat?.slug === categoryFilter;
    });
  }, [filteredBySearch, categoryFilter, categoriesById]);

  const filteredCount = filtered.length;
  const showCount = qDebounced
    ? `${filteredCount} / ${total} éléments`
    : `${total} éléments`;

  return (
    <section className="container-xxl py-4">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1" style={{ color: "var(--duu-black)" }}>
            Duumini Market
          </h1>
        </div>

        <div className="input-group" style={{ maxWidth: 420 }}>
          <input
            className="form-control"
            placeholder="Rechercher un produit…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
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

      {/* Filtres de sous-catégorie Market */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span className="small text-muted me-1">Filtrer par catégorie :</span>
        <button
          type="button"
          className={
            "btn btn-sm " + (!categoryFilter ? "btn-dark" : "btn-outline-dark")
          }
          onClick={() => setCategoryFilter("")}
        >
          Tous
        </button>
        {marketCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={
              "btn btn-sm " +
              (categoryFilter === cat.slug ? "btn-dark" : "btn-outline-dark")
            }
            onClick={() =>
              setCategoryFilter((prev) => (prev === cat.slug ? "" : cat.slug))
            }
          >
            {cat.name}
          </button>
        ))}
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

      {!loading && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="text-muted small">{showCount}</div>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
