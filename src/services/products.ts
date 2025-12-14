// src/services/products.ts
import { api } from "./http";

export type PromoDiscountType = "PERCENT" | "AMOUNT";

export type Product = {
  id: number;
  shop_id: number | null;
  category_id?: number | null;
  name: string;
  slug: string;

  price: number;
  vendor_price?: number | null;

  currency?: string;
  description?: string | null;
  stock?: number | null;
  is_featured?: 0 | 1;

  promo_eligible?: 0 | 1;

  // ✅ Promo
  promo_discount_type?: PromoDiscountType | null;
  promo_discount_value?: number | null;
  promo_free_delivery?: 0 | 1;

  sub_category?: string | null;

  created_at?: string;
  updated_at?: string;
  images?: { id: number; url: string; sort_order: number }[];
  cover?: string | null;

  shop_name?: string | null;
  shop_logo?: string | null;
  shop_cover?: string | null;
  shop_city?: string | null;
  shop_city_code?: string | null;

  is_active?: 0 | 1;

  cities?: string[] | null;

  total_qty?: number;
  avg_rating?: number;
  rating_count?: number;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number; pages: number };
};

type Channel = "african-food" | "african-market";

/* ---------- Utils ---------- */
function normalizeSubCategory(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s;
}

function normalizeCityFilterToVille(city?: string | null): string | undefined {
  if (!city) return undefined;
  const raw = String(city).trim();
  if (!raw) return undefined;

  const low = raw.toLowerCase();
  if (low.startsWith("cas")) return "Casablanca";
  if (low.startsWith("mar")) return "Marrakech";

  return raw;
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
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
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

/** ✅ Normalise type promo */
function normalizePromoType(v: any): PromoDiscountType | null {
  const s = String(v || "").trim().toUpperCase();
  if (s === "AMOUNT") return "AMOUNT";
  if (s === "PERCENT") return "PERCENT";
  return null;
}

/** ✅ Normalise valeur promo */
function normalizePromoValue(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** ✅ Convertit bool/number => 0|1 (ou null si absent) */
function to01(v: any): 0 | 1 | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return 1;
  if (s === "0" || s === "false" || s === "no" || s === "off") return 0;
  return null;
}

/* ---------- List ---------- */
export async function listProducts(
  opts: {
    page?: number;
    pageSize?: number;
    channel?: Channel;
    onlyActive?: boolean;
    city?: string;
    ville?: string;
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

  const ville = normalizeCityFilterToVille(opts.city ?? opts.ville ?? null);
  if (ville) query.ville = ville;

  return api.get<Paginated<Product>>(base, { query });
}

/* ---------- Promotions ---------- */
export async function listPromotions(
  opts: {
    limit?: number;
    channel?: "all" | Channel;
    onlyActive?: boolean;
    city?: string;
    ville?: string;
  } = {}
) {
  const limit = opts.limit ?? 12;

  const query: Record<string, any> = { limit };
  if (opts.onlyActive) query.onlyActive = 1;

  const ville = normalizeCityFilterToVille(opts.city ?? opts.ville ?? null);
  if (ville) query.ville = ville;

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
    draft.price != null
      ? draft.price
      : draft.vendor_price != null
      ? draft.vendor_price
      : null;
  if (finalPrice != null) fd.append("price", String(finalPrice));

  if (draft.currency) fd.append("currency", draft.currency);
  if (draft.description != null)
    fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.category_id != null)
    fd.append("category_id", String(draft.category_id));

  if (draft.is_featured != null) {
    const v = to01(draft.is_featured);
    if (v != null) fd.append("is_featured", String(v));
  }

  // ✅ promo_eligible (IMPORTANT: ne pas faire un "truthy" sur "0")
  const promoEligible = to01(draft.promo_eligible);
  if (promoEligible != null) fd.append("promo_eligible", String(promoEligible));

  // ✅ promo_free_delivery
  const promoFree = to01((draft as any).promo_free_delivery);
  if (promoFree != null) fd.append("promo_free_delivery", String(promoFree));

  // ✅ promo_discount_* (seulement si promo=1)
  if (promoEligible === 1) {
    const t = normalizePromoType((draft as any).promo_discount_type);
    const v = normalizePromoValue((draft as any).promo_discount_value);

    if (t) fd.append("promo_discount_type", t);
    if (v != null) fd.append("promo_discount_value", String(v));
  } else if (promoEligible === 0) {
    // ✅ reset promo côté API (elle purge si promo_eligible=0)
    fd.append("promo_discount_type", "");
    fd.append("promo_discount_value", "");
  }

  if (draft.is_active != null) {
    const v = to01(draft.is_active);
    if (v != null) fd.append("is_active", String(v));
  }

  const sub = normalizeSubCategory(draft.sub_category ?? undefined);
  if (sub) fd.append("sub_category", sub);

  if (draft.shop_id != null) fd.append("shop_id", String(draft.shop_id));

  const cities = uniqCities(draft.cities);
  if (cities != null) fd.append("cities", JSON.stringify(cities));

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.post<{ id: number; channel: Channel }>("/api/products", fd);
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
    draft.price != null
      ? draft.price
      : draft.vendor_price != null
      ? draft.vendor_price
      : null;
  if (finalPrice != null) fd.append("price", String(finalPrice));

  if (draft.currency) fd.append("currency", draft.currency);
  if (draft.description != null)
    fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.is_featured != null) {
    const v = to01(draft.is_featured);
    if (v != null) fd.append("is_featured", String(v));
  }

  // ✅ promo_eligible
  const promoEligible = to01(draft.promo_eligible);
  if (promoEligible != null) fd.append("promo_eligible", String(promoEligible));

  // ✅ promo_free_delivery
  const promoFree = to01((draft as any).promo_free_delivery);
  if (promoFree != null) fd.append("promo_free_delivery", String(promoFree));

  // ✅ promo_discount_* (seulement si promo)
  if (promoEligible === 1) {
    const t = normalizePromoType((draft as any).promo_discount_type);
    const v = normalizePromoValue((draft as any).promo_discount_value);

    if (t) fd.append("promo_discount_type", t);
    if (v != null) fd.append("promo_discount_value", String(v));
  } else if (promoEligible === 0) {
    // ✅ reset promo
    fd.append("promo_discount_type", "");
    fd.append("promo_discount_value", "");
  }

  if (draft.is_active != null) {
    const v = to01(draft.is_active);
    if (v != null) fd.append("is_active", String(v));
  }

  const sub = normalizeSubCategory(draft.sub_category ?? undefined);
  if (sub) fd.append("sub_category", sub);

  if (draft.category_id != null)
    fd.append("category_id", String(draft.category_id));
  if (draft.shop_id != null) fd.append("shop_id", String(draft.shop_id));

  const cities = uniqCities(draft.cities);
  if (cities != null) fd.append("cities", JSON.stringify(cities));

  if (replaceImages) fd.append("replace_images", "true");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.put<{ ok: true }>(`/api/products/${id}`, fd);
}

/* ---------- Delete ---------- */
export async function removeProduct(id: number) {
  return api.delete<{ ok: true }>(`/api/products/${id}`);
}

/* ---------- Top produits : les plus commandés ---------- */
export async function listTopOrderedProducts(limit?: number): Promise<Product[]>;
export async function listTopOrderedProducts(opts: {
  limit?: number;
  city?: string;
  ville?: string;
}): Promise<Product[]>;
export async function listTopOrderedProducts(
  limitOrOpts?: number | { limit?: number; city?: string; ville?: string }
) {
  let limit = 8;
  let ville: string | undefined;

  if (typeof limitOrOpts === "number") {
    limit = limitOrOpts;
  } else if (limitOrOpts && typeof limitOrOpts === "object") {
    if (typeof limitOrOpts.limit === "number") limit = limitOrOpts.limit;
    ville = normalizeCityFilterToVille(limitOrOpts.city ?? limitOrOpts.ville ?? null);
  }

  const query: Record<string, any> = { limit };
  if (ville) query.ville = ville;

  return api.get<Product[]>("/api/products/top-ordered", { query });
}

/* ---------- Top produits : les mieux notés ---------- */
export async function listTopRatedProducts(
  opts?: { limit?: number; minCount?: number }
): Promise<Product[]>;
export async function listTopRatedProducts(opts: {
  limit?: number;
  minCount?: number;
  city?: string;
  ville?: string;
}): Promise<Product[]>;
export async function listTopRatedProducts(
  opts: { limit?: number; minCount?: number; city?: string; ville?: string } = {}
) {
  const limit = opts.limit ?? 8;
  const minCount = opts.minCount ?? 2;

  const query: Record<string, any> = { limit, minCount };

  const ville = normalizeCityFilterToVille(opts.city ?? opts.ville ?? null);
  if (ville) query.ville = ville;

  return api.get<Product[]>("/api/products/top-rated", { query });
}
