// src/pages/CataloguePage.tsx
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Seo } from "../components/Seo";
import ProductCard from "../components/ProductCard";
import { LoadingState } from "../components/ui/Spinner";
import {
  listProducts,
  listProductBrands,
  type Product,
  type ProductBrand,
} from "../services/products";
import { listCategories, type Category, type Vertical } from "../services/categories";

const VERTICAL_TABS: { value: Vertical | ""; label: string }[] = [
  { value: "", label: "Tout" },
  { value: "MARKET", label: "Duumini Market" },
  { value: "FOOD", label: "Duumini Food" },
  { value: "FASHION", label: "Duumini Fashion" },
];

const PAGE_SIZE = 24;

export default function CataloguePage() {
  const [vertical, setVertical] = useState<Vertical | "">("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Filtres dépendants du vertical (catégories + marques) — reset quand il change.
  useEffect(() => {
    setCategoryId("");
    setBrand("");
    setPage(1);

    let mounted = true;
    listCategories({ vertical: vertical || undefined, pageSize: 100 })
      .then((res) => {
        if (mounted) setCategories(res.items || []);
      })
      .catch(() => {
        if (mounted) setCategories([]);
      });

    listProductBrands({ vertical: vertical || undefined })
      .then((res) => {
        if (mounted) setBrands(res);
      })
      .catch(() => {
        if (mounted) setBrands([]);
      });

    return () => {
      mounted = false;
    };
  }, [vertical]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, categoryId, brand]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listProducts({
      page,
      pageSize: PAGE_SIZE,
      vertical: vertical || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
      brand: brand || undefined,
      q: qDebounced || undefined,
    })
      .then((res) => {
        if (!mounted) return;
        setItems(res.items || []);
        setTotal(res.pageInfo?.total ?? (res.items || []).length);
      })
      .catch((e) => {
        if (!mounted) return;
        setItems([]);
        setError(e?.message || "Impossible de charger le catalogue.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [page, vertical, categoryId, brand, qDebounced]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <div className="container-xxl py-4 py-md-5">
      <Seo
        title="Catalogue produits africains"
        description="Épicerie africaine, attiéké, placali, boissons, cosmétique, artisanat et mode : parcourez le catalogue DUUMINI et commandez en ligne, livraison au Maroc."
        path="/catalogue"
      />

      <h1 className="fw-bold mb-1">Catalogue</h1>
      <p className="text-muted mb-4">
        {loading ? "Chargement…" : `${total} produit(s)`}
      </p>

      {/* Onglets vertical */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {VERTICAL_TABS.map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            className={`btn btn-sm ${vertical === t.value ? "btn-duu-orange" : "btn-outline-dark"}`}
            onClick={() => setVertical(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="row g-2 mb-4">
        <div className="col-12 col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-white">
              <Search size={16} />
            </span>
            <input
              className="form-control"
              placeholder="Rechercher un produit..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="col-6 col-md-3">
          <select
            className="form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-4">
          <select
            className="form-select"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">Toutes les marques</option>
            {brands.map((b) => (
              <option key={b.brand} value={b.brand}>
                {b.brand} ({b.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <LoadingState label="Chargement du catalogue…" />
      ) : items.length === 0 ? (
        <div className="text-muted py-5 text-center">
          Aucun produit ne correspond à ces filtres.
        </div>
      ) : (
        <div className="row g-3">
          {items.map((p) => (
            <div className="col-6 col-md-4 col-lg-3" key={p.id}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div className="text-muted small">
            Page {page} / {pages}
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </button>
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
