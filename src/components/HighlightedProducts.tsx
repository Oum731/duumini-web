// src/components/HighlightedProducts.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../services/products";
import {
  listTopOrderedProducts,
  listTopRatedProducts,
} from "../services/products";

export default function HighlightedProducts() {
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkData() {
      try {
        const [resOrdered, resRated] = await Promise.all([
          listTopOrderedProducts(1),
          listTopRatedProducts({ limit: 1, minCount: 2 }),
        ]);

        const ordered = ((resOrdered as any).data ?? resOrdered) as Product[];
        const rated = ((resRated as any).data ?? resRated) as Product[];

        if (!mounted) return;
        setHasData(
          (Array.isArray(ordered) && ordered.length > 0) ||
            (Array.isArray(rated) && rated.length > 0)
        );
      } catch (err) {
        console.error("[HighlightedProducts] erreur :", err);
        if (!mounted) return;
        setHasData(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkData();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  if (!hasData) return null;

  return (
    <section className="container-xxl mt-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-8">
          <Link
            to="/top-products"
            className="text-decoration-none d-block"
            aria-label="Découvrir les favoris de nos clients"
          >
            <div className="card border-0 shadow-sm overflow-hidden">
              <div className="row g-0 align-items-center">
                {/* Image : au-dessus sur mobile, à gauche sur desktop */}
                <div className="col-12 col-md-5">
                  <div className="ratio ratio-4x3">
                    <img
                      src="/favoris.png"
                      alt="Plats et produits favoris Duumini"
                      className="w-100 h-100 object-fit-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>

                {/* Texte d’invitation */}
                <div className="col-12 col-md-7">
                  <div className="p-3 p-md-4">
                    <h2 className="h6 mb-1 text-dark">
                      Les favoris de nos clients
                    </h2>
                    <p className="small text-muted mb-2">
                      Cliquez pour découvrir les plats et produits les plus
                      commandés et les mieux notés sur Duumini.
                    </p>
                    <span className="small fw-semibold text-decoration-underline">
                      Voir les meilleures offres
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
