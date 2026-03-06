// src/pages/ProductView.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Product } from "../services/products";
import ProductCard from "../components/ProductCard";
import { API_BASE } from "../services/http";
import ProductRating from "../components/ProductRating";
import { useCart } from "../store/cart";
import { trackAddToCart } from "../lib/analytics";
import {
  getAccessToken,
  getCurrentUser,
  me,
  type Role as AuthRole,
} from "../services/auth";
import { metaAddToCart, metaViewContent } from "../lib/metaPixel";

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

function shortText(s?: string | null, max = 180) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
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
  if (id != null && String(id).trim() !== "") {
    return String(id).trim().toLowerCase();
  }

  return "";
}

function sectionPathFor(p: Product | null | undefined) {
  const t = subToken(p);
  if (t === "food" || t.includes("food") || t.includes("alimentation")) {
    return "/african-food";
  }
  if (t === "fashion" || t.includes("fashion") || t.includes("mode")) {
    return "/fashion";
  }
  return "/african-market";
}

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

  const clean = v.split("?")[0].split("#")[0].trim();

  if (clean.startsWith("product/")) {
    return clean.slice("product/".length).trim();
  }

  const parts = clean.split("/").filter(Boolean);

  const productsIndex = parts.findIndex((p) => {
    const s = p.toLowerCase();
    return s === "products" || s === "product";
  });
  if (productsIndex >= 0 && parts[productsIndex + 1]) {
    return parts[productsIndex + 1].trim();
  }

  const shareIndex = parts.findIndex((p) => p.toLowerCase() === "share");
  if (
    shareIndex >= 0 &&
    parts[shareIndex + 1]?.toLowerCase() === "product" &&
    parts[shareIndex + 2]
  ) {
    return parts[shareIndex + 2].trim();
  }

  return clean;
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

function computePromoPrice(
  price: number,
  type: PromoDiscountType,
  value: number
) {
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
  return (
    Number(p?.promo_eligible ?? 0) === 1 &&
    Number(p?.promo_discount_value ?? 0) > 0
  );
}

/* =========================
 * Variantes
 * =======================*/
type UiVariant = {
  id: number;
  key: string;
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

    const po = v?.price_override;
    const price = po == null || po === "" ? null : Number(po);

    const stockRaw = v?.stock ?? v?.qty ?? null;
    const stock =
      stockRaw == null || stockRaw === "" ? null : Number(stockRaw);

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
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content" style={{ borderRadius: 18 }}>
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fermer"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {body}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-outline-dark"
                onClick={onClose}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

async function fetchJSON(url: string, ms = 12000, init?: RequestInit) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { res, ok: res.ok, data };
  } finally {
    window.clearTimeout(t);
  }
}

/* =========================
 * Viewer Role
 * =======================*/
type ViewerRole =
  | "GUEST"
  | "MEMBER"
  | "VENDEUR"
  | "FOURNISSEUR"
  | "RESTAURANT"
  | "LIVREUR"
  | "ADMIN";

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

  const [viewerRole, setViewerRole] = useState<ViewerRole>("GUEST");
  const [viewerUser, setViewerUser] = useState<any>(null);

  const [selectedKey, setSelectedKey] = useState<string>("");
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let stop = false;

    (async () => {
      try {
        const local = getCurrentUser?.();
        if (!stop && local?.role) {
          setViewerUser(local);
          setViewerRole(normalizeViewerRole(local.role));
        }

        const token = getAccessToken?.();
        if (!token) {
          if (!stop) {
            setViewerUser(null);
            setViewerRole("GUEST");
          }
          return;
        }

        const u = await me().catch(() => null);
        if (!stop) {
          if (u) {
            setViewerUser(u);
            setViewerRole(normalizeViewerRole(u.role));
          } else {
            setViewerUser(null);
            setViewerRole("GUEST");
          }
        }
      } catch {
        if (!stop) {
          setViewerUser(null);
          setViewerRole("GUEST");
        }
      }
    })();

    return () => {
      stop = true;
    };
  }, []);

  const anyP = product as any;

  const title = useMemo(() => String(anyP?.name || "Produit"), [anyP?.name]);

  const images = useMemo(() => {
    const arr: string[] = [];
    const cover = anyP?.cover || anyP?.image || null;
    if (cover) arr.push(String(cover));

    const list = Array.isArray(anyP?.images) ? anyP.images : [];
    for (const it of list) {
      const u = typeof it === "string" ? it : it?.url;
      if (u) arr.push(String(u));
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of arr) {
      const key = String(u).trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(imgUrl(key));
    }
    return out;
  }, [anyP?.cover, anyP?.image, anyP?.images]);

  const coverUrl = useMemo(
    () => images[galleryIndex] || "",
    [images, galleryIndex]
  );

  const productIsActive = useMemo(() => isActiveProduct(product), [product]);
  const sectionPath = useMemo(() => sectionPathFor(product), [product]);

  const resolvedIdOrSlug = useMemo(() => {
    const p = normalizeIdOrSlug(safeDecodeURIComponent(String(rawParam || "")));
    const fromShareQuery = extractSharedProductId(location.search, location.hash);
    return p || fromShareQuery || "";
  }, [rawParam, location.search, location.hash]);

  const origin = useMemo(() => {
    const st: any = (location.state as any) || {};
    const from = st.from || st.origin || st.ctx || st || {};

    const originCategoryId =
      Number(from.categoryId ?? from.category_id ?? 0) || 0;
    const originSubCategoryId =
      Number(from.subCategoryId ?? from.sub_category_id ?? 0) || 0;

    const originCategorySlug = String(
      from.categorySlug ?? from.category_slug ?? ""
    ).trim();
    const originSubCategorySlug = String(
      from.subCategorySlug ?? from.sub_category_slug ?? ""
    ).trim();

    const originSectionPath = String(
      from.sectionPath ?? from.section_path ?? ""
    ).trim();
    const originListPath = String(
      from.listPath ?? from.list_path ?? from.fromPath ?? ""
    ).trim();
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

  useEffect(() => {
    let stop = false;

    (async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      try {
        const raw = String(resolvedIdOrSlug || "").trim();
        if (!raw) throw new Error("Produit introuvable");

        const isNumericId = /^\d+$/.test(raw);

        if (isNumericId) {
          const r1 = await fetchJSON(
            `${API_BASE}/api/products/${raw}?variants=1`,
            12000,
            { credentials: "omit" }
          );

          if (!stop && r1.ok) {
            setProduct((r1.data as Product) || null);
            return;
          }

          throw new Error("Produit introuvable");
        }

        const r2 = await fetchJSON(
          `${API_BASE}/api/products/slug/${encodeURIComponent(raw)}?variants=1`,
          12000,
          { credentials: "omit" }
        );

        if (!stop && r2.ok) {
          setProduct((r2.data as Product) || null);
          return;
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

  useEffect(() => {
    setGalleryIndex(0);
  }, [product?.id]);

  useEffect(() => {
    let stop = false;

    (async () => {
      if (!product) return;

      try {
        const pAny = product as any;
        const currentId = Number(pAny?.id || 0);

        const originSubId = origin?.subCategoryId
          ? Number(origin.subCategoryId)
          : 0;
        const originCatId = origin?.categoryId ? Number(origin.categoryId) : 0;

        const fallbackSubId = Number(pAny?.sub_category_id || 0);
        const fallbackCatId = Number(pAny?.category_id || 0);

        const subId = originSubId || fallbackSubId || 0;
        const catId = originCatId || fallbackCatId || 0;

        const vertical =
          String(pAny?.vertical || "").trim().toUpperCase() || null;

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

  const basePriceClient = useMemo(() => {
    return Number(
      anyP?.price_client ?? anyP?.client_price ?? anyP?.price ?? 0
    );
  }, [anyP?.price_client, anyP?.client_price, anyP?.price]);

  const vendorPrice = useMemo(() => {
    const v = nnum(anyP?.vendor_price);
    return v == null ? null : v;
  }, [anyP?.vendor_price]);

  const supplierCost = useMemo(() => {
    const v = nnum(
      anyP?.supplier_cost ?? anyP?.price_wholesale ?? anyP?.cost_price
    );
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

  const variants = useMemo(() => parseVariants(product), [product]);
  const hasVariants = variants.length > 0;

  useEffect(() => {
    if (!hasVariants) {
      setSelectedKey("");
      return;
    }
    setSelectedKey((prev) => {
      if (prev && variants.some((v) => v.key === prev)) return prev;
      const firstOk =
        variants.find((v) => !isVariantOutOfStock(v)) || variants[0];
      return firstOk?.key || "";
    });
  }, [hasVariants, variants]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.key === selectedKey) || null,
    [variants, selectedKey]
  );

  const regularPrice = useMemo(() => {
    if (selectedVariant?.price != null) return Number(selectedVariant.price);
    return basePriceClient;
  }, [basePriceClient, selectedVariant]);

  const promoActive = useMemo(() => hasRealPromo(anyP), [anyP]);
  const promoType = useMemo(
    () => normPromoType(anyP?.promo_discount_type),
    [anyP?.promo_discount_type]
  );
  const promoValue = useMemo(
    () => Number(anyP?.promo_discount_value ?? 0),
    [anyP?.promo_discount_value]
  );

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

  const promoFreeDelivery = useMemo(
    () => Number(anyP?.promo_free_delivery ?? 0) === 1,
    [anyP?.promo_free_delivery]
  );

  const badge = useMemo(() => {
    const v = String(anyP?.vertical || "").trim().toUpperCase();
    if (v === "FASHION") return "Fashion";
    return String(anyP?.sub_category_slug || "").toLowerCase() === "food"
      ? "Food"
      : "Market";
  }, [anyP?.sub_category_slug, anyP?.vertical]);

  const qtySelected = useMemo(() => {
    if (!product) return 0;
    const pid = Number((product as any).id);
    if (!hasVariants) return qtyForProduct(pid);
    const key = selectedVariant?.key || "default";
    return qtyForProductVariant(pid, key);
  }, [
    product,
    hasVariants,
    qtyForProduct,
    qtyForProductVariant,
    selectedVariant,
  ]);

  const canAddNow =
    canOrder(viewerRole) &&
    !isOutOfStock &&
    (!hasVariants ||
      (!!selectedVariant && !isVariantOutOfStock(selectedVariant)));

  const showVendorPanel = useMemo(
    () => canSeeVendorPanel(viewerRole),
    [viewerRole]
  );
  const showSupplierPanel = useMemo(
    () => canSeeSupplierPanel(viewerRole),
    [viewerRole]
  );

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

  const stockText = useMemo(() => {
    if (selectedVariant?.stock != null) {
      if (selectedVariant.stock <= 0) return "En rupture";
      return `Reste: ${selectedVariant.stock}`;
    }
    if (stock == null) return "";
    if (stock <= 0) return "En rupture";
    return `Disponible: ${stock}`;
  }, [selectedVariant, stock]);

  const stockTone = useMemo(() => {
    const s = selectedVariant?.stock ?? stock;
    if (s == null) return "neutral";
    if (s <= 0) return "danger";
    if (s <= 5) return "warning";
    return "success";
  }, [selectedVariant, stock]);

  useEffect(() => {
    if (!product) return;
    const pAny: any = product;
    metaViewContent({
      id: pAny.id,
      name: pAny.name,
      price: Number(displayPrice || 0),
    });
  }, [product, displayPrice]);

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
          : {
              variant_id: null,
              variant_key: "default",
              label: null,
              price: cartPrice,
            },
    });

    trackAddToCart({
      productId: pAny.id,
      name: pAny.name,
      price: cartPrice,
      quantity: 1,
      currency: "MAD",
      category: String(
        pAny?.sub_category_slug || pAny?.sub_category_name || ""
      ),
    });

    metaAddToCart({ id: pAny.id, name: pAny.name, price: cartPrice }, 1);
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
          : {
              variant_id: null,
              variant_key: "default",
              label: null,
              price: cartPrice,
            },
    });
  }, [add, displayPrice, hasVariants, product, qtySelected, selectedVariant]);

  const nextImage = useCallback(() => {
    if (!images.length) return;
    setGalleryIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (!images.length) return;
    setGalleryIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  if (loading) {
    return (
      <div className="container-xxl py-4">
        <div className="placeholder-glow">
          <div className="placeholder col-6 mb-3" style={{ height: 32 }} />
          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <div
                className="placeholder w-100 rounded-4"
                style={{ aspectRatio: "1 / 1" }}
              />
            </div>
            <div className="col-12 col-lg-3">
              <div className="placeholder col-10 mb-2" />
              <div className="placeholder col-8 mb-2" />
              <div className="placeholder col-12 mb-2" />
              <div className="placeholder col-9 mb-2" />
            </div>
            <div className="col-12 col-lg-3">
              <div
                className="placeholder col-12 mb-2"
                style={{ height: 220, borderRadius: 18 }}
              />
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
          <button
            className="btn btn-outline-dark"
            onClick={handleBack}
            type="button"
          >
            ← Retour
          </button>
          <Link to={backPath} className="btn btn-dark">
            Explorer
          </Link>
        </div>

        <div
          className="alert alert-warning d-flex align-items-center"
          role="alert"
        >
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

  const desc = String(anyP?.description || "").trim();

  return (
    <div className="container-xxl py-4">
      <style>{`
        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
          font-weight: 900;
        }
        .btn-duu:hover{ filter: brightness(0.96); }
        .btn-duu:focus,
        .btn-duu:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .22rem rgba(var(--duu-yellow-rgb), .35) !important;
        }

        .pv-hero{
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,.08);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.08), transparent 55%),
            #fff;
          box-shadow: 0 10px 26px rgba(0,0,0,.05);
          overflow: hidden;
        }

        .pv-gallery{
          border-radius: 18px;
          overflow: hidden;
          background: #f6f6f6;
          border: 1px solid rgba(0,0,0,.06);
          position: relative;
        }
        .pv-gallery-main{
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          display: block;
          background: #f6f6f6;
        }
        .pv-gallery-empty{
          width: 100%;
          aspect-ratio: 1 / 1;
          background: linear-gradient(135deg, rgba(0,0,0,.06), rgba(0,0,0,.02));
        }

        .pv-badge{
          position: absolute;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: .8rem;
          font-weight: 900;
          line-height: 1;
        }
        .pv-badge--promo{
          top: 12px;
          left: 12px;
          background: rgba(229,57,53,.95);
          color: #fff;
          box-shadow: 0 10px 20px rgba(229,57,53,.22);
        }
        .pv-badge--free{
          left: 12px;
          bottom: 12px;
          background: rgba(17,17,17,.84);
          color: #fff;
          border: 1px solid rgba(255,255,255,.14);
        }
        .pv-badge--count{
          right: 12px;
          bottom: 12px;
          background: rgba(17,17,17,.72);
          color: #fff;
        }

        .pv-arrow{
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.08);
          background: rgba(255,255,255,.92);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          box-shadow: 0 10px 16px rgba(0,0,0,.08);
        }
        .pv-arrow:hover{ background: #fff; }
        .pv-arrow--left{ left: 12px; }
        .pv-arrow--right{ right: 12px; }

        .pv-thumbs{
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-top: 12px;
        }
        .pv-thumb{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          width: 78px;
          height: 78px;
          flex: 0 0 auto;
          padding: 0;
        }
        .pv-thumb img{
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pv-thumb--active{
          box-shadow: 0 0 0 2px rgba(var(--duu-yellow-rgb), .50);
          border-color: rgba(var(--duu-yellow-rgb), .45);
        }

        .pv-info-card,
        .pv-buy-card,
        .pv-pro-card,
        .pv-desc-card,
        .pv-related-card{
          background: #fff;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 18px;
          box-shadow: 0 10px 22px rgba(0,0,0,.04);
        }

        .pv-info-card,
        .pv-buy-card,
        .pv-pro-card,
        .pv-desc-card{
          padding: 16px;
        }

        .pv-kicker{
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,.04);
          border: 1px solid rgba(0,0,0,.08);
          font-weight: 800;
          font-size: .8rem;
        }

        .pv-title{
          font-weight: 950;
          color: var(--duu-black);
          line-height: 1.1;
          margin: 0;
        }

        .pv-price-row{
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pv-price-main{
          font-size: 1.9rem;
          font-weight: 950;
          line-height: 1;
          color: var(--duu-black);
        }
        .pv-price-old{
          text-decoration: line-through;
          color: rgba(0,0,0,.42);
          font-weight: 800;
          font-size: 1rem;
        }

        .pv-pill-row{
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pv-pill{
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: .8rem;
          font-weight: 800;
          border: 1px solid rgba(0,0,0,.08);
          background: rgba(0,0,0,.04);
          color: rgba(0,0,0,.8);
        }
        .pv-pill--promo{
          background: rgba(229,57,53,.08);
          color: var(--duu-red,#E53935);
          border-color: rgba(229,57,53,.18);
        }
        .pv-pill--success{
          background: rgba(25,135,84,.08);
          color: #157347;
          border-color: rgba(25,135,84,.18);
        }
        .pv-pill--warning{
          background: rgba(255,193,7,.10);
          color: #7a5a00;
          border-color: rgba(255,193,7,.25);
        }
        .pv-pill--danger{
          background: rgba(220,53,69,.08);
          color: #b02a37;
          border-color: rgba(220,53,69,.18);
        }

        .pv-label{
          color: rgba(0,0,0,.58);
          font-size: .82rem;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .pv-select{
          border-radius: 14px;
          min-height: 44px;
        }
        .pv-select:focus{
          outline: none !important;
          box-shadow: 0 0 0 .22rem rgba(var(--duu-yellow-rgb), .35) !important;
          border-color: rgba(229,57,53,.22) !important;
        }

        .pv-buy-card{
          position: sticky;
          top: 88px;
        }

        .pv-buy-price{
          font-size: 1.55rem;
          font-weight: 950;
          line-height: 1;
          color: var(--duu-black);
        }
        .pv-buy-old{
          text-decoration: line-through;
          color: rgba(0,0,0,.42);
          font-weight: 800;
          font-size: .95rem;
        }

        .pv-qty-group .btn,
        .pv-qty-group .btn-light{
          border-radius: 12px !important;
          min-width: 42px;
          font-weight: 900;
        }

        .pv-desc{
          color: rgba(0,0,0,.66);
          line-height: 1.55;
          margin: 0;
        }

        .pv-related-card{
          padding: 14px;
        }

        @media (max-width: 991.98px){
          .pv-buy-card{
            position: static;
            top: auto;
          }
          .pv-price-main{
            font-size: 1.65rem;
          }
        }
      `}</style>

      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center justify-content-between">
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-outline-dark"
            onClick={handleBack}
            type="button"
          >
            ← Retour
          </button>
          <Link to={backPath} className="btn btn-dark">
            Explorer
          </Link>
        </div>

        <span className="badge text-bg-light border">
          Rôle: <strong className="ms-1">{viewerRole}</strong>
          {viewerUser?.impersonation?.impersonate_shop_id ? (
            <span className="ms-2 text-muted">
              (shop #{viewerUser.impersonation.impersonate_shop_id})
            </span>
          ) : null}
        </span>
      </div>

      <div className="pv-hero p-3 p-lg-4">
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="pv-gallery">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={String(anyP?.name || "")}
                  className="pv-gallery-main"
                />
              ) : (
                <div className="pv-gallery-empty" />
              )}

              {promoActive ? (
                <span className="pv-badge pv-badge--promo">
                  PROMO {promoSavedLabel}
                </span>
              ) : null}

              {promoActive && promoFreeDelivery ? (
                <span className="pv-badge pv-badge--free">
                  🚚 Livraison gratuite
                </span>
              ) : null}

              {images.length > 1 ? (
                <>
                  <span className="pv-badge pv-badge--count">
                    {galleryIndex + 1}/{images.length}
                  </span>

                  <button
                    type="button"
                    className="pv-arrow pv-arrow--left"
                    onClick={prevImage}
                    aria-label="Image précédente"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="pv-arrow pv-arrow--right"
                    onClick={nextImage}
                    aria-label="Image suivante"
                  >
                    ▶
                  </button>
                </>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="pv-thumbs">
                {images.map((u, i) => (
                  <button
                    key={`${u}-${i}`}
                    type="button"
                    className={`pv-thumb ${
                      i === galleryIndex ? "pv-thumb--active" : ""
                    }`}
                    onClick={() => setGalleryIndex(i)}
                    aria-label={`Voir image ${i + 1}`}
                  >
                    <img src={u} alt={`${title} ${i + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="col-12 col-lg-3">
            <div className="pv-info-card h-100 d-flex flex-column gap-3">
              <div>
                <div className="pv-kicker mb-2">{badge}</div>
                <h1 className="h3 pv-title">{title}</h1>
              </div>

              <div>
                <ProductRating productId={Number(anyP?.id)} />
              </div>

              <div className="pv-price-row">
                <span className="pv-price-main">{moneyMAD(displayPrice)}</span>
                {promoActive ? (
                  <span className="pv-price-old">{moneyMAD(regularPrice)}</span>
                ) : null}
              </div>

              <div className="pv-pill-row">
                <span className={`pv-pill pv-pill--${stockTone}`}>
                  {stockText || "Disponibilité à confirmer"}
                </span>
                {hasVariants ? <span className="pv-pill">Variantes</span> : null}
                {promoActive ? (
                  <span className="pv-pill pv-pill--promo">
                    {promoSavedLabel}
                  </span>
                ) : null}
              </div>

              {hasVariants ? (
                <div>
                  <div className="pv-label">Choisir une variante</div>
                  <select
                    className="form-select pv-select"
                    value={selectedKey || ""}
                    onChange={(e) => setSelectedKey(e.target.value)}
                  >
                    {variants.map((v) => (
                      <option
                        key={v.key}
                        value={v.key}
                        disabled={isVariantOutOfStock(v)}
                      >
                        {v.label}
                      </option>
                    ))}
                  </select>

                  {selectedVariant ? (
                    <div className="small text-muted mt-2">
                      {selectedVariant.stock != null ? (
                        <span className="me-3">
                          Reste :{" "}
                          <strong>
                            {Math.max(0, Number(selectedVariant.stock))}
                          </strong>
                        </span>
                      ) : null}

                      {selectedVariant.price != null && !promoActive ? (
                        <span>
                          Prix : <strong>{moneyMAD(selectedVariant.price)}</strong>
                        </span>
                      ) : null}

                      {promoActive ? (
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
                      ) : null}
                    </div>
                  ) : null}

                  {selectedVariant && isVariantOutOfStock(selectedVariant) ? (
                    <div className="alert alert-warning mt-2 py-2 small mb-0">
                      Cette variante est en rupture.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="pv-desc-card mt-auto">
                <div className="pv-label">Description</div>
                {desc ? (
                  <>
                    <p className="pv-desc">
                      {desc.length > 220 ? shortText(desc, 220) : desc}
                    </p>
                    {desc.length > 220 ? (
                      <button
                        type="button"
                        className="btn btn-link p-0 mt-2 text-decoration-none"
                        onClick={() => setInfoOpen(true)}
                      >
                        Lire plus
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="pv-desc">Aucune description fournie.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-3">
            <div className="pv-buy-card d-flex flex-column gap-3">
              <div className="pv-buy-price">{moneyMAD(displayPrice)}</div>

              {promoActive ? (
                <div className="pv-buy-old">{moneyMAD(regularPrice)}</div>
              ) : null}

              <div className="pv-pill-row">
                <span className={`pv-pill pv-pill--${stockTone}`}>
                  {isOutOfStock ? "En rupture" : "Disponible"}
                </span>
                {!canOrder(viewerRole) ? (
                  <span className="pv-pill pv-pill--warning">
                    Commande désactivée pour ce rôle
                  </span>
                ) : null}
              </div>

              <div>
                <div className="pv-label">Quantité</div>
                {qtySelected > 0 ? (
                  <div
                    className="btn-group pv-qty-group"
                    role="group"
                    aria-label="Quantité panier"
                  >
                    <button
                      className="btn btn-outline-dark"
                      onClick={handleDecrease}
                      type="button"
                    >
                      −
                    </button>
                    <button className="btn btn-light disabled" type="button">
                      {qtySelected}
                    </button>
                    <button
                      className="btn btn-duu"
                      onClick={handleAdd}
                      type="button"
                      disabled={!canAddNow}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-duu w-100"
                    onClick={handleAdd}
                    disabled={!canAddNow}
                    type="button"
                  >
                    + Ajouter au panier
                  </button>
                )}
              </div>

              {qtySelected > 0 ? (
                <button
                  className="btn btn-duu"
                  onClick={handleAdd}
                  disabled={!canAddNow}
                  type="button"
                >
                  Ajouter encore
                </button>
              ) : null}

              <button
                type="button"
                className="btn btn-outline-dark"
                onClick={() => setInfoOpen(true)}
                disabled={!desc}
              >
                Voir la description
              </button>

              <div className="pt-2 border-top small text-muted d-flex flex-column gap-2">
                <div>✓ Livraison rapide</div>
                <div>✓ Paiement à la livraison</div>
                {promoFreeDelivery ? (
                  <div>✓ Livraison gratuite sur cette promo</div>
                ) : null}
              </div>
            </div>

            {showVendorPanel || showSupplierPanel ? (
              <div className="pv-pro-card mt-3">
                <div className="pv-label mb-2">Infos Pro</div>

                {showVendorPanel ? (
                  <div className="small text-muted">
                    <div>
                      Prix vendeur : <strong>{moneyMAD(vendorPrice ?? 0)}</strong>
                      {vendorPrice == null ? (
                        <span className="ms-2">(non défini)</span>
                      ) : null}
                    </div>

                    {marginVsVendor != null && vendorPrice != null ? (
                      <div className="mt-1">
                        Marge (client − vendeur) :{" "}
                        <strong
                          style={{
                            color:
                              marginVsVendor >= 0
                                ? "inherit"
                                : "var(--duu-red,#E53935)",
                          }}
                        >
                          {moneyMAD(marginVsVendor)}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showSupplierPanel ? (
                  <div
                    className={`small text-muted ${
                      showVendorPanel ? "mt-3 pt-3 border-top" : ""
                    }`}
                  >
                    <div>
                      Stock fournisseur : <strong>{supplierStock ?? 0}</strong>
                      {supplierStock == null ? (
                        <span className="ms-2">(non défini)</span>
                      ) : null}
                    </div>
                    <div className="mt-1">
                      Coût wholesale :{" "}
                      <strong>{moneyMAD(supplierCost ?? 0)}</strong>
                      {supplierCost == null ? (
                        <span className="ms-2">(non défini)</span>
                      ) : null}
                    </div>

                    {marginVsSupplier != null && supplierCost != null ? (
                      <div className="mt-1">
                        Marge (client − wholesale) :{" "}
                        <strong
                          style={{
                            color:
                              marginVsSupplier >= 0
                                ? "inherit"
                                : "var(--duu-red,#E53935)",
                          }}
                        >
                          {moneyMAD(marginVsSupplier)}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pv-related-card mt-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="h6 m-0">{relatedTitle}</h2>
          <Link to={backPath} className="btn btn-sm btn-outline-dark">
            Voir tout
          </Link>
        </div>

        {related.length > 0 ? (
          <div className="row g-3">
            {related.map((p) => (
              <div key={(p as any).id} className="col-6 col-md-4 col-lg-3">
                <ProductCard
                  product={p}
                  layout={
                    String((p as any)?.vertical || "").toUpperCase() === "FASHION"
                      ? "fashion"
                      : "default"
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted small">
            Aucun autre produit trouvé pour le moment.
          </div>
        )}
      </div>

      {infoOpen ? (
        <InfoModal
          title={String(anyP?.name || "Infos produit")}
          body={desc || "Aucune description."}
          onClose={() => setInfoOpen(false)}
        />
      ) : null}
    </div>
  );
}