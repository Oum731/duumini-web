// src/pages/ProductView.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Product } from "../services/products";
import { listProducts } from "../services/products";
import ProductCard from "../components/ProductCard";
import { API_BASE } from "../services/http";
import ProductRating from "../components/ProductRating";

import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";

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

type Channel = "african-food" | "african-market";

export default function ProductView() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  const [related, setRelated] = useState<Product[]>([]);

  const title = useMemo(() => product?.name || "Produit", [product]);
  const cover = product?.cover || (product as any)?.images?.[0]?.url || null;
  const coverUrl = imgUrl(cover);

  const productIsActive = useMemo(() => isProductActive(product), [product]);

  // --- maps
  const categoriesById = useMemo(() => {
    const m: Record<number, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const subById = useMemo(() => {
    const m: Record<number, SubCategory> = {};
    for (const s of subCategories) m[s.id] = s;
    return m;
  }, [subCategories]);

  // --- product ids
  const productCategoryId = useMemo(() => Number((product as any)?.category_id || 0) || 0, [product]);
  const productSubId = useMemo(() => Number((product as any)?.sub_category_id || 0) || 0, [product]);

  // --- infer channel from category name/slug OR known IDs (fallback market)
  const inferredChannel: Channel = useMemo(() => {
    // 1) si on a une sous-catégorie, on récupère sa catégorie parente
    const sub = productSubId ? subById[productSubId] : null;
    const catId = sub?.category_id ? Number(sub.category_id) : productCategoryId;
    const cat = catId ? categoriesById[catId] : null;

    const hay = `${cat?.slug || ""} ${cat?.name || ""}`.toLowerCase();

    // Règle simple: si la catégorie contient "food" / "aliment" / "épicerie" => food
    // Sinon => market
    if (
      hay.includes("food") ||
      hay.includes("aliment") ||
      hay.includes("epicer") ||
      hay.includes("épicer") ||
      hay.includes("frais") ||
      hay.includes("sec")
    ) {
      return "african-food";
    }
    return "african-market";
  }, [productSubId, productCategoryId, subById, categoriesById]);

  const sectionPath = useMemo(() => {
    return inferredChannel === "african-food" ? "/african-food" : "/african-market";
  }, [inferredChannel]);

  const handleBack = useCallback(() => {
    if (window.history && window.history.length > 1 && document.referrer) {
      nav(-1);
      return;
    }
    nav(sectionPath);
  }, [nav, sectionPath]);

  // Load product
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!idOrSlug) throw new Error("Produit introuvable");

        // 1) Try numeric ID
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

  // Load categories + subCategories (needed to compute section and labels)
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const [catsRes, subsRes] = await Promise.all([
          listCategories({ page: 1, pageSize: 500 } as any),
          listSubCategories({ page: 1, pageSize: 2000 } as any),
        ]);
        if (stop) return;
        setCategories((catsRes as any)?.items || []);
        setSubCategories((subsRes as any)?.items || []);
      } catch {
        if (!stop) {
          setCategories([]);
          setSubCategories([]);
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  // Load related products
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!product) return;

      try {
        const res = await listProducts({ page: 1, pageSize: 36, onlyActive: true } as any);
        const items: Product[] = Array.isArray((res as any)?.items) ? (res as any).items : [];

        const pid = Number(product.id);

        const targetSubId = Number((product as any)?.sub_category_id || 0) || 0;
        const targetCatId = Number((product as any)?.category_id || 0) || 0;

        const sameBucket = (p: Product) => {
          const pSub = Number((p as any)?.sub_category_id || 0) || 0;
          const pCat = Number((p as any)?.category_id || 0) || 0;

          // priorité: même sous-catégorie, sinon même catégorie
          if (targetSubId && pSub) return pSub === targetSubId;
          if (targetCatId && pCat) return pCat === targetCatId;
          return false;
        };

        const rel = items
          .filter((p) => Number(p.id) !== pid && sameBucket(p) && isProductActive(p))
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

  // label affichable (sans Food/Market)
  const subLabel = useMemo(() => {
    if (!productSubId) return null;
    const s = subById[productSubId];
    return s?.name || null;
  }, [productSubId, subById]);

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
            <div className="bg-light rounded" style={{ width: "100%", paddingTop: "100%" }} />
          )}
        </div>

        <div className="col-12 col-md-6">
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <div className="h5 m-0">{moneyMAD((product as any).price_client ?? product.price)}</div>

            {subLabel ? (
              <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">
                {subLabel}
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
