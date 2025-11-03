// src/pages/ProductView.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Product } from "../services/products";
import { listProducts } from "../services/products";
import ProductCard from "../components/ProductCard";
import { API_BASE } from "../services/http";

function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}
function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(
    Number(n || 0)
  );
}

export default function ProductView() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Produits similaires (même sous-catégorie)
  const [related, setRelated] = useState<Product[]>([]);

  const title = useMemo(() => product?.name || "Produit", [product]);
  const cover = product?.cover || product?.images?.[0]?.url || null;
  const coverUrl = imgUrl(cover);

  // Choix de la rubrique (pour le bouton Explorer / fallback Retour)
  const sectionPath = useMemo(() => {
    const sub = (product?.sub_category || "").toString().toLowerCase();
    return sub === "food" ? "/african-food" : "/african-market";
  }, [product?.sub_category]);

  const handleBack = useCallback(() => {
    // S'il y a un historique utilisable → retour
    if (window.history && window.history.length > 1 && document.referrer) {
      nav(-1);
      return;
    }
    // Sinon, on envoie vers la bonne section
    nav(sectionPath);
  }, [nav, sectionPath]);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!idOrSlug) throw new Error("Produit introuvable");

        // 1) Essayer en tant qu'ID numérique
        const asId = Number(idOrSlug);
        if (Number.isFinite(asId)) {
          const res = await fetch(`${API_BASE}/api/products/${asId}`, {
            credentials: "omit",
          });
          if (res.ok) {
            const p = (await res.json()) as Product;
            if (!stop) setProduct(p || null);
            return;
          }
        }

        // 2) Essayer par slug si endpoint dispo: /api/products/slug/:slug
        const resSlug = await fetch(
          `${API_BASE}/api/products/slug/${encodeURIComponent(idOrSlug)}`,
          { credentials: "omit" }
        );
        if (resSlug.ok) {
          const p = (await resSlug.json()) as Product;
          if (!stop) setProduct(p || null);
          return;
        }

        throw new Error("Produit introuvable");
      } catch (e: any) {
        if (!stop) setError(e?.message || "Erreur de chargement");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [idOrSlug]);

  // Charger des produits "similaires"
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!product) return;
      try {
        // On récupère une page et on filtre côté client pour éviter de changer le backend.
        const res = await listProducts({ page: 1, pageSize: 24 } as any);
        const items: Product[] = Array.isArray((res as any)?.items)
          ? (res as any).items
          : [];
        const sameSub = (p: Product) =>
          (p?.sub_category || "").toString().toLowerCase() ===
          (product?.sub_category || "").toString().toLowerCase();
        const rel = items.filter((p) => p.id !== product.id && sameSub(p)).slice(0, 8);
        if (!stop) setRelated(rel);
      } catch {
        if (!stop) setRelated([]);
      }
    })();
    return () => {
      stop = true;
    };
  }, [product]);

  // ✅ Si on a bien récupéré le produit, on redirige automatiquement
  useEffect(() => {
    if (!product) return;
    const sub = (product.sub_category || "").toString().toLowerCase();
    const path = sub === "food" ? "/african-food" : "/african-market";
    nav(path, { replace: true });
  }, [product, nav]);

  if (loading) {
    return (
      <div className="container-xxl py-4">
        <div className="placeholder-glow">
          <div className="placeholder col-6 mb-3" style={{ height: 32 }} />
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="placeholder w-100" style={{ aspectRatio: "1/1" }} />
            </div>
            <div className="col-12 col-md-6">
              <div className="placeholder col-8 mb-2" />
              <div className="placeholder col-10 mb-2" />
              <div className="placeholder col-7 mb-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si on a une erreur ou aucun produit → message + boutons
  if (error || !product) {
    return (
      <div className="container-xxl py-4">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button className="btn btn-outline-dark" onClick={handleBack}>
            ← Retour
          </button>
          <Link to={sectionPath} className="btn btn-dark">
            Explorer
          </Link>
        </div>
        <div className="alert alert-warning d-flex align-items-center" role="alert">
          <span className="me-2">⚠️</span>
          <span>{error || "Produit introuvable"}</span>
        </div>
      </div>
    );
  }

  // En théorie, on ne devrait presque jamais arriver ici,
  // car l'effet de redirection nav() va nous envoyer sur la section.
  return (
    <div className="container-xxl py-4">
      {/* Barre d’actions */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className="btn btn-outline-dark" onClick={handleBack}>
          ← Retour
        </button>
        <Link to={sectionPath} className="btn btn-dark">
          Explorer
        </Link>
      </div>

      <h1 className="h4 mb-3">{title}</h1>

      <div className="row g-4">
        <div className="col-12 col-md-6">
          {coverUrl ? (
            <img src={coverUrl} alt={product.name} className="img-fluid rounded" />
          ) : (
            <div
              className="bg-light rounded"
              style={{ width: "100%", paddingTop: "100%" }}
            />
          )}
        </div>

        <div className="col-12 col-md-6">
          <div className="d-flex align-items-center gap-2 mb-3">
            <div className="h5 m-0">{moneyMAD(product.price)}</div>
            {product.sub_category ? (
              <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">
                {product.sub_category === "food" ? "Food" : "Market"}
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="text-muted">{product.description}</p>
          ) : (
            <p className="text-muted">Aucune description fournie.</p>
          )}
        </div>
      </div>

      {/* Vous aimerez aussi */}
      {related.length > 0 && (
        <div className="mt-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="h6 m-0">Vous aimerez aussi</h2>
            <Link to={sectionPath} className="btn btn-sm btn-outline-dark">
              Voir tout
            </Link>
          </div>
          <div className="row g-2 g-sm-3">
            {related.map((p) => (
              <div key={p.id} className="col-6 col-md-4 col-lg-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
