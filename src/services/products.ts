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

/**
 * ✅ FOOD options (accompagnements / boissons chaud-froid / custom)
 * - facultatif: si le backend ne renvoie pas ces champs, ça casse pas
 */
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

/**
 * ✅ Supplier aggregates (optional)
 * - returned only if supplier_* tables exist on backend
 * - null otherwise (safe)
 */
export type SupplierAgg = {
  supplier_stock?: number | null;
  supplier_cost?: number | null;
  supplier_last_supply_at?: string | null;
};

export type Product = SupplierAgg & {
  id: number;
  shop_id: number | null;
  country_code?: string | null;

  category_id?: number | null;
  sub_category_id?: number | null;

  category_name?: string | null;
  category_slug?: string | null;

  sub_category_slug?: string | null;
  sub_category_name?: string | null;

  vertical?: "FOOD" | "MARKET" | "FASHION" | null;

  name: string;
  brand?: string | null;
  slug: string;

  price: number;
  vendor_price?: number | null;

  has_variants?: boolean;
  min_price?: number | null;
  variants_count?: number | null;

  currency?: string | null;
  description?: string | null;
  conditionnement?: string | null;

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
  shop_slug?: string | null;
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

  /** ✅ rupture / disponibilité */
  stock_status?: "IN_STOCK" | "OUT_OF_STOCK" | string | null;
  is_out_of_stock?: boolean | 0 | 1 | null;
  availability_message?: string | null;

  sub_category?: never;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

type Channel = "african-food" | "african-market";
type Vertical = "FOOD" | "MARKET" | "FASHION";

/** ✅ pilotage du site */
export type SiteStatus = {
  is_closed: boolean;
  message: string;
};

export type SiteStatusPayload = {
  is_closed: boolean;
  message?: string | null;
};

export type ProductStockStatusPayload = {
  is_out_of_stock: boolean;
  availability_message?: string | null;
};

export type ProductStockStatusResponse = {
  ok: true;
  id: number;
  stock_status: "IN_STOCK" | "OUT_OF_STOCK" | string;
  is_out_of_stock: boolean;
  availability_message: string | null;
};

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

function normalizeSiteStatus(res: any): SiteStatus {
  const body = unwrap<any>(res);
  return {
    is_closed: Boolean(
      body?.is_closed ??
      body?.site_closed ??
      body?.closed ??
      false
    ),
    message: String(
      body?.message ??
      body?.site_closed_message ??
      ""
    ),
  };
}

export function isProductActive(p: any): boolean {
  return !!(p?.active ?? p?.is_active ?? 1);
}

export function isVariantActive(v: any): boolean {
  return !!(v?.is_active ?? 1);
}

export function hasActiveVariants(p: any): boolean {
  const vs: any[] = Array.isArray(p?.variants) ? p.variants : [];
  return vs.some((x) => isVariantActive(x));
}

/** ✅ rupture produit */
export function isProductOutOfStock(p: any): boolean {
  const stockStatus = String(p?.stock_status || "").trim().toUpperCase();
  return Boolean(
    p?.is_out_of_stock === true ||
    Number(p?.is_out_of_stock || 0) === 1 ||
    stockStatus === "OUT_OF_STOCK"
  );
}

function filterActive<T extends any>(arr: T[]): T[] {
  return (arr || []).filter((p: any) => isProductActive(p));
}

/* ======================================================================
 * Normalizers
 * ===================================================================== */

function asArray<T = any>(x: any): T[] {
  const body = unwrap<any>(x);

  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  if (body && Array.isArray(body.data)) return body.data;
  if (body && Array.isArray(body.rows)) return body.rows;
  if (body && Array.isArray(body.results)) return body.results;
  if (body?.data && Array.isArray(body.data.items)) return body.data.items;

  return [];
}

function asPaginated<T = any>(x: any): Paginated<T> {
  const body = unwrap<any>(x);

  if (body && Array.isArray(body.items) && body.pageInfo) return body as Paginated<T>;
  if (body?.data && Array.isArray(body.data.items) && body.data.pageInfo) {
    return body.data as Paginated<T>;
  }

  const items = asArray<T>(body);
  const pageInfo = {
    page: Number(body?.pageInfo?.page ?? 1),
    pageSize: Number(body?.pageInfo?.pageSize ?? items.length),
    total: Number(body?.pageInfo?.total ?? items.length),
  };

  return { items, pageInfo };
}

/* ======================================================================
 * Shared query helper
 * ===================================================================== */

function withPageCompat(query: Record<string, any>, page: number, pageSize: number) {
  query.page = page;
  query.pageSize = pageSize;
  query.pagesize = pageSize;
  query.page_size = pageSize;
  return query;
}

/* ======================================================================
 * Products (MANAGE)
 * ===================================================================== */

export async function listManageProducts(
  opts: {
    page?: number;
    pageSize?: number;
    onlyActive?: boolean;
    category_id?: number;
    sub_category_id?: number;
    shop_id?: number;
    q?: string;
    vertical?: Vertical;
    includeVariants?: boolean;
    onlyWithVariants?: boolean;
    includeOptions?: boolean;
  } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const onlyActive = opts.onlyActive ?? true;

  const query: Record<string, any> = {};
  withPageCompat(query, page, pageSize);

  if (onlyActive) query.onlyActive = 1;

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

  if (opts.includeVariants) query.includeVariants = 1;
  if (opts.onlyWithVariants) query.onlyWithVariants = 1;
  if (opts.includeOptions) query.includeOptions = 1;

  const raw = await api.get<any>("/api/products/manage", { query });
  const res = asPaginated<Product>(raw);

  if (onlyActive) return { ...res, items: filterActive(res.items) };
  return res;
}

export async function getManageProductById(
  id: number,
  opts?: { variants?: boolean; options?: boolean }
): Promise<Product> {
  const query: Record<string, any> = {};
  if (opts?.variants) query.variants = 1;
  if (opts?.options) query.options = 1;

  const raw = await api.get<any>(`/api/products/manage/${id}`, { query });
  return unwrap<Product>(raw);
}

export async function getManageProductBySlug(
  slug: string,
  opts?: { variants?: boolean; options?: boolean }
): Promise<Product> {
  const s = String(slug || "").trim();
  if (!s) throw new Error("slug requis");

  const query: Record<string, any> = {};
  if (opts?.variants) query.variants = 1;
  if (opts?.options) query.options = 1;

  const raw = await api.get<any>(`/api/products/manage/slug/${encodeURIComponent(s)}`, { query });
  return unwrap<Product>(raw);
}

/* ======================================================================
 * Products (PUBLIC)
 * ===================================================================== */

export async function listProducts(
  opts: {
    page?: number;
    pageSize?: number;
    channel?: Channel;
    onlyActive?: boolean;
    category_id?: number;
    sub_category_id?: number;
    shop_id?: number;
    country_code?: string;
    brand?: string;
    q?: string;
    vertical?: Vertical;
    includeVariants?: boolean;
    onlyWithVariants?: boolean;
    includeOptions?: boolean;
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

  const query: Record<string, any> = {};
  withPageCompat(query, page, pageSize);

  if (onlyActive) query.onlyActive = 1;

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
  if (opts.country_code && String(opts.country_code).trim()) {
    query.country_code = String(opts.country_code).trim().toUpperCase();
    query.countryCode = query.country_code;
  }
  if (opts.brand && String(opts.brand).trim()) query.brand = String(opts.brand).trim();
  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  if (opts.includeVariants) query.includeVariants = 1;
  if (opts.onlyWithVariants) query.onlyWithVariants = 1;
  if (opts.includeOptions) query.includeOptions = 1;

  const raw = await api.get<any>(base, { query });
  const res = asPaginated<Product>(raw);

  if (onlyActive) return { ...res, items: filterActive(res.items) };
  return res;
}

export type ProductBrand = { brand: string; count: number };

export async function listProductBrands(opts: { vertical?: Vertical } = {}) {
  const query: Record<string, any> = {};
  const vert = normalizeVertical(opts.vertical);
  if (vert) query.vertical = vert;

  const raw = await api.get<any>("/api/products/brands", { query });
  const data = unwrap<any>(raw);
  return (Array.isArray(data?.items) ? data.items : []) as ProductBrand[];
}

export async function listPromotions(
  opts: {
    limit?: number;
    channel?: "all" | Channel;
    onlyActive?: boolean;
    category_id?: number;
    sub_category_id?: number;
    shop_id?: number;
    q?: string;
    vertical?: Vertical;
    includeVariants?: boolean;
    includeOptions?: boolean;
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

  if (opts.includeVariants) query.includeVariants = 1;
  if (opts.includeOptions) query.includeOptions = 1;

  const raw = await api.get<any>("/api/products/promotions", { query });
  const arr = asArray<Product>(raw);

  return onlyActive ? filterActive(arr) : arr;
}

export async function getProduct(
  id: number,
  opts?: { variants?: boolean; options?: boolean }
): Promise<Product> {
  const query: Record<string, any> = {};
  if (opts?.variants) query.variants = 1;
  if (opts?.options) query.options = 1;

  const raw = await api.get<any>(`/api/products/${id}`, { query });
  return unwrap<Product>(raw);
}

/* ======================================================================
 * ✅ Site status
 * ===================================================================== */

export async function getSiteStatus(): Promise<SiteStatus> {
  const raw = await api.get<any>("/api/admin/site-status");
  return normalizeSiteStatus(raw);
}

export async function updateSiteStatus(payload: SiteStatusPayload): Promise<SiteStatus> {
  const raw = await api.put<any>("/api/admin/site-status", {
    is_closed: !!payload.is_closed,
    message: payload.is_closed ? String(payload.message || "").trim() : "",
  });
  return normalizeSiteStatus(raw);
}

export async function closeSite(message?: string | null): Promise<SiteStatus> {
  return updateSiteStatus({
    is_closed: true,
    message:
      String(message || "").trim() ||
      "Le site est temporairement fermé. Merci de revenir plus tard.",
  });
}

export async function openSite(): Promise<SiteStatus> {
  return updateSiteStatus({
    is_closed: false,
    message: "",
  });
}

/* ======================================================================
 * Drinks (PUBLIC)
 * ===================================================================== */

export async function listShopDrinks(opts: {
  shop_id?: number;
  shopId?: number;
  q?: string;
  onlyActive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<Product>> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 40;
  const onlyActive = opts.onlyActive ?? true;

  const shopId = Number(opts.shopId ?? opts.shop_id ?? 0);
  if (!shopId) throw new Error("shopId requis");

  const query: Record<string, any> = { shopId };
  withPageCompat(query, page, pageSize);

  if (onlyActive) query.onlyActive = 1;
  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  const raw = await api.get<any>("/api/products/drinks", { query });
  const res = asPaginated<Product>(raw);

  return onlyActive ? { ...res, items: filterActive(res.items) } : res;
}

/* ======================================================================
 * Variants
 * ===================================================================== */

export async function listProductVariants(productId: number): Promise<ProductVariant[]> {
  const raw = await api.get<any>(`/api/products/${productId}/variants`);
  return asArray<ProductVariant>(raw);
}

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

export async function removeProductVariant(variantId: number): Promise<{ ok: true }> {
  const raw = await api.delete<any>(`/api/products/variants/${variantId}`);
  return unwrap<{ ok: true }>(raw);
}

/* ======================================================================
 * ✅ Produit rupture / réouverture
 * ===================================================================== */

export async function updateProductStockStatus(
  productId: number,
  payload: ProductStockStatusPayload
): Promise<ProductStockStatusResponse> {
  const raw = await api.patch<any>(`/api/products/${productId}/stock-status`, {
    is_out_of_stock: !!payload.is_out_of_stock,
    availability_message: payload.is_out_of_stock
      ? String(payload.availability_message || "").trim() ||
        "Ce produit est actuellement en rupture de stock."
      : null,
  });
  return unwrap<ProductStockStatusResponse>(raw);
}

export async function markProductOutOfStock(
  productId: number,
  message?: string | null
): Promise<ProductStockStatusResponse> {
  return updateProductStockStatus(productId, {
    is_out_of_stock: true,
    availability_message:
      String(message || "").trim() ||
      "Ce produit est actuellement en rupture de stock.",
  });
}

export async function reopenProduct(
  productId: number
): Promise<ProductStockStatusResponse> {
  return updateProductStockStatus(productId, {
    is_out_of_stock: false,
    availability_message: null,
  });
}

/* ======================================================================
 * Options (FOOD) — SAFE WRAPPERS
 * ===================================================================== */

const OPTIONS_BASE = "/api/products";

function isNotFoundError(e: any): boolean {
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("404") || msg.includes("not found");
}

export async function listProductOptionGroups(productId: number): Promise<ProductOptionGroup[]> {
  try {
    const raw = await api.get<any>(`${OPTIONS_BASE}/${productId}/options`);
    return asArray<ProductOptionGroup>(raw);
  } catch (e) {
    if (isNotFoundError(e)) return [];
    throw e;
  }
}

export async function upsertProductOptionGroups(
  productId: number,
  payload: {
    groups: Array<
      Partial<Omit<ProductOptionGroup, "choices">> & {
        choices?: Array<Partial<ProductOptionChoice>>;
      }
    >;
    replace?: boolean;
  }
): Promise<{ ok: true }> {
  try {
    const query: Record<string, any> = {};
    if (payload?.replace) query.replace = 1;
    const raw = await api.post<any>(`${OPTIONS_BASE}/${productId}/options`, payload, { query });
    return unwrap<{ ok: true }>(raw);
  } catch (e) {
    if (isNotFoundError(e)) return { ok: true };
    throw e;
  }
}

export async function removeProductOptionGroup(groupId: number): Promise<{ ok: true }> {
  try {
    const raw = await api.delete<any>(`${OPTIONS_BASE}/options/groups/${groupId}`);
    return unwrap<{ ok: true }>(raw);
  } catch (e) {
    if (isNotFoundError(e)) return { ok: true };
    throw e;
  }
}

/* ======================================================================
 * Create / Update / Delete (multipart)
 * ===================================================================== */

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
    option_groups?: Array<
      Partial<Omit<ProductOptionGroup, "choices">> & {
        choices?: Array<Partial<ProductOptionChoice>>;
      }
    >;
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

  if (Array.isArray((draft as any).option_groups) && (draft as any).option_groups.length) {
    fd.append("option_groups", JSON.stringify((draft as any).option_groups));
  }
  if ((draft as any).replace_options) fd.append("replace_options", "1");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  const raw = await api.post<any>("/api/products", fd);
  return unwrap<{ id: number; channel?: Channel; vertical?: Vertical }>(raw);
}

export async function updateProduct(
  id: number,
  draft: Partial<Product> & {
    option_groups?: Array<
      Partial<Omit<ProductOptionGroup, "choices">> & {
        choices?: Array<Partial<ProductOptionChoice>>;
      }
    >;
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

  fd.append("replace_images", replaceImages ? "true" : "false");

  if (Array.isArray((draft as any).option_groups) && (draft as any).option_groups.length) {
    fd.append("option_groups", JSON.stringify((draft as any).option_groups));
  }
  if ((draft as any).replace_options) fd.append("replace_options", "1");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  const raw = await api.put<any>(`/api/products/${id}`, fd);
  return unwrap<{ ok: true }>(raw);
}

export async function removeProduct(id: number): Promise<{ ok: true }> {
  const raw = await api.delete<any>(`/api/products/${id}`);
  return unwrap<{ ok: true }>(raw);
}

/* ======================================================================
 * Top / Ratings
 * ===================================================================== */

export async function listTopOrderedProducts(limit?: number): Promise<Product[]>;
export async function listTopOrderedProducts(opts: {
  limit?: number;
  onlyActive?: boolean;
}): Promise<Product[]>;
export async function listTopOrderedProducts(
  limitOrOpts?: number | { limit?: number; onlyActive?: boolean }
) {
  let limit = 8;
  let onlyActive = true;

  if (typeof limitOrOpts === "number") {
    limit = limitOrOpts;
  } else if (limitOrOpts && typeof limitOrOpts === "object") {
    if (typeof limitOrOpts.limit === "number") limit = limitOrOpts.limit;
    if (typeof limitOrOpts.onlyActive === "boolean") onlyActive = limitOrOpts.onlyActive;
  }

  const query: Record<string, any> = { limit };
  if (onlyActive) query.onlyActive = 1;

  const raw = await api.get<any>("/api/products/top-ordered", { query });
  const arr = asArray<Product>(raw);
  return onlyActive ? filterActive(arr) : arr;
}

export async function listTopRatedProducts(
  opts?: { limit?: number; minCount?: number; onlyActive?: boolean }
): Promise<Product[]>;
export async function listTopRatedProducts(
  opts: { limit?: number; minCount?: number; onlyActive?: boolean } = {}
) {
  const limit = opts.limit ?? 8;
  const minCount = opts.minCount ?? 2;
  const onlyActive = opts.onlyActive ?? true;

  const query: Record<string, any> = { limit, minCount };
  if (onlyActive) query.onlyActive = 1;

  const raw = await api.get<any>("/api/products/top-rated", { query });
  const arr = asArray<Product>(raw);
  return onlyActive ? filterActive(arr) : arr;
}

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

export async function rateProduct(
  productId: number,
  payload: { rating: number; comment?: string | null }
) {
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