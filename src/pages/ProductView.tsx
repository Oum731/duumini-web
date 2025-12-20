// src/pages/ProductView.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Product } from "../services/products";
import { listProducts } from "../services/products";
import ProductCard from "../components/ProductCard";
import { API_BASE } from "../services/http";
import ProductRating from "../components/ProductRating";

function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(Number(n || 0));
}

function isProductActive(p: Product | null | undefined): boolean {
  if (!p) return false;
  return ((p as any).is_active ?? (p as any).active ?? 1) ? true : false;
}

export default function ProductView() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [related, setRelated] = useState<Product[]>([]);

  const title = useMemo(() => product?.name || "Produit", [product]);
  const cover = product?.cover || product?.images?.[0]?.url || null;
  const coverUrl = imgUrl(cover);

  const productIsActive = useMemo(() => isProductActive(product), [product]);

  // Determine section using sub_category_slug (fallback to sub_category_name)
  const sectionPath = useMemo(() => {
    const sub =
      (product?.sub_category_slug ?? product?.sub_category_name ?? "")
        .toString()
        .toLowerCase();
    return sub === "food" ? "/african-food" : "/african-market";
  }, [product?.sub_category_slug, product?.sub_category_name]);

  const handleBack = useCallback(() => {
    if (window.history && window.history.length > 1 && document.referrer) {
      nav(-1);
      return;
    }
    nav(sectionPath);
  }, [nav, sectionPath]);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!idOrSlug) throw new Error("Produit introuvable");

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

  // Load related products using sub_category_slug
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!product) return;
      try {
        const res = await listProducts({ page: 1, pageSize: 24 } as any);
        const items: Product[] = Array.isArray((res as any)?.items)
          ? (res as any).items
          : [];

        const sameSub = (p: Product) => {
          const a = (p?.sub_category_slug ?? p?.sub_category_name ?? "")
            .toString()
            .toLowerCase();
          const b = (product?.sub_category_slug ?? product?.sub_category_name ?? "")
            .toString()
            .toLowerCase();
          return a === b;
        };

        const rel = items
          .filter(
            (p) => p.id !== product.id && sameSub(p) && isProductActive(p)
          )
          .slice(0, 8);

        if (!stop) setRelated(rel);
      } catch {
        if (!stop) setRelated([]);
      }
    })();
    return () => {
      stop = true;
    };
  }, [product]);

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

  if (error || !product || !productIsActive) {
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
          <span>
            {product && !productIsActive
              ? "Ce produit n'est plus disponible."
              : error || "Produit introuvable"}
          </span>
        </div>
      </div>
    );
  }

  const productSubLabel = product.sub_category_name ?? product.sub_category_slug ?? "";

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
          <div className="d-flex align-items-center gap-2 mb-2">
            <div className="h5 m-0">{moneyMAD(product.price)}</div>
            {productSubLabel ? (
              <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">
                {(product.sub_category_slug ?? "").toLowerCase() === "food"
                  ? "Food"
                  : "Market"}
              </span>
            ) : null}
          </div>

          <div className="mb-3">
            <ProductRating productId={product.id} />
          </div>

          {product.description ? (
            <p className="text-muted">{product.description}</p>
          ) : (
            <p className="text-muted">Aucune description fournie.</p>
          )}
        </div>
      </div>

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