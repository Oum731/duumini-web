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
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

function isProductActive(p: Product | null | undefined): boolean {
  if (!p) return false;
  return ((p as any).is_active ?? (p as any).active ?? 1) ? true : false;
}

function getSectionPath(p: Product | null) {
  const ch = String((p as any)?.channel || "").toLowerCase();
  if (ch.includes("food")) return "/african-food";
  if (ch.includes("market")) return "/african-market";
  return "/african-market";
}

export default function ProductView() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<Product[]>([]);

  const title = useMemo(() => product?.name || "Produit", [product]);

  const cover = useMemo(() => {
    const anyP = product as any;
    return anyP?.cover || anyP?.images?.[0]?.url || anyP?.image || null;
  }, [product]);

  const coverUrl = useMemo(() => imgUrl(cover), [cover]);

  const productIsActive = useMemo(() => isProductActive(product), [product]);

  const sectionPath = useMemo(() => getSectionPath(product), [product]);

  const handleBack = useCallback(() => {
    if (window.history && window.history.length > 1 && document.referrer) {
      nav(-1);
      return;
    }
    nav(sectionPath);
  }, [nav, sectionPath]);

  // ===== Load product by id or slug =====
  useEffect(() => {
    let stop = false;

    (async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      try {
        if (!idOrSlug) throw new Error("Produit introuvable");

        // 1) Try numeric ID
        const asId = Number(idOrSlug);
        if (Number.isFinite(asId) && asId > 0) {
          const res = await fetch(`${API_BASE}/api/products/${asId}`, {
            credentials: "omit",
          });
          if (res.ok) {
            const p = (await res.json()) as Product;
            if (!stop) setProduct(p || null);
            return;
          }
        }

        // 2) Try slug endpoint
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

  // ===== Load related products (same sub_category_id, fallback same category_id) =====
  useEffect(() => {
    let stop = false;

    (async () => {
      if (!product) return;

      try {
        const res = await listProducts({ page: 1, pageSize: 36 } as any);
        const items: Product[] = Array.isArray((res as any)?.items)
          ? (res as any).items
          : [];

        const pAny = product as any;
        const subId = Number(pAny?.sub_category_id || 0);
        const catId = Number(pAny?.category_id || 0);

        const isSameGroup = (p: Product) => {
          const anyP = p as any;
          const pSubId = Number(anyP?.sub_category_id || 0);
          const pCatId = Number(anyP?.category_id || 0);

          if (subId && pSubId) return pSubId === subId;
          if (catId && pCatId) return pCatId === catId;
          return false;
        };

        const rel = items
          .filter(
            (p) =>
              p.id !== product.id &&
              isSameGroup(p) &&
              isProductActive(p)
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

  // Not found or inactive
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

  const anyP = product as any;
  const displayPrice = Number(anyP?.price_client ?? anyP?.price ?? 0);

  return (
    <div className="container-xxl py-4">
      {/* Actions */}
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
            <div className="h5 m-0">{moneyMAD(displayPrice)}</div>
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
