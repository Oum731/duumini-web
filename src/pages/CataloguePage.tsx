// src/pages/CataloguePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Seo } from "../components/Seo";
import ProductCard from "../components/ProductCard";
import { LoadingState } from "../components/ui/Spinner";
import { btnClass } from "../components/ui/dzClass";
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
  const [searchParams] = useSearchParams();
  const [vertical, setVertical] = useState<Vertical | "">("");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [qDebounced, setQDebounced] = useState(searchParams.get("q") || "");
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
    // ✅ Refonte 2026 (phase 3) : même design system que l'accueil, scopé
    // via .dz-body — filtres/données inchangés, seule la présentation change.
    <div className="dz-body" style={{ background: "var(--dz-paper)", minHeight: "70vh" }}>
      <div className="container-xxl py-4 py-md-5">
        <Seo
          title="Catalogue produits subsahariens et africains"
          description="Épicerie subsaharienne et africaine, attiéké, placali, boissons, cosmétique, artisanat et mode : parcourez le catalogue DUUMINI et commandez en ligne, livraison au Maroc."
          path="/catalogue"
        />

        <h1 className="dz-display fw-semibold mb-1" style={{ color: "var(--dz-ink)" }}>
          Catalogue
        </h1>
        <p className="mb-4" style={{ color: "var(--dz-ink-muted)" }}>
          {loading ? "Chargement…" : `${total} produit(s)`}
        </p>

        {/* Onglets vertical */}
        <div className="d-flex flex-wrap gap-2 mb-4">
          {VERTICAL_TABS.map((t) => (
            <button
              key={t.value || "all"}
              type="button"
              className={vertical === t.value ? btnClass("primary") : btnClass("outline")}
              style={{ padding: "8px 18px", fontSize: 14 }}
              onClick={() => setVertical(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="row g-4">
          {/* Filtres */}
          <div className="col-12 col-lg-3">
            <div className="dz-card p-3 p-md-4">
              <div
                className="mb-2"
                style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--dz-ink-muted)" }}
              >
                Catégorie
              </div>
              <select
                className="form-select mb-4"
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

              <div
                className="mb-2"
                style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--dz-ink-muted)" }}
              >
                Marque
              </div>
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

          {/* Résultats */}
          <div className="col-12 col-lg-9">
            <div
              className="dz-card d-flex align-items-center gap-2 mb-3"
              style={{ padding: "10px 16px" }}
            >
              <Search size={16} color="var(--dz-ink-muted)" />
              <input
                className="border-0 flex-grow-1"
                style={{ outline: "none", background: "transparent", fontSize: 14.5 }}
                placeholder="Rechercher un produit..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <LoadingState label="Chargement du catalogue…" />
            ) : items.length === 0 ? (
              <div className="dz-card text-center py-5" style={{ color: "var(--dz-ink-muted)" }}>
                Aucun produit ne correspond à ces filtres.
              </div>
            ) : (
              <div className="row g-3">
                {items.map((p) => (
                  <div className="col-6 col-md-4" key={p.id}>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}

            {pages > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-4">
                <div style={{ color: "var(--dz-ink-muted)", fontSize: 13.5 }}>
                  Page {page} / {pages}
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className={btnClass("outline")}
                    style={{ padding: "8px 18px", fontSize: 14 }}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    className={btnClass("outline")}
                    style={{ padding: "8px 18px", fontSize: 14 }}
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
