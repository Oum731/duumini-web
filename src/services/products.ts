// src/services/products.ts
import { api } from "./http";

export type PromoDiscountType = "PERCENT" | "AMOUNT";

/** Images */
export type ProductImage = { id: number; url: string; sort_order: number };

export type Product = {
  id: number;
  shop_id: number | null;

  category_id?: number | null;

  sub_category_id?: number | null;

  category_name?: string | null;
  category_slug?: string | null;

  sub_category_slug?: string | null;
  sub_category_name?: string | null;

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
  active?: 0 | 1 | null;

  cities?: string[] | null;

  total_qty?: number | null;
  avg_rating?: number | null;
  rating_count?: number | null;

  sub_category?: never;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

type Channel = "african-food" | "african-market";

function normalizeCityFilterToVille(city?: string | null): string | undefined {
  if (!city) return undefined;
  const raw = String(city).trim();
  if (!raw) return undefined;

  const low = raw.toLowerCase();
  if (low.startsWith("cas")) return "Casablanca";
  if (low.startsWith("mar")) return "Marrakech";

  return raw;
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

    // ✅ NEW
    categoryId?: number;
    subCategoryId?: number;
    q?: string;
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

  // ✅ NEW
  if (opts.categoryId) query.categoryId = opts.categoryId;
  if (opts.subCategoryId) query.subCategoryId = opts.subCategoryId;
  if (opts.q) query.q = String(opts.q);

  return api.get<Paginated<Product>>(base, { query });
}
