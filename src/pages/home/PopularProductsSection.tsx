// src/pages/home/PopularProductsSection.tsx
// ✅ Refonte 2026 (phase 2) : l'accueil n'affichait jusqu'ici aucun produit
// réel avant la section "Choisissez votre profil" — ajoute une vitrine des
// produits les plus commandés (mêmes données que TopProductsPage), pour
// donner tout de suite envie d'acheter plutôt que d'expliquer le concept.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Product } from "../../services/products";
import { listTopOrderedProducts } from "../../services/products";
import ProductCard from "../../components/ProductCard";

export default function PopularProductsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await listTopOrderedProducts(8);
        if (!mounted) return;
        setProducts(((res as any).data ?? res) as Product[]);
      } catch {
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="container-xxl py-4 py-md-5">
      <div className="d-flex align-items-baseline justify-content-between flex-wrap gap-2 mb-4">
        <h2 className="dz-display fw-semibold m-0" style={{ color: "var(--dz-ink)" }}>
          Produits populaires
        </h2>
        <Link
          to="/catalogue"
          className="d-flex align-items-center gap-1 text-decoration-none fw-semibold"
          style={{ fontSize: 14, color: "var(--dz-green)" }}
        >
          Tout voir <ArrowRight size={14} />
        </Link>
      </div>

      <div className="row g-3">
        {(loading ? Array.from({ length: 4 }) : products.slice(0, 8)).map((p, i) => (
          <div className="col-6 col-md-3" key={(p as Product)?.id ?? i}>
            {p ? <ProductCard product={p as Product} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
