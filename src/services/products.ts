// src/services/products.ts
import { api } from "./http";

export type PromoDiscountType = "PERCENT" | "AMOUNT";

/** Images */
export type ProductImage = { id: number; url: string; sort_order: number };

export type Product = {
  id: number;
  shop_id: number | null;

  category_id?: number | null;

  // ✅ FK vers sub_categories
  sub_category_id?: number | null;

  // ✅ infos joinées (retournées par l'API)
  category_name?: string | null;
  category_slug?: string | null;

  sub_category_slug?: string | null; // ex: "food"
  sub_category_name?: string | null; // ex: "Alimentation"

  name: string;
  slug: string;

  price: number;
  vendor_price?: number | null;

  currency?: string | null;
  description?: string | null;
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
  active?: 0 | 1 | null; // compat si certains endpoints renvoient "active"

  cities?: string[] | null;

  total_qty?: number | null;
  avg_rating?: number | null;
  rating_count?: number | null;

  // ✅ Anti-bug : si quelqu’un tente product.sub_category => TS hurle
  sub_category?: never;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

type Channel = "african-food" | "african-market";

/* ---------- Utils ---------- */
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

/* ======================================================================
 * Products
 * ===================================================================== */

/* ---------- List ---------- */
export async function listProducts(
  opts: {
    page?: number;
    pageSize?: number;
    channel?: Channel;
    onlyActive?: boolean;
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

  const query: Record<string, any> = { page, pageSize };
  if (opts.onlyActive) query.onlyActive = 1;

  // ⚠️ On n'envoie plus ville/city : l'API ne filtre plus dessus
  return api.get<Paginated<Product>>(base, { query });
}

/* ---------- Promotions ---------- */
export async function listPromotions(
  opts: {
    limit?: number;
    channel?: "all" | Channel;
    onlyActive?: boolean;
  } = {}
) {
  const limit = opts.limit ?? 12;

  const query: Record<string, any> = { limit };
  if (opts.onlyActive) query.onlyActive = 1;
  if (opts.channel && opts.channel !== "all") query.channel = opts.channel;

  return api.get<Product[]>("/api/products/promotions", { query });
}

/* ---------- Read ---------- */
export async function getProduct(id: number) {
  return api.get<Product>(`/api/products/${id}`);
}

/* ---------- Create ---------- */
export async function createProduct(draft: Partial<Product>, files: File[]) {
  const fd = new FormData();

  if (draft.name) fd.append("name", draft.name);

  const finalPrice =
    draft.price != null ? draft.price : draft.vendor_price != null ? draft.vendor_price : null;
  if (finalPrice != null) fd.append("price", String(finalPrice));

  if (draft.currency) fd.append("currency", String(draft.currency));
  if (draft.description != null) fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.category_id != null) fd.append("category_id", String(draft.category_id));

  // ✅ sub_category_id
  if (draft.sub_category_id != null) fd.append("sub_category_id", String(draft.sub_category_id));

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

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.post<{ id: number; channel: Channel }>("/api/products", fd as any);
}

/* ---------- Update ---------- */
export async function updateProduct(
  id: number,
  draft: Partial<Product>,
  files: File[],
  replaceImages = false
) {
  const fd = new FormData();

  if (draft.name) fd.append("name", draft.name);

  const finalPrice =
    draft.price != null ? draft.price : draft.vendor_price != null ? draft.vendor_price : null;
  if (finalPrice != null) fd.append("price", String(finalPrice));

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

  // ✅ sub_category_id
  if (draft.sub_category_id != null) fd.append("sub_category_id", String(draft.sub_category_id));

  if (draft.shop_id != null) fd.append("shop_id", String(draft.shop_id));

  const cities = uniqCities(draft.cities);
  if (cities != null) fd.append("cities", JSON.stringify(cities));

  if (replaceImages) fd.append("replace_images", "true");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.put<{ ok: true }>(`/api/products/${id}`, fd as any);
}

/* ---------- Delete ---------- */
export async function removeProduct(id: number) {
  return api.delete<{ ok: true }>(`/api/products/${id}`);
}

/* ---------- Top produits : les plus commandés ---------- */
export async function listTopOrderedProducts(limit?: number): Promise<Product[]>;
export async function listTopOrderedProducts(opts: { limit?: number }): Promise<Product[]>;
export async function listTopOrderedProducts(limitOrOpts?: number | { limit?: number }) {
  let limit = 8;
  if (typeof limitOrOpts === "number") limit = limitOrOpts;
  else if (limitOrOpts && typeof limitOrOpts === "object" && typeof limitOrOpts.limit === "number")
    limit = limitOrOpts.limit;

  return api.get<Product[]>("/api/products/top-ordered", { query: { limit } });
}

/* ---------- Top produits : les mieux notés ---------- */
export async function listTopRatedProducts(opts?: { limit?: number; minCount?: number }): Promise<Product[]>;
export async function listTopRatedProducts(opts: { limit?: number; minCount?: number } = {}) {
  const limit = opts.limit ?? 8;
  const minCount = opts.minCount ?? 2;
  return api.get<Product[]>("/api/products/top-rated", { query: { limit, minCount } });
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

export async function getProductRatingSummary(productId: number) {
  return api.get<ProductRatingSummary>(`/api/products/${productId}/ratings`);
}

export async function listProductRatings(productId: number) {
  return api.get<ProductRatingRow[]>(`/api/products/${productId}/ratings/list`);
}

export async function getPendingRatingProduct() {
  return api.get<PendingRatingProduct>(`/api/products/pending-rating`);
}

export async function rateProduct(productId: number, payload: { rating: number; comment?: string | null }) {
  return api.post<{
    ok: true;
    average: number;
    count: number;
    user_rating: number;
    comment: string | null;
  }>(`/api/products/${productId}/rate`, payload);
}

export async function unrateProduct(productId: number) {
  return api.delete<{
    ok: true;
    deleted: boolean;
    average: number;
    count: number;
  }>(`/api/products/${productId}/rate`);
}
