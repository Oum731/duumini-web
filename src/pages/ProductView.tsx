// src/pages/ProductView.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { API_BASE } from "../services/http";
import ProductRating from "../components/ProductRating";
import { useCart } from "../store/cart";
import { trackAddToCart } from "../lib/analytics";

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

function isActiveProduct(p: Product | null | undefined) {
  if (!p) return false;
  const anyP = p as any;
  return Number(anyP.is_active ?? anyP.active ?? 1) === 1;
}

function subToken(p: Product | null | undefined) {
  if (!p) return "";
  const anyP = p as any;
  const s = String(anyP.sub_category_slug ?? anyP.sub_category_name ?? "")
    .trim()
    .toLowerCase();
  if (s) return s;

  const id = anyP.sub_category_id;
  if (id != null && String(id).trim() !== "") return String(id).trim().toLowerCase();

  return "";
}

function sectionPathFor(p: Product | null | undefined) {
  const t = subToken(p);
  if (t === "food" || t.includes("food") || t.includes("alimentation")) return "/african-food";
  return "/african-market";
}

/* ===== Variantes (même logique que ProductCard) ===== */
type UiVariant = {
  id: number;
  key: string; // id:xx
  label: string;
  price: number | null;
  stock: number | null;
};

function buildVariantLabel(v: any) {
  const name = String(v?.name || v?.title || "").trim();
  if (name) return name;

  const attrs = v?.attrs && typeof v.attrs === "object" ? v.attrs : null;
  const parts: string[] = [];

  const size = String(v?.size ?? attrs?.size ?? "").trim();
  const color = String(v?.color ?? attrs?.color ?? "").trim();

  if (size) parts.push(`Taille: ${size}`);
  if (color) parts.push(`Couleur: ${color}`);

  if (attrs) {
    for (const k of Object.keys(attrs)) {
      if (k === "size" || k === "color") continue;
      const val = String(attrs[k] ?? "").trim();
      if (val) parts.push(`${k}: ${val}`);
    }
  }

  if (parts.length) return parts.join(" • ");

  const sku = String(v?.sku || "").trim();
  if (sku) return sku;

  return `Variante #${Number(v?.id || 0) || "?"}`;
}

function parseVariants(product: Product | null): UiVariant[] {
  if (!product) return [];
  const anyP = product as any;
  const raw = Array.isArray(anyP.variants) ? anyP.variants : [];

  const out: UiVariant[] = [];
  for (const v of raw) {
    const id = Number(v?.id || 0);
    if (!id) continue;

    const label = buildVariantLabel(v);

    const priceRaw = v?.price ?? v?.price_client ?? v?.client_price ?? null;
    const price = priceRaw == null || priceRaw === "" ? null : Number(priceRaw);

    const stockRaw = v?.stock ?? v?.qty ?? null;
    const stock = stockRaw == null || stockRaw === "" ? null : Number(stockRaw);

    out.push({
      id,
      key: `id:${id}`,
      label,
      price: Number.isFinite(price as any) ? (price as number) : null,
      stock: Number.isFinite(stock as any) ? (stock as number) : null,
    });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.key)) return false;
    seen.add(x.key);
    return true;
  });
}

function isVariantOutOfStock(v: UiVariant) {
  return v.stock === 0;
}

export default function ProductView() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const nav = useNavigate();

  const { add, qtyForProductVariant, qtyForProduct } = useCart();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<Product[]>([]);

  const anyP = product as any;

  const title = useMemo(() => String(anyP?.name || "Produit"), [anyP?.name]);

  const cover = useMemo(() => anyP?.cover || anyP?.images?.[0]?.url || anyP?.image || null, [anyP?.cover, anyP?.images, anyP?.image]);
  const coverUrl = useMemo(() => imgUrl(cover), [cover]);

  const productIsActive = useMemo(() => isActiveProduct(product), [product]);
  const sectionPath = useMemo(() => sectionPathFor(product), [product]);

  const handleBack = useCallback(() => {
    if (window.history && window.history.length > 1 && document.referrer) {
      nav(-1);
      return;
    }
    nav(sectionPath);
  }, [nav, sectionPath]);

  // ===== load product by id or slug =====
  useEffect(() => {
    let stop = false;

    (async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      try {
        if (!idOrSlug) throw new Error("Produit introuvable");

        const asId = Number(idOrSlug);
        if (Number.isFinite(asId) && asId > 0) {
          const res = await fetch(`${API_BASE}/api/products/${asId}`, { credentials: "omit" });
          if (res.ok) {
            const p = (await res.json()) as Product;
            if (!stop) setProduct(p || null);
            return;
          }
        }

        const resSlug = await fetch(`${API_BASE}/api/products/slug/${encodeURIComponent(idOrSlug)}`, { credentials: "omit" });
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

  // ===== related products (même groupe) =====
  useEffect(() => {
    let stop = false;

    (async () => {
      if (!product) return;

      try {
        // ✅ plus besoin de listProducts → évite l’avertissement TS
        const res = await fetch(`${API_BASE}/api/products?page=1&pageSize=60`, { credentials: "omit" });
        const data = res.ok ? await res.json() : null;

        const items: Product[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const pAny = product as any;

        const subId = Number(pAny?.sub_category_id || 0);
        const catId = Number(pAny?.category_id || 0);
        const subSlug = String(pAny?.sub_category_slug || "").trim().toLowerCase();

        const isSameGroup = (p: Product) => {
          const anyX = p as any;
          const xSubId = Number(anyX?.sub_category_id || 0);
          const xCatId = Number(anyX?.category_id || 0);
          const xSlug = String(anyX?.sub_category_slug || "").trim().toLowerCase();

          if (subId && xSubId) return xSubId === subId;
          if (subSlug && xSlug) return xSlug === subSlug;
          if (catId && xCatId) return xCatId === catId;
          return false;
        };

        const rel = items
          .filter((p) => (p as any).id !== (product as any).id && isSameGroup(p) && isActiveProduct(p))
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

  // ===== pricing / stock =====
  const basePrice = useMemo(() => Number(anyP?.price_client ?? anyP?.client_price ?? anyP?.price ?? 0), [anyP?.price_client, anyP?.client_price, anyP?.price]);
  const stock = useMemo(() => anyP?.stock, [anyP?.stock]);
  const isOutOfStock = stock === 0;

  // ===== variants state =====
  const variants = useMemo(() => parseVariants(product), [product]);
  const hasVariants = variants.length > 0;

  const [selectedKey, setSelectedKey] = useState<string>("");

  useEffect(() => {
    if (!hasVariants) {
      setSelectedKey("");
      return;
    }
    setSelectedKey((prev) => {
      if (prev && variants.some((v) => v.key === prev)) return prev;
      const firstOk = variants.find((v) => !isVariantOutOfStock(v)) || variants[0];
      return firstOk?.key || "";
    });
  }, [hasVariants, variants]);

  const selectedVariant = useMemo(() => variants.find((v) => v.key === selectedKey) || null, [variants, selectedKey]);

  const displayPrice = useMemo(() => {
    if (selectedVariant?.price != null) return Number(selectedVariant.price);
    return basePrice;
  }, [basePrice, selectedVariant]);

  const badge = useMemo(() => (String(anyP?.sub_category_slug || "").toLowerCase() === "food" ? "Food" : "Market"), [anyP?.sub_category_slug]);

  const qtySelected = useMemo(() => {
    if (!product) return 0;
    const pid = Number((product as any).id);
    if (!hasVariants) return qtyForProduct(pid);
    const key = selectedVariant?.key || "default";
    return qtyForProductVariant(pid, key);
  }, [product, hasVariants, qtyForProduct, qtyForProductVariant, selectedVariant]);

  const canAddNow = !isOutOfStock && (!hasVariants || (!!selectedVariant && !isVariantOutOfStock(selectedVariant)));

  const handleAdd = useCallback(() => {
    if (!product) return;
    if (!canAddNow) return;

    const pAny = product as any;

    add(product, 1, {
      variant: hasVariants && selectedVariant
        ? {
            variant_id: selectedVariant.id,
            variant_key: selectedVariant.key,
            label: selectedVariant.label,
            price: selectedVariant.price ?? displayPrice,
          }
        : { variant_id: null, variant_key: "default", label: null, price: displayPrice },
    });

    trackAddToCart({
      productId: pAny.id,
      name: pAny.name,
      price: displayPrice,
      quantity: 1,
      currency: "MAD",
      category: String(pAny?.sub_category_slug || pAny?.sub_category_name || ""),
    });
  }, [add, canAddNow, displayPrice, hasVariants, product, selectedVariant]);

  const handleDecrease = useCallback(() => {
    if (!product) return;
    if (!qtySelected) return;

    add(product, -1, {
      variant: hasVariants && selectedVariant
        ? {
            variant_id: selectedVariant.id,
            variant_key: selectedVariant.key,
            label: selectedVariant.label,
            price: selectedVariant.price ?? displayPrice,
          }
        : { variant_id: null, variant_key: "default", label: null, price: displayPrice },
    });
  }, [add, displayPrice, hasVariants, product, qtySelected, selectedVariant]);

  // ===== UI states =====
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
          <span>{product && !productIsActive ? "Ce produit n'est plus disponible." : error || "Produit introuvable"}</span>
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
            <img src={coverUrl} alt={String(anyP?.name || "")} className="img-fluid rounded" />
          ) : (
            <div className="bg-light rounded" style={{ width: "100%", paddingTop: "100%" }} />
          )}
        </div>

        <div className="col-12 col-md-6">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <div className="h5 m-0">{moneyMAD(displayPrice)}</div>
            <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">{badge}</span>
            {hasVariants && selectedVariant?.price != null && (
              <span className="badge text-bg-light border">Variante</span>
            )}
          </div>

          <div className="mb-3">
            <ProductRating productId={Number(anyP?.id)} />
          </div>

          {/* ✅ Variantes */}
          {hasVariants && (
            <div className="mb-3">
              <div className="small text-muted mb-1">Choisir une variante</div>
              <select className="form-select" value={selectedKey || ""} onChange={(e) => setSelectedKey(e.target.value)}>
                {variants.map((v) => (
                  <option key={v.key} value={v.key} disabled={isVariantOutOfStock(v)}>
                    {v.label}
                    {v.price != null ? ` — ${moneyMAD(v.price)}` : ""}
                    {isVariantOutOfStock(v) ? " (rupture)" : ""}
                  </option>
                ))}
              </select>

              {selectedVariant && isVariantOutOfStock(selectedVariant) && (
                <div className="alert alert-warning mt-2 py-2 small mb-0">Cette variante est en rupture.</div>
              )}
            </div>
          )}

          {/* ✅ Actions panier */}
          <div className="d-flex gap-2 mb-3">
            {qtySelected > 0 ? (
              <div className="btn-group" role="group" aria-label="Quantité panier">
                <button className="btn btn-outline-dark" onClick={handleDecrease} type="button">
                  −
                </button>
                <button className="btn btn-light disabled" type="button">
                  {qtySelected}
                </button>
                <button className="btn btn-duu" onClick={handleAdd} type="button" disabled={!canAddNow}>
                  +
                </button>
              </div>
            ) : (
              <button className="btn btn-duu fw-semibold" onClick={handleAdd} disabled={!canAddNow} type="button">
                + Ajouter au panier
              </button>
            )}

            {isOutOfStock && <span className="badge text-bg-danger align-self-center">En rupture</span>}
          </div>

          {anyP?.description ? (
            <p className="text-muted">{String(anyP.description)}</p>
          ) : (
            <p className="text-muted">Aucune description fournie.</p>
          )}

          <style>{`
            .btn-duu{
              background: var(--duu-yellow);
              color: #1f1f1f;
              border: none;
            }
            .btn-duu:hover{ filter: brightness(0.95); }
          `}</style>
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
              <div key={(p as any).id} className="col-6 col-md-4 col-lg-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
