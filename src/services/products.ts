// src/services/products.ts
import { api } from "./http";

export type PromoDiscountType = "PERCENT" | "AMOUNT";

/** Images */
export type ProductImage = { id: number; url: string; sort_order: number };

/** Variantes (fashion / tailles / couleurs) */
export type ProductVariant = {
  id: number;
  product_id: number;

  size?: string | null; // S, M, L, XL, 42...
  color?: string | null; // Noir, Blanc...
  sku?: string | null;

  stock: number; // stock de la variante
  price_override?: number | null; // ✅ backend: price_override

  is_active?: 0 | 1 | null;

  created_at?: string | null;
  updated_at?: string | null;
};

export type Product = {
  id: number;
  shop_id: number | null;

  category_id?: number | null;

  // ✅ FK vers sub_categories
  sub_category_id?: number | null;

  // ✅ infos joinées (retournées par l'API)
  category_name?: string | null;
  category_slug?: string | null;

  sub_category_slug?: string | null; // "food" | "market" | "fashion"...
  sub_category_name?: string | null;

  // ✅ backend: products.vertical
  vertical?: "FOOD" | "MARKET" | "FASHION" | null;

  name: string;
  slug: string;

  /** Prix client (retourné par l'API) */
  price: number;

  /** ✅ calculé backend (stripDuuminiRateFromProduct) */
  vendor_price?: number | null;

  /** ✅ NEW (backend list/read): */
  has_variants?: boolean;
  min_price?: number | null;

  currency?: string | null;
  description?: string | null;

  /** stock global (si pas de variantes) */
  stock?: number | null;

  is_featured?: 0 | 1 | null;

  promo_eligible?: 0 | 1 | null;
  promo_discount_type?: PromoDiscountType | null;
  promo_discount_value?: number | null;
  promo_free_delivery?: 0 | 1 | null;

  created_at?: string | null;
  updated_at?: string | null;

  images?: ProductImage[];
  cover?: string | null;

  shop_name?: string | null;
  shop_logo?: string | null;
  shop_cover?: string | null;
  shop_city?: string | null;
  shop_city_code?: string | null;

  is_active?: 0 | 1 | null;
  active?: 0 | 1 | null; // compat

  cities?: string[] | null;

  total_qty?: number | null;
  avg_rating?: number | null;
  rating_count?: number | null;

  /** ✅ Variantes (si backend les renvoie via ?variants=1 ou /variants) */
  variants?: ProductVariant[];

  // ✅ Anti-bug : si quelqu’un tente product.sub_category => TS hurle
  sub_category?: never;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

type Channel = "african-food" | "african-market";
type Vertical = "FOOD" | "MARKET" | "FASHION";

/* ======================================================================
 * Utils
 * ===================================================================== */

function unwrap<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res) return res.data as T;
  return res as T;
}

function normalizeCityLabel(city?: string | null): string | null {
  if (!city) return null;
  const raw = String(city).trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (low.startsWith("cas")) return "Casablanca";
  if (low.startsWith("mar")) return "Marrakech";
  return raw;
}

function uniqCities(input: any): string[] | null {
  if (input == null) return null;

  let arr: any[] = [];
  if (Array.isArray(input)) arr = input;
  else {
    const s = String(input || "").trim();
    if (!s) arr = [];
    else if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {
        arr = [];
      }
    } else if (s.includes(",")) {
      arr = s.split(",").map((x) => x.trim());
    } else {
      arr = [s];
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of arr) {
    const v = normalizeCityLabel(it);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function normalizePromoType(v: any): PromoDiscountType | null {
  const s = String(v || "").trim().toUpperCase();
  if (s === "AMOUNT") return "AMOUNT";
  if (s === "PERCENT") return "PERCENT";
  return null;
}

function normalizePromoValue(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function to01(v: any): 0 | 1 | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return 1;
  if (s === "0" || s === "false" || s === "no" || s === "off") return 0;
  return null;
}

function normalizeVertical(v: any): Vertical | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "FOOD" || s === "MARKET" || s === "FASHION") return s;
  return null;
}

/** ✅ helper: produit actif (compat active/is_active) */
export function isProductActive(p: any): boolean {
  return !!(p?.active ?? p?.is_active ?? 1);
}

/** ✅ helper: variante active */
export function isVariantActive(v: any): boolean {
  return !!(v?.is_active ?? 1);
}

/** ✅ helper: un produit a des variantes actives ? */
export function hasActiveVariants(p: any): boolean {
  const vs: any[] = Array.isArray(p?.variants) ? p.variants : [];
  return vs.some((x) => isVariantActive(x));
}

/** ✅ filtre de sécurité: enlève les produits inactifs */
function filterActive<T extends any>(arr: T[]): T[] {
  return (arr || []).filter((p: any) => isProductActive(p));
}

/* ======================================================================
 * Normalizers (anti-bug: e.map is not a function)
 * ===================================================================== */

function asArray<T = any>(x: any): T[] {
  const body = unwrap<any>(x);

  if (Array.isArray(body)) return body;

  // formats fréquents: { items: [...] } ou { data: [...] }
  if (body && Array.isArray(body.items)) return body.items;
  if (body && Array.isArray(body.data)) return body.data;
  if (body && Array.isArray(body.rows)) return body.rows;
  if (body && Array.isArray(body.results)) return body.results;

  // formats imbriqués: { data: { items: [...] } }
  if (body?.data && Array.isArray(body.data.items)) return body.data.items;

  return [];
}

function asPaginated<T = any>(x: any): Paginated<T> {
  const body = unwrap<any>(x);

  if (body && Array.isArray(body.items) && body.pageInfo) return body as Paginated<T>;
  if (body?.data && Array.isArray(body.data.items) && body.data.pageInfo) return body.data as Paginated<T>;

  const items = asArray<T>(body);
  const pageInfo = {
    page: Number(body?.pageInfo?.page ?? 1),
    pageSize: Number(body?.pageInfo?.pageSize ?? items.length),
    total: Number(body?.pageInfo?.total ?? items.length),
  };

  return { items, pageInfo };
}

/* ======================================================================
 * Products
 * ===================================================================== */

/* ---------- List ---------- */
/**
 * ✅ Par défaut : onlyActive = true
 * ✅ Aligné backend:
 * - category_id / sub_category_id / shop_id / q
 * - vertical (FOOD|MARKET|FASHION) ✅ (prioritaire côté backend)
 */
export async function listProducts(
  opts: {
    page?: number;
    pageSize?: number;
    channel?: Channel; // compat
    onlyActive?: boolean; // default true
    category_id?: number;
    sub_category_id?: number;
    shop_id?: number;
    q?: string;
    vertical?: Vertical; // ✅ NEW
  } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const base =
    opts.channel === "african-food"
      ? "/api/products/african-food"
      : opts.channel === "african-market"
      ? "/api/products/african-market"
      : "/api/products";

  const onlyActive = opts.onlyActive ?? true;

  const query: Record<string, any> = { page, pageSize };
  if (onlyActive) query.onlyActive = 1;

  const vert = normalizeVertical(opts.vertical);
  if (vert) {
    query.vertical = vert;
    query.v = vert; // compat
  }

  if (typeof opts.category_id === "number") {
    query.category_id = opts.category_id;
    query.categoryId = opts.category_id;
  }
  if (typeof opts.sub_category_id === "number") {
    query.sub_category_id = opts.sub_category_id;
    query.subCategoryId = opts.sub_category_id;
  }
  if (typeof opts.shop_id === "number") {
    query.shop_id = opts.shop_id;
    query.shopId = opts.shop_id;
  }
  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  const raw = await api.get<any>(base, { query });
  const res = asPaginated<Product>(raw);

  if (onlyActive) return { ...res, items: filterActive(res.items) };
  return res;
}

/* ---------- Promotions ---------- */
/**
 * ✅ backend: GET /api/products/promotions
 * - limit, onlyActive, channel, categoryId/category_id, subCategoryId/sub_category_id, shopId/shop_id, q, vertical
 */
export async function listPromotions(
  opts: {
    limit?: number;
    channel?: "all" | Channel;
    onlyActive?: boolean; // default true
    category_id?: number;
    sub_category_id?: number;
    shop_id?: number;
    q?: string;
    vertical?: Vertical; // ✅ NEW
  } = {}
) {
  const limit = opts.limit ?? 12;
  const onlyActive = opts.onlyActive ?? true;

  const query: Record<string, any> = { limit };
  if (onlyActive) query.onlyActive = 1;
  if (opts.channel && opts.channel !== "all") query.channel = opts.channel;

  const vert = normalizeVertical(opts.vertical);
  if (vert) {
    query.vertical = vert;
    query.v = vert;
  }

  if (typeof opts.category_id === "number") {
    query.category_id = opts.category_id;
    query.categoryId = opts.category_id;
  }
  if (typeof opts.sub_category_id === "number") {
    query.sub_category_id = opts.sub_category_id;
    query.subCategoryId = opts.sub_category_id;
  }
  if (typeof opts.shop_id === "number") {
    query.shop_id = opts.shop_id;
    query.shopId = opts.shop_id;
  }
  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  const raw = await api.get<any>("/api/products/promotions", { query });
  const arr = asArray<Product>(raw);

  return onlyActive ? filterActive(arr) : arr;
}

/* ---------- Read ---------- */
/**
 * ✅ backend: GET /api/products/:id
 * - option: ?variants=1 pour inclure variants
 * ✅ IMPORTANT: renvoie toujours l'objet Product (pas {data})
 */
export async function getProduct(id: number, opts?: { variants?: boolean }): Promise<Product> {
  const query: Record<string, any> = {};
  if (opts?.variants) query.variants = 1;

  const raw = await api.get<any>(`/api/products/${id}`, { query });
  return unwrap<Product>(raw);
}

/* ======================================================================
 * Variants (aligné backend actuel)
 * ✅ backend:
 * - GET    /api/products/:id/variants
 * - POST   /api/products/:id/variants   (bulk upsert)  { variants: [...] } + ?replace=1
 * - PUT    /api/products/variants/:variantId
 * - DELETE /api/products/variants/:variantId
 * ===================================================================== */

export async function listProductVariants(productId: number): Promise<ProductVariant[]> {
  const raw = await api.get<any>(`/api/products/${productId}/variants`);
  return asArray<ProductVariant>(raw);
}

/**
 * ✅ bulk upsert
 * payload:
 *  { variants: [{size,color,sku,stock,price_override,is_active}, ...] }
 * opts.replace=true => ?replace=1
 */
export async function upsertProductVariants(
  productId: number,
  payload: { variants: Array<Partial<ProductVariant> & { stock?: number }> },
  opts?: { replace?: boolean }
): Promise<{ ok: true; items: ProductVariant[] }> {
  const query: Record<string, any> = {};
  if (opts?.replace) query.replace = 1;

  const raw = await api.post<any>(`/api/products/${productId}/variants`, payload, { query });
  return unwrap<{ ok: true; items: ProductVariant[] }>(raw);
}

/** ✅ update 1 variante */
export async function updateProductVariant(
  variantId: number,
  payload: Partial<{
    size: string | null;
    color: string | null;
    sku: string | null;
    stock: number;
    price_override: number | null;
    is_active: 0 | 1 | null;
  }>
): Promise<{ ok: true }> {
  const raw = await api.put<any>(`/api/products/variants/${variantId}`, payload);
  return unwrap<{ ok: true }>(raw);
}

/** ✅ delete 1 variante */
export async function removeProductVariant(variantId: number): Promise<{ ok: true }> {
  const raw = await api.delete<any>(`/api/products/variants/${variantId}`);
  return unwrap<{ ok: true }>(raw);
}

/* ---------- Create ---------- */
/**
 * ✅ backend: POST /api/products (multipart)
 * Champs acceptés côté backend:
 * - name, price, currency, description, stock
 * - category_id, sub_category_id
 * - is_featured, promo_*, is_active
 * - shop_id (admin), cities
 * - vertical ✅
 * - variants ✅ (JSON) + replace_variants
 *
 * ✅ IMPORTANT: renvoie toujours l'objet (pas {data})
 */
export async function createProduct(
  draft: Partial<Product> & {
    variants?: Array<{
      size?: string | null;
      color?: string | null;
      sku?: string | null;
      stock?: number;
      price_override?: number | null;
      is_active?: 0 | 1 | null;
    }>;
    replace_variants?: boolean;
  },
  files: File[]
): Promise<{ id: number; channel?: Channel; vertical?: Vertical }> {
  const fd = new FormData();

  if (draft.name) fd.append("name", draft.name);

  if (draft.price != null) fd.append("price", String(draft.price));
  if (draft.currency) fd.append("currency", String(draft.currency));
  if (draft.description != null) fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.category_id != null) fd.append("category_id", String(draft.category_id));
  if (draft.sub_category_id != null) fd.append("sub_category_id", String(draft.sub_category_id));

  const vert = normalizeVertical(draft.vertical);
  if (vert) fd.append("vertical", vert);

  if (draft.is_featured != null) {
    const v = to01(draft.is_featured);
    if (v != null) fd.append("is_featured", String(v));
  }

  const promoEligible = to01(draft.promo_eligible);
  if (promoEligible != null) fd.append("promo_eligible", String(promoEligible));

  const promoFree = to01((draft as any).promo_free_delivery);
  if (promoFree != null) fd.append("promo_free_delivery", String(promoFree));

  if (promoEligible === 1) {
    const t = normalizePromoType((draft as any).promo_discount_type);
    const v = normalizePromoValue((draft as any).promo_discount_value);
    if (t) fd.append("promo_discount_type", t);
    if (v != null) fd.append("promo_discount_value", String(v));
  } else if (promoEligible === 0) {
    fd.append("promo_discount_type", "");
    fd.append("promo_discount_value", "");
  }

  if (draft.is_active != null) {
    const v = to01(draft.is_active);
    if (v != null) fd.append("is_active", String(v));
  }

  if (draft.shop_id != null) fd.append("shop_id", String(draft.shop_id));

  const cities = uniqCities(draft.cities);
  if (cities != null) fd.append("cities", JSON.stringify(cities));

  if (Array.isArray((draft as any).variants) && (draft as any).variants.length) {
    fd.append("variants", JSON.stringify((draft as any).variants));
  }
  if ((draft as any).replace_variants) fd.append("replace_variants", "1");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  const raw = await api.post<any>("/api/products", fd as any);
  return unwrap<{ id: number; channel?: Channel; vertical?: Vertical }>(raw);
}

/* ---------- Update ---------- */
/**
 * ✅ backend: PUT /api/products/:id (multipart)
 * Champs acceptés:
 * - name, price, currency, description, stock
 * - is_featured, promo_*, is_active, category_id, sub_category_id, shop_id, vertical
 * - replace_images, cities
 * (variants bulk via endpoint dédié /:id/variants)
 *
 * ✅ IMPORTANT: renvoie toujours {ok:true} (pas {data})
 */
export async function updateProduct(
  id: number,
  draft: Partial<Product>,
  files: File[],
  replaceImages = false
): Promise<{ ok: true }> {
  const fd = new FormData();

  if (draft.name) fd.append("name", draft.name);
  if (draft.price != null) fd.append("price", String(draft.price));

  if (draft.currency) fd.append("currency", String(draft.currency));
  if (draft.description != null) fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.is_featured != null) {
    const v = to01(draft.is_featured);
    if (v != null) fd.append("is_featured", String(v));
  }

  const promoEligible = to01(draft.promo_eligible);
  if (promoEligible != null) fd.append("promo_eligible", String(promoEligible));

  const promoFree = to01((draft as any).promo_free_delivery);
  if (promoFree != null) fd.append("promo_free_delivery", String(promoFree));

  if (promoEligible === 1) {
    const t = normalizePromoType((draft as any).promo_discount_type);
    const v = normalizePromoValue((draft as any).promo_discount_value);
    if (t) fd.append("promo_discount_type", t);
    if (v != null) fd.append("promo_discount_value", String(v));
  } else if (promoEligible === 0) {
    fd.append("promo_discount_type", "");
    fd.append("promo_discount_value", "");
  }

  if (draft.is_active != null) {
    const v = to01(draft.is_active);
    if (v != null) fd.append("is_active", String(v));
  }

  if (draft.category_id != null) fd.append("category_id", String(draft.category_id));
  if (draft.sub_category_id != null) fd.append("sub_category_id", String(draft.sub_category_id));

  const vert = normalizeVertical(draft.vertical);
  if (vert) fd.append("vertical", vert);

  if (draft.shop_id != null) fd.append("shop_id", String(draft.shop_id));

  const cities = uniqCities(draft.cities);
  if (cities != null) fd.append("cities", JSON.stringify(cities));

  if (replaceImages) fd.append("replace_images", "true");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  const raw = await api.put<any>(`/api/products/${id}`, fd as any);
  return unwrap<{ ok: true }>(raw);
}

/* ---------- Delete ---------- */
export async function removeProduct(id: number): Promise<{ ok: true }> {
  const raw = await api.delete<any>(`/api/products/${id}`);
  return unwrap<{ ok: true }>(raw);
}

/* ---------- Top produits : les plus commandés ---------- */
export async function listTopOrderedProducts(limit?: number): Promise<Product[]>;
export async function listTopOrderedProducts(opts: { limit?: number; onlyActive?: boolean }): Promise<Product[]>;
export async function listTopOrderedProducts(limitOrOpts?: number | { limit?: number; onlyActive?: boolean }) {
  let limit = 8;
  let onlyActive = true;

  if (typeof limitOrOpts === "number") {
    limit = limitOrOpts;
  } else if (limitOrOpts && typeof limitOrOpts === "object") {
    if (typeof limitOrOpts.limit === "number") limit = limitOrOpts.limit;
    if (typeof limitOrOpts.onlyActive === "boolean") onlyActive = limitOrOpts.onlyActive;
  }

  const raw = await api.get<any>("/api/products/top-ordered", {
    query: { limit, ...(onlyActive ? { onlyActive: 1 } : {}) },
  });

  const arr = asArray<Product>(raw);
  return onlyActive ? filterActive(arr) : arr;
}

/* ---------- Top produits : les mieux notés ---------- */
export async function listTopRatedProducts(opts?: { limit?: number; minCount?: number; onlyActive?: boolean }): Promise<Product[]>;
export async function listTopRatedProducts(opts: { limit?: number; minCount?: number; onlyActive?: boolean } = {}) {
  const limit = opts.limit ?? 8;
  const minCount = opts.minCount ?? 2;
  const onlyActive = opts.onlyActive ?? true;

  const raw = await api.get<any>("/api/products/top-rated", {
    query: { limit, minCount, ...(onlyActive ? { onlyActive: 1 } : {}) },
  });

  const arr = asArray<Product>(raw);
  return onlyActive ? filterActive(arr) : arr;
}

/* ======================================================================
 * Ratings / Avis
 * ===================================================================== */

export type ProductRatingSummary = {
  average: number;
  count: number;
};

export type ProductRatingRow = {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: number;
  user_name: string;
};

export type PendingRatingProduct =
  | {
      product_id: number;
      product_name: string;
      product_image: string | null;
      order_id: number;
      delivered_at: string;
    }
  | null;

export async function getProductRatingSummary(productId: number): Promise<ProductRatingSummary> {
  const raw = await api.get<any>(`/api/products/${productId}/ratings`);
  return unwrap<ProductRatingSummary>(raw);
}

export async function listProductRatings(productId: number): Promise<ProductRatingRow[]> {
  const raw = await api.get<any>(`/api/products/${productId}/ratings/list`);
  return asArray<ProductRatingRow>(raw);
}

export async function getPendingRatingProduct(): Promise<PendingRatingProduct> {
  const raw = await api.get<any>(`/api/products/pending-rating`);
  return unwrap<PendingRatingProduct>(raw);
}

export async function rateProduct(productId: number, payload: { rating: number; comment?: string | null }) {
  const raw = await api.post<any>(`/api/products/${productId}/rate`, payload);
  return unwrap<{
    ok: true;
    average: number;
    count: number;
    user_rating: number;
    comment: string | null;
  }>(raw);
}

export async function unrateProduct(productId: number) {
  const raw = await api.delete<any>(`/api/products/${productId}/rate`);
  return unwrap<{
    ok: true;
    deleted: boolean;
    average: number;
    count: number;
  }>(raw);
}
