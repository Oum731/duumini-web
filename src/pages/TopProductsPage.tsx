// src/pages/TopProductsPage.tsx
import { useEffect, useState } from "react";
import type { Product } from "../services/products";
import {
  listTopOrderedProducts,
  listTopRatedProducts,
} from "../services/products";
import ProductCard from "../components/ProductCard";
import { LoadingState } from "../components/ui/Spinner";

export default function TopProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      let orderedData: Product[] = [];
      let ratedData: Product[] = [];
      let orderedError = false;
      let ratedError = false;

      try {
        const resOrdered = await listTopOrderedProducts(24);
        orderedData = ((resOrdered as any).data ?? resOrdered) as Product[];
      } catch (err) {
        console.error("[TopProductsPage] top-ordered error:", err);
        orderedError = true;
      }

      try {
        const resRated = await listTopRatedProducts({ limit: 24, minCount: 2 });
        ratedData = ((resRated as any).data ?? resRated) as Product[];
      } catch (err) {
        console.error("[TopProductsPage] top-rated error:", err);
        ratedError = true;
      }

      if (!mounted) return;

      if (orderedError && ratedError) {
        setError("Impossible de charger les produits mis en avant.");
        setProducts([]);
        setLoading(false);
        return;
      }

      // Fusionne les deux listes sans doublons (id produit)
      const map = new Map<number, Product>();
      for (const p of orderedData) {
        map.set(p.id, p);
      }
      for (const p of ratedData) {
        if (!map.has(p.id)) {
          map.set(p.id, p);
        }
      }

      setProducts(Array.from(map.values()));
      setLoading(false);
    }

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="container-xxl py-4">
      {/* Fil d'Ariane simple 
      <nav className="mb-3 small">
        <Link to="/" className="text-decoration-none">
          Accueil
        </Link>
        <span className="text-muted"> / </span>
        <span className="text-muted">Produits mis en avant</span>
      </nav>*/}

      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h5 mb-1">Best-sellers Duumini</h1>
          <p className="small text-muted mb-0">
            Nos produits et plats les plus commandés ou les mieux notés.
          </p>
        </div>
      </div>

      {loading && <LoadingState label="Chargement des produits…" />}

      {!loading && error && !products.length && (
        <p className="text-danger">{error}</p>
      )}

      {!loading && !error && !products.length && (
        <p className="text-muted">
          Aucun produit n’est encore suffisamment commandé ou noté pour
          apparaître ici.
        </p>
      )}

      {!loading && products.length > 0 && (
        <div className="row g-3">
          {products.map((p) => (
            <div key={p.id} className="col-6 col-md-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
