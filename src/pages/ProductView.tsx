// src/pages/ProductView.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { API_BASE } from "../services/http";
import ProductRating from "../components/ProductRating";
import { useCart } from "../store/cart";
import { trackAddToCart } from "../lib/analytics";
import { getAccessToken, getCurrentUser, me, type Role as AuthRole } from "../services/auth";

/* =========================
 * Helpers
 * =======================*/
function imgUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return s;
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
  if (t === "fashion" || t.includes("fashion") || t.includes("mode")) return "/fashion";
  return "/african-market";
}

/* ===== Share path helpers ===== */
function safeDecodeURIComponent(x: string) {
  try {
    return decodeURIComponent(x);
  } catch {
    return x;
  }
}

function normalizeIdOrSlug(x: string) {
  const v = String(x || "").trim();
  if (!v) return "";
  const m1 = v.match(/^product\/(.+)$/i);
  if (m1?.[1]) return m1[1].trim();
  const m2 = v.match(/\/(share\/product|products)\/([^/?#]+)/i);
  if (m2?.[2]) return m2[2].trim();
  return v;
}

function extractSharedProductId(locationSearch: string, locationHash: string) {
  const qs = new URLSearchParams(locationSearch || "");
  const candidates = [
    qs.get("p"),
    qs.get("id"),
    qs.get("product"),
    qs.get("pid"),
    qs.get("productId"),
    qs.get("product_id"),
  ]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean);

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return String(n);
  }

  const h = String(locationHash || "");
  const m1 = h.match(/product\/(\d+)/i);
  if (m1?.[1]) return m1[1];
  const m2 = h.match(/product(?:Id)?=(\d+)/i);
  if (m2?.[1]) return m2[1];

  return "";
}

/* =========================
 * Promo helpers
 * =======================*/
type PromoDiscountType = "PERCENT" | "AMOUNT";

function normPromoType(v: any): PromoDiscountType {
  const s = String(v || "").trim().toUpperCase();
  return s === "AMOUNT" ? "AMOUNT" : "PERCENT";
}

function computePromoPrice(price: number, type: PromoDiscountType, value: number) {
  const p = Number(price || 0);
  const v = Number(value || 0);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (!Number.isFinite(v) || v <= 0) return p;

  if (type === "PERCENT") {
    const pct = Math.max(0, Math.min(100, v));
    const res = p - (p * pct) / 100;
    return Math.max(0, Number(res.toFixed(2)));
  }

  return Math.max(0, Number((p - v).toFixed(2)));
}

function hasRealPromo(p: any) {
  return Number(p?.promo_eligible ?? 0) === 1 && Number(p?.promo_discount_value ?? 0) > 0;
}

/* =========================
 * Variantes
 * =======================*/
type UiVariant = {
  id: number;
  key: string;
  label: string;
  price: number | null; // price_override
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

    const po = v?.price_override;
    const price = po == null || po === "" ? null : Number(po);

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

/* ===== Modal infos (description) ===== */
function InfoModal(props: { title: string; body: string; onClose: () => void }) {
  const { title, body, onClose } = props;

  useEffect(() => {
    document.body.classList.add("modal-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Fermer" onClick={onClose} />
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
                {body}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-outline-dark" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== fetch helper (timeout + abort) ===== */
async function fetchJSON(url: string, ms = 12000, init?: RequestInit) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const ok = res.ok;
    const data = ok ? await res.json() : null;
    return { res, ok, data };
  } finally {
    window.clearTimeout(t);
  }
}

/* =========================
 * Viewer Role (based on your backend roles)
 * =======================*/
type ViewerRole = "GUEST" | "MEMBER" | "VENDEUR" | "FOURNISSEUR" | "RESTAURANT" | "LIVREUR" | "ADMIN";

function normalizeViewerRole(role?: AuthRole | null): ViewerRole {
  const r = String(role || "").trim().toUpperCase();
  if (r === "ADMIN") return "ADMIN";
  if (r === "VENDEUR") return "VENDEUR";
  if (r === "FOURNISSEUR") return "FOURNISSEUR";
  if (r === "RESTAURANT") return "RESTAURANT";
  if (r === "LIVREUR") return "LIVREUR";
  if (r === "MEMBER") return "MEMBER";
  return "GUEST";
}

function canSeeVendorPanel(vr: ViewerRole) {
  return vr === "VENDEUR" || vr === "RESTAURANT" || vr === "ADMIN";
}
function canSeeSupplierPanel(vr: ViewerRole) {
  return vr === "FOURNISSEUR" || vr === "ADMIN";
}
function canOrder(vr: ViewerRole) {
  // ✅ toi tu veux généralement: tout le monde peut commander (même guest)
  // si tu veux interdire aux fournisseurs/livreurs => modifie ici.
  return vr !== "FOURNISSEUR" && vr !== "LIVREUR";
}

function nnum(x: any): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export default function ProductView() {
  const { idOrSlug: rawParam } = useParams<{ idOrSlug: string }>();
  const nav = useNavigate();
  const location = useLocation();

  const { add, qtyForProductVariant, qtyForProduct } = useCart();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [related, setRelated] = useState<Product[]>([]);
  const [relatedTitle, setRelatedTitle] = useState<string>("Vous aimerez aussi");

  const [infoOpen, setInfoOpen] = useState(false);

  // ✅ viewer / role
  const [viewerRole, setViewerRole] = useState<ViewerRole>("GUEST");
  const [viewerUser, setViewerUser] = useState<any>(null);

  // ===== init viewer (supports impersonation via getAccessToken)
  useEffect(() => {
    let stop = false;

    (async () => {
      try {
        // 1) fast from storage
        const local = getCurrentUser?.();
        if (!stop && local?.role) {
          setViewerUser(local);
          setViewerRole(normalizeViewerRole(local.role));
        }

        // 2) if token, refresh from DB
        const token = getAccessToken?.();
        if (!token) {
          if (!stop) setViewerRole((prev) => prev || "GUEST");
          return;
        }

        const u = await me();
        if (!stop && u) {
          setViewerUser(u);
          setViewerRole(normalizeViewerRole(u.role));
        }
      } catch {
        if (!stop) setViewerRole((prev) => prev || "GUEST");
      }
    })();

    return () => {
      stop = true;
    };
  }, []);

  const anyP = product as any;

  const title = useMemo(() => String(anyP?.name || "Produit"), [anyP?.name]);

  const cover = useMemo(
    () => anyP?.cover || anyP?.images?.[0]?.url || anyP?.image || null,
    [anyP?.cover, anyP?.images, anyP?.image]
  );
  const coverUrl = useMemo(() => imgUrl(cover), [cover]);

  const productIsActive = useMemo(() => isActiveProduct(product), [product]);
  const sectionPath = useMemo(() => sectionPathFor(product), [product]);

  const resolvedIdOrSlug = useMemo(() => {
    const p = normalizeIdOrSlug(safeDecodeURIComponent(String(rawParam || "")));
    const fromShareQuery = extractSharedProductId(location.search, location.hash);
    return p || fromShareQuery || "";
  }, [rawParam, location.search, location.hash]);

  // ===== CONTEXTE d’origine =====
  const origin = useMemo(() => {
    const st: any = (location.state as any) || {};
    const from = st.from || st.origin || st.ctx || st || {};

    const originCategoryId = Number(from.categoryId ?? from.category_id ?? 0) || 0;
    const originSubCategoryId = Number(from.subCategoryId ?? from.sub_category_id ?? 0) || 0;

    const originCategorySlug = String(from.categorySlug ?? from.category_slug ?? "").trim();
    const originSubCategorySlug = String(from.subCategorySlug ?? from.sub_category_slug ?? "").trim();

    const originSectionPath = String(from.sectionPath ?? from.section_path ?? "").trim();
    const originListPath = String(from.listPath ?? from.list_path ?? from.fromPath ?? "").trim();
    const originLabel = String(from.label ?? "").trim();

    return {
      categoryId: originCategoryId || null,
      subCategoryId: originSubCategoryId || null,
      categorySlug: originCategorySlug || null,
      subCategorySlug: originSubCategorySlug || null,
      sectionPath: originSectionPath || null,
      listPath: originListPath || null,
      label: originLabel || null,
    };
  }, [location.state]);

  const backPath = useMemo(() => {
    if (origin?.listPath) return origin.listPath;
    if (origin?.sectionPath) return origin.sectionPath;
    return sectionPath;
  }, [origin?.listPath, origin?.sectionPath, sectionPath]);

  const handleBack = useCallback(() => {
    if (origin?.listPath || origin?.sectionPath) {
      nav(backPath);
      return;
    }

    if (window.history && window.history.length > 1 && document.referrer) {
      nav(-1);
      return;
    }
    nav(sectionPath);
  }, [nav, origin?.listPath, origin?.sectionPath, backPath, sectionPath]);

  // ===== load product =====
  useEffect(() => {
    let stop = false;

    (async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      try {
        if (!resolvedIdOrSlug) throw new Error("Produit introuvable");

        const asId = Number(resolvedIdOrSlug);
        if (Number.isFinite(asId) && asId > 0) {
          const r1 = await fetchJSON(`${API_BASE}/api/products/${asId}?variants=1`, 12000, {
            credentials: "omit",
          });
          if (!stop && r1.ok) {
            setProduct((r1.data as Product) || null);
            return;
          }
        }

        const r2 = await fetchJSON(
          `${API_BASE}/api/products/slug/${encodeURIComponent(resolvedIdOrSlug)}?variants=1`,
          12000,
          { credentials: "omit" }
        );
        if (!stop && r2.ok) {
          setProduct((r2.data as Product) || null);
          return;
        }

        const cleaned = String(resolvedIdOrSlug).split("?")[0].split("#")[0].trim();
        const n2 = Number(cleaned);
        if (Number.isFinite(n2) && n2 > 0 && cleaned !== resolvedIdOrSlug) {
          const r3 = await fetchJSON(`${API_BASE}/api/products/${n2}?variants=1`, 12000, {
            credentials: "omit",
          });
          if (!stop && r3.ok) {
            setProduct((r3.data as Product) || null);
            return;
          }
        }

        throw new Error("Produit introuvable");
      } catch (e: any) {
        const msg =
          e?.name === "AbortError"
            ? "Chargement trop lent. Réessaie."
            : e?.message || "Erreur de chargement";
        if (!stop) setError(msg);
      } finally {
        if (!stop) setLoading(false);
      }
    })();

    return () => {
      stop = true;
    };
  }, [resolvedIdOrSlug]);

  // ===== related products =====
  useEffect(() => {
    let stop = false;

    (async () => {
      if (!product) return;

      try {
        const pAny = product as any;
        const currentId = Number(pAny?.id || 0);

        const originSubId = origin?.subCategoryId ? Number(origin.subCategoryId) : 0;
        const originCatId = origin?.categoryId ? Number(origin.categoryId) : 0;

        const fallbackSubId = Number(pAny?.sub_category_id || 0);
        const fallbackCatId = Number(pAny?.category_id || 0);

        const subId = originSubId || fallbackSubId || 0;
        const catId = originCatId || fallbackCatId || 0;

        const vertical = String(pAny?.vertical || "").trim().toUpperCase() || null;

        const qs = new URLSearchParams();
        qs.set("page", "1");
        qs.set("pageSize", "48");

        if (subId) qs.set("subCategoryId", String(subId));
        else if (catId) qs.set("categoryId", String(catId));

        if (vertical) qs.set("vertical", vertical);
        if (vertical === "FASHION") qs.set("includeVariants", "1");

        const url = `${API_BASE}/api/products?${qs.toString()}`;
        const r = await fetchJSON(url, 12000, { credentials: "omit" });

        const data: any = r.ok ? r.data : null;
        const items: Product[] = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];

        const rel = items
          .filter((x) => isActiveProduct(x))
          .filter((x) => Number((x as any).id) !== currentId)
          .slice(0, 12);

        if (!stop) {
          setRelated(rel);

          const label =
            origin?.label ||
            (subId
              ? "Plus de produits de la même sous-catégorie"
              : catId
              ? "Plus de produits de la même catégorie"
              : "Vous aimerez aussi");

          setRelatedTitle(label);
        }
      } catch {
        if (!stop) {
          setRelated([]);
          setRelatedTitle("Vous aimerez aussi");
        }
      }
    })();

    return () => {
      stop = true;
    };
  }, [product, origin]);

  // ===== base price / stock =====
  const basePriceClient = useMemo(() => {
    // ✅ prix “client” robuste
    return Number(anyP?.price_client ?? anyP?.client_price ?? anyP?.price ?? 0);
  }, [anyP?.price_client, anyP?.client_price, anyP?.price]);

  const vendorPrice = useMemo(() => {
    // ✅ prix “vendeur” (si dispo)
    const v = nnum(anyP?.vendor_price);
    return v == null ? null : v;
  }, [anyP?.vendor_price]);

  const supplierCost = useMemo(() => {
    // ✅ coût fournisseur/wholesale (si dispo)
    const v = nnum(anyP?.supplier_cost ?? anyP?.price_wholesale ?? anyP?.cost_price);
    return v == null ? null : v;
  }, [anyP?.supplier_cost, anyP?.price_wholesale, anyP?.cost_price]);

  const supplierStock = useMemo(() => {
    const v = nnum(anyP?.supplier_stock ?? anyP?.stock_qty ?? anyP?.supplier_qty);
    return v == null ? null : v;
  }, [anyP?.supplier_stock, anyP?.stock_qty, anyP?.supplier_qty]);

  const stock = useMemo(() => {
    const s = anyP?.stock;
    return s == null || s === "" ? null : Number(s);
  }, [anyP?.stock]);

  const isOutOfStock = stock === 0;

  // ===== variants =====
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

  const selectedVariant = useMemo(
    () => variants.find((v) => v.key === selectedKey) || null,
    [variants, selectedKey]
  );

  // ✅ prix "normal"
  const regularPrice = useMemo(() => {
    if (selectedVariant?.price != null) return Number(selectedVariant.price);
    return basePriceClient;
  }, [basePriceClient, selectedVariant]);

  // ===== promo computed =====
  const promoActive = useMemo(() => hasRealPromo(anyP), [anyP]);
  const promoType = useMemo(() => normPromoType(anyP?.promo_discount_type), [anyP?.promo_discount_type]);
  const promoValue = useMemo(() => Number(anyP?.promo_discount_value ?? 0), [anyP?.promo_discount_value]);

  const promoPrice = useMemo(() => {
    if (!promoActive) return regularPrice;
    return computePromoPrice(regularPrice, promoType, promoValue);
  }, [promoActive, promoType, promoValue, regularPrice]);

  const displayPrice = promoActive ? promoPrice : regularPrice;

  const promoSavedLabel = useMemo(() => {
    if (!promoActive) return "";
    if (promoType === "PERCENT") return `-${Math.round(promoValue)}%`;
    return `-${moneyMAD(promoValue)}`;
  }, [promoActive, promoType, promoValue]);

  const promoFreeDelivery = useMemo(() => Number(anyP?.promo_free_delivery ?? 0) === 1, [anyP?.promo_free_delivery]);

  const badge = useMemo(() => {
    const v = String(anyP?.vertical || "").trim().toUpperCase();
    if (v === "FASHION") return "Fashion";
    return String(anyP?.sub_category_slug || "").toLowerCase() === "food" ? "Food" : "Market";
  }, [anyP?.sub_category_slug, anyP?.vertical]);

  // ===== qty in cart =====
  const qtySelected = useMemo(() => {
    if (!product) return 0;
    const pid = Number((product as any).id);
    if (!hasVariants) return qtyForProduct(pid);
    const key = selectedVariant?.key || "default";
    return qtyForProductVariant(pid, key);
  }, [product, hasVariants, qtyForProduct, qtyForProductVariant, selectedVariant]);

  const canAddNow =
    canOrder(viewerRole) &&
    !isOutOfStock &&
    (!hasVariants || (!!selectedVariant && !isVariantOutOfStock(selectedVariant)));

  // ===== pro panels & margins =====
  const showVendorPanel = useMemo(() => canSeeVendorPanel(viewerRole), [viewerRole]);
  const showSupplierPanel = useMemo(() => canSeeSupplierPanel(viewerRole), [viewerRole]);

  const marginVsVendor = useMemo(() => {
    if (!showVendorPanel) return null;
    if (vendorPrice == null) return null;
    const m = Number(displayPrice || 0) - Number(vendorPrice || 0);
    if (!Number.isFinite(m)) return null;
    return m;
  }, [displayPrice, showVendorPanel, vendorPrice]);

  const marginVsSupplier = useMemo(() => {
    if (!showSupplierPanel) return null;
    if (supplierCost == null) return null;
    const m = Number(displayPrice || 0) - Number(supplierCost || 0);
    if (!Number.isFinite(m)) return null;
    return m;
  }, [displayPrice, showSupplierPanel, supplierCost]);

  // ===== actions =====
  const handleAdd = useCallback(() => {
    if (!product) return;
    if (!canAddNow) return;

    const pAny = product as any;
    const cartPrice = Number(displayPrice || 0);

    add(product, 1, {
      variant:
        hasVariants && selectedVariant
          ? {
              variant_id: selectedVariant.id,
              variant_key: selectedVariant.key,
              label: selectedVariant.label,
              price: cartPrice,
            }
          : { variant_id: null, variant_key: "default", label: null, price: cartPrice },
    });

    trackAddToCart({
      productId: pAny.id,
      name: pAny.name,
      price: cartPrice,
      quantity: 1,
      currency: "MAD",
      category: String(pAny?.sub_category_slug || pAny?.sub_category_name || ""),
    });
  }, [add, canAddNow, displayPrice, hasVariants, product, selectedVariant]);

  const handleDecrease = useCallback(() => {
    if (!product) return;
    if (!qtySelected) return;

    const cartPrice = Number(displayPrice || 0);

    add(product, -1, {
      variant:
        hasVariants && selectedVariant
          ? {
              variant_id: selectedVariant.id,
              variant_key: selectedVariant.key,
              label: selectedVariant.label,
              price: cartPrice,
            }
          : { variant_id: null, variant_key: "default", label: null, price: cartPrice },
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
          <button className="btn btn-outline-dark" onClick={handleBack} type="button">
            ← Retour
          </button>
          <Link to={backPath} className="btn btn-dark">
            Explorer
          </Link>
        </div>

        <div className="alert alert-warning d-flex align-items-center" role="alert">
          <span className="me-2">⚠️</span>
          <span>
            {product && !productIsActive ? "Ce produit n'est plus disponible." : error || "Produit introuvable"}
          </span>
        </div>
      </div>
    );
  }

  const desc = String(anyP?.description || "").trim();

  return (
    <div className="container-xxl py-4">
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center justify-content-between">
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-dark" onClick={handleBack} type="button">
            ← Retour
          </button>
          <Link to={backPath} className="btn btn-dark">
            Explorer
          </Link>
        </div>

        {/* ✅ Badge rôle (debug soft, utile en impersonation) */}
        <span className="badge text-bg-light border">
          Rôle: <strong className="ms-1">{viewerRole}</strong>
          {viewerUser?.impersonation?.impersonate_shop_id ? (
            <span className="ms-2 text-muted">
              (impersonation shop #{viewerUser.impersonation.impersonate_shop_id})
            </span>
          ) : null}
        </span>
      </div>

      <h1 className="h4 mb-3">{title}</h1>

      <div className="row g-4">
        <div className="col-12 col-md-6">
          <div className="position-relative">
            {coverUrl ? (
              <img src={coverUrl} alt={String(anyP?.name || "")} className="img-fluid rounded" />
            ) : (
              <div className="bg-light rounded" style={{ width: "100%", paddingTop: "100%" }} />
            )}

            {promoActive && (
              <span
                className="badge"
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  background: "var(--duu-red,#E53935)",
                  color: "#fff",
                  fontWeight: 900,
                  padding: "8px 10px",
                  borderRadius: 999,
                  boxShadow: "0 10px 20px rgba(229,57,53,.22)",
                }}
              >
                PROMO {promoSavedLabel}
              </span>
            )}

            {promoActive && promoFreeDelivery && (
              <span
                className="badge"
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  background: "rgba(0,0,0,.85)",
                  color: "#fff",
                  fontWeight: 900,
                  padding: "7px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.18)",
                }}
              >
                🚚 Livraison gratuite
              </span>
            )}
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <div className="h5 m-0 d-flex align-items-baseline gap-2 flex-wrap">
              <span style={{ fontWeight: 950 }}>{moneyMAD(displayPrice)}</span>

              {promoActive && (
                <span
                  style={{
                    textDecoration: "line-through",
                    color: "rgba(0,0,0,.45)",
                    fontWeight: 800,
                    fontSize: ".95rem",
                  }}
                >
                  {moneyMAD(regularPrice)}
                </span>
              )}
            </div>

            <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">
              {badge}
            </span>
            {hasVariants && <span className="badge text-bg-light border">Variantes</span>}

            {promoActive && (
              <span
                className="badge"
                style={{
                  background: "rgba(229,57,53,.10)",
                  color: "var(--duu-red,#E53935)",
                  border: "1px solid rgba(229,57,53,.20)",
                  fontWeight: 900,
                }}
              >
                {promoSavedLabel}
              </span>
            )}
          </div>

          <div className="mb-3">
            <ProductRating productId={Number(anyP?.id)} />
          </div>

          {hasVariants && (
            <div className="mb-3">
              <div className="small text-muted mb-1">Choisir une variante</div>

              <select className="form-select" value={selectedKey || ""} onChange={(e) => setSelectedKey(e.target.value)}>
                {variants.map((v) => (
                  <option key={v.key} value={v.key} disabled={isVariantOutOfStock(v)}>
                    {v.label}
                  </option>
                ))}
              </select>

              {selectedVariant && (
                <div className="small text-muted mt-2">
                  {selectedVariant.stock != null && (
                    <span className="me-3">
                      Reste : <strong>{Math.max(0, Number(selectedVariant.stock))}</strong>
                    </span>
                  )}

                  {selectedVariant.price != null && !promoActive && (
                    <span>
                      Prix : <strong>{moneyMAD(selectedVariant.price)}</strong>
                    </span>
                  )}

                  {promoActive && (
                    <span>
                      Prix : <strong>{moneyMAD(displayPrice)}</strong>
                      <span
                        style={{
                          textDecoration: "line-through",
                          color: "rgba(0,0,0,.45)",
                          fontWeight: 800,
                          marginLeft: 6,
                        }}
                      >
                        {moneyMAD(regularPrice)}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {selectedVariant && isVariantOutOfStock(selectedVariant) && (
                <div className="alert alert-warning mt-2 py-2 small mb-0">Cette variante est en rupture.</div>
              )}
            </div>
          )}

          {/* ✅ PANELS PRO: vendeur/restaurant/fournisseur/admin */}
          {(showVendorPanel || showSupplierPanel) && (
            <div className="alert alert-light border mb-3 py-2">
              <div className="fw-bold small mb-2">Infos Pro</div>

              {showVendorPanel && (
                <div className="small text-muted">
                  <div>
                    Prix vendeur : <strong>{moneyMAD(vendorPrice ?? 0)}</strong>
                    {vendorPrice == null && <span className="ms-2">(non défini)</span>}
                  </div>

                  {marginVsVendor != null && vendorPrice != null && (
                    <div>
                      Marge (client − vendeur) :{" "}
                      <strong style={{ color: marginVsVendor >= 0 ? "inherit" : "var(--duu-red,#E53935)" }}>
                        {moneyMAD(marginVsVendor)}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {showSupplierPanel && (
                <div className="small text-muted mt-2">
                  <div>
                    Stock fournisseur : <strong>{supplierStock ?? 0}</strong>
                    {supplierStock == null && <span className="ms-2">(non défini)</span>}
                  </div>
                  <div>
                    Coût wholesale : <strong>{moneyMAD(supplierCost ?? 0)}</strong>
                    {supplierCost == null && <span className="ms-2">(non défini)</span>}
                  </div>

                  {marginVsSupplier != null && supplierCost != null && (
                    <div>
                      Marge (client − wholesale) :{" "}
                      <strong style={{ color: marginVsSupplier >= 0 ? "inherit" : "var(--duu-red,#E53935)" }}>
                        {moneyMAD(marginVsSupplier)}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

            {!canOrder(viewerRole) && (
              <span className="badge text-bg-warning align-self-center">Commande désactivée pour ce rôle</span>
            )}
          </div>

          {desc ? (
            <>
              <div className="small text-muted mb-1">Description</div>
              <button
                type="button"
                className="btn btn-link p-0 text-start text-decoration-none"
                onClick={() => setInfoOpen(true)}
                style={{ color: "inherit" }}
              >
                <p className="text-muted mb-0">
                  {desc.length > 160 ? desc.slice(0, 160) + "…" : desc}
                  <span className="ms-1 text-decoration-underline">Voir plus</span>
                </p>
              </button>
            </>
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

      <div className="mt-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h2 className="h6 m-0">{relatedTitle}</h2>
          <Link to={backPath} className="btn btn-sm btn-outline-dark">
            Voir tout
          </Link>
        </div>

        {related.length > 0 ? (
          <div className="row g-2 g-sm-3">
            {related.map((p) => (
              <div key={(p as any).id} className="col-6 col-md-4 col-lg-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted small">Aucun autre produit trouvé pour le moment.</div>
        )}
      </div>

      {infoOpen && (
        <InfoModal
          title={String(anyP?.name || "Infos produit")}
          body={desc || "Aucune description."}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
}