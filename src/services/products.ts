// src/services/products.ts
import { api } from "./http";

export type PromoDiscountType = "PERCENT" | "AMOUNT";

/** Images */
export type ProductImage = { id: number; url: string; sort_order: number };

/** Variantes (fashion / tailles / couleurs) */
export type ProductVariant = {
  id: number;
  product_id: number;

  size?: string | null;
  color?: string | null;
  sku?: string | null;

  stock: number;
  price_override?: number | null;

  is_active?: 0 | 1 | null;

  created_at?: string | null;
  updated_at?: string | null;
};

export type ProductOptionChoice = {
  id: number;
  group_id: number;

  label: string;
  price_delta?: number | null;
  is_default?: 0 | 1 | null;
  is_active?: 0 | 1 | null;

  sort_order?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

export type ProductOptionGroup = {
  id: number;
  product_id: number;

  type: "ACCOMPANIMENT" | "DRINK_TEMP" | "CUSTOM";
  title: string;

  required?: 0 | 1 | null;
  max_select?: number | null;
  is_active?: 0 | 1 | null;

  sort_order?: number | null;

  created_at?: string | null;
  updated_at?: string | null;

  choices?: ProductOptionChoice[];
};

export type SupplierAgg = {
  supplier_stock?: number | null;
  supplier_cost?: number | null;
  supplier_last_supply_at?: string | null;
};

export type Product = SupplierAgg & {
  id: number;
  shop_id: number | null;

  category_id?: number | null;
  sub_category_id?: number | null;

  category_name?: string | null;
  category_slug?: string | null;

  sub_category_slug?: string | null;
  sub_category_name?: string | null;

  vertical?: "FOOD" | "MARKET" | "FASHION" | null;

  name: string;
  slug: string;

  price: number;
  vendor_price?: number | null;

  has_variants?: boolean;
  min_price?: number | null;
  variants_count?: number | null;

  currency?: string | null;
  description?: string | null;

  stock?: number | null;

  is_featured?: 0 | 1 | null;

  promo_eligible?: 0 | 1 | null;
  promo_discount_type?: PromoDiscountType | null;
  promo_discount_value?: number | null;
  promo_free_delivery?: 0 | 1 | null;

  promo_price?: number | null;
  min_promo_price?: number | null;
  has_promo?: boolean;

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

  variants?: ProductVariant[];
  option_groups?: ProductOptionGroup[];

  stock_status?: "IN_STOCK" | "OUT_OF_STOCK" | string | null;
  is_out_of_stock?: boolean | 0 | 1 | null;
  availability_message?: string | null;

  sub_category?: never;
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

/**
 * 🔥 AUTO SHOP DETECTION
 * Si une seule boutique existe → on la retourne
 */
async function getAutoShopId(): Promise<number | null> {
  try {
    const raw = await api.get<any>("/api/shops");
    const shops = unwrap<any[]>(raw);

    if (Array.isArray(shops) && shops.length === 1) {
      return shops[0]?.id ?? null;
    }
  } catch {
    // fail silent
  }

  return null;
}

/* ======================================================================
 * CREATE PRODUCT (MODIFIÉ)
 * ===================================================================== */

export async function createProduct(
  draft: Partial<Product> & {
    variants?: any[];
    replace_variants?: boolean;
    option_groups?: any[];
    replace_options?: boolean;
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

  const vert = String(draft.vertical || "").toUpperCase();
  if (vert) fd.append("vertical", vert);

  if (draft.is_featured != null) {
    fd.append("is_featured", String(Number(!!draft.is_featured)));
  }

  const promoEligible = Number(draft.promo_eligible ?? 0);
  fd.append("promo_eligible", String(promoEligible));

  if (promoEligible === 1) {
    if (draft.promo_discount_type) {
      fd.append("promo_discount_type", String(draft.promo_discount_type));
    }
    if (draft.promo_discount_value != null) {
      fd.append("promo_discount_value", String(draft.promo_discount_value));
    }
  }

  if (draft.is_active != null) {
    fd.append("is_active", String(Number(!!draft.is_active)));
  }

  /* =========================
   * 🔥 AUTO SHOP LOGIC ICI
   * ========================= */
  let shopId = draft.shop_id;

  if (shopId == null) {
    const auto = await getAutoShopId();
    if (auto != null) shopId = auto;
  }

  if (shopId != null) {
    fd.append("shop_id", String(shopId));
  }

  if (Array.isArray((draft as any).variants)) {
    fd.append("variants", JSON.stringify((draft as any).variants));
  }

  if (Array.isArray((draft as any).option_groups)) {
    fd.append("option_groups", JSON.stringify((draft as any).option_groups));
  }

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  const raw = await api.post<any>("/api/products", fd);
  return unwrap(raw);
}

/* ======================================================================
 * UPDATE PRODUCT (inchangé sauf shop safe possible)
 * ===================================================================== */

export async function updateProduct(
  id: number,
  draft: Partial<Product> & {
    option_groups?: any[];
    replace_options?: boolean;
  },
  files: File[],
  replaceImages = false
): Promise<{ ok: true }> {
  const fd = new FormData();

  if (draft.name) fd.append("name", draft.name);
  if (draft.price != null) fd.append("price", String(draft.price));
  if (draft.currency) fd.append("currency", String(draft.currency));
  if (draft.description != null) fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.category_id != null) fd.append("category_id", String(draft.category_id));
  if (draft.sub_category_id != null) fd.append("sub_category_id", String(draft.sub_category_id));

  if (draft.shop_id != null) {
    fd.append("shop_id", String(draft.shop_id));
  }

  fd.append("replace_images", replaceImages ? "true" : "false");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  const raw = await api.put<any>(`/api/products/${id}`, fd);
  return unwrap(raw);
}

/* ======================================================================
 * DELETE
 * ===================================================================== */

export async function removeProduct(id: number): Promise<{ ok: true }> {
  const raw = await api.delete<any>(`/api/products/${id}`);
  return unwrap(raw);
}