// src/services/shops.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type ShopType = "VENDOR" | "SUPPLIER" | "RESTAURANT" | string;

export type Shop = {
  id: number;
  owner_id: number;
  name: string;
  slug: string;

  // ✅ NEW: type d’acteur
  shop_type?: ShopType | null;

  description?: string | null;
  category_id?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  logo?: string | null;
  cover?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_active?: boolean;

  // Optionnel (si tu ajoutes une table de positions/zones)
  position_id?: number | null;

  category_name?: string | null;
  category_slug?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ShopFiles = {
  logo?: File | null;
  cover?: File | null;
};

/* ====== Stats d'une boutique (admin ou vendeur propriétaire) ====== */
export type ShopStats = {
  turnover: { day: number; month: number; year: number };
  duumini: { day: number; month: number; year: number };
  top_products: {
    product_id: number;
    name: string;
    total_qty: number;
    total_amount: number;
    cover?: string | null;
  }[];
};

/* =========================
 * Limite boutiques (front)
 * ========================= */
export type ShopLimitError = {
  error: "SHOP_LIMIT_REACHED";
  message?: string;
  limit?: number;
};

function extractApiErrorData(err: any): any | null {
  return err?.payload ?? err?.data ?? err?.response?.data ?? err?.body ?? err?.error ?? null;
}

export function isShopLimitError(err: any): err is ShopLimitError {
  const d = extractApiErrorData(err);
  return d?.error === "SHOP_LIMIT_REACHED";
}

/* =========================
 * Helpers query
 * =======================*/
function normalizeShopTypeList(v?: ShopType | ShopType[] | null): string | undefined {
  if (!v) return undefined;
  const arr = Array.isArray(v) ? v : [v];
  const clean = arr
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (!clean.length) return undefined;
  // on envoie "VENDOR,SUPPLIER" pour query
  return clean.join(",");
}

/** ======= Public / Vendor / Admin ======= */

/**
 * Liste paginée publique/admin
 * Supports:
 * - q
 * - shopType: "VENDOR" | "SUPPLIER" | "RESTAURANT" | ["VENDOR","RESTAURANT"]
 * - city
 * - onlyActive
 *
 * ⚠️ nécessite que ton backend /api/shops accepte ces filtres:
 * req.query.shopType / req.query.city / req.query.onlyActive
 */
export async function listShops(
  opts: {
    page?: number;
    pageSize?: number;
    q?: string;
    city?: string;
    onlyActive?: 0 | 1;
    shopType?: ShopType | ShopType[];
  } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  return api.get<Paginated<Shop>>("/api/shops", {
    query: {
      page,
      pageSize,
      ...(opts.q ? { q: opts.q } : {}),
      ...(opts.city ? { city: opts.city } : {}),
      ...(opts.onlyActive != null ? { onlyActive: opts.onlyActive } : {}),
      ...(opts.shopType ? { shopType: normalizeShopTypeList(opts.shopType) } : {}),
    },
  });
}

/** Raccourcis utiles */
export async function listSuppliers(opts: { page?: number; pageSize?: number; q?: string; city?: string } = {}) {
  return listShops({ ...opts, shopType: "SUPPLIER", onlyActive: 1 });
}
export async function listVendors(opts: { page?: number; pageSize?: number; q?: string; city?: string } = {}) {
  return listShops({ ...opts, shopType: "VENDOR", onlyActive: 1 });
}
export async function listRestaurants(opts: { page?: number; pageSize?: number; q?: string; city?: string } = {}) {
  return listShops({ ...opts, shopType: "RESTAURANT", onlyActive: 1 });
}

/** Mes boutiques (vendor/supplier/restaurant/admin) */
export async function listMyShops() {
  return api.get<Shop[]>("/api/shops/mine");
}

/** Détail public d’une boutique */
export async function getShop(id: number) {
  return api.get<Shop>(`/api/shops/${id}`);
}

/** Stats complètes d'une boutique (admin ou owner) */
export async function getShopStats(id: number) {
  return api.get<ShopStats>(`/api/shops/${id}/stats`);
}

/** ======= Admin (mêmes endpoints) ======= */
export async function listShopsAdmin(opts: { page?: number; pageSize?: number; q?: string; city?: string; shopType?: ShopType | ShopType[] } = {}) {
  return listShops(opts);
}

export async function getShopAdmin(id: number) {
  return getShop(id);
}

/** 🔹 Helper FormData */
function buildShopFormData(
  payload: Partial<Shop> & { description?: string | null },
  files?: ShopFiles
) {
  const fd = new FormData();

  if (payload.name !== undefined) {
    const cleanName = String(payload.name ?? "").trim();
    if (!cleanName) throw new Error("Le nom de la boutique est obligatoire.");
    fd.append("name", cleanName);
  }

  // ✅ NEW: shop_type
  if (payload.shop_type != null) fd.append("shop_type", String(payload.shop_type));

  if (payload.description !== undefined && payload.description !== null) {
    fd.append("description", String(payload.description));
  }

  if (payload.category_id != null) fd.append("category_id", String(payload.category_id));
  if (payload.address != null) fd.append("address", String(payload.address));
  if (payload.city != null) fd.append("city", String(payload.city));
  if (payload.country != null) fd.append("country", String(payload.country));
  if (payload.country_code != null) fd.append("country_code", String(payload.country_code));
  if (payload.lat != null) fd.append("lat", String(payload.lat));
  if (payload.lng != null) fd.append("lng", String(payload.lng));

  // optionnel
  if (payload.position_id != null) fd.append("position_id", String(payload.position_id));

  if (payload.logo != null && !files?.logo) fd.append("logo", String(payload.logo));
  if (payload.cover != null && !files?.cover) fd.append("cover", String(payload.cover));

  if (files?.logo) fd.append("logo_file", files.logo);
  if (files?.cover) fd.append("cover_file", files.cover);

  return fd;
}

/** Création (vendor/supplier/restaurant/admin) → multipart */
export async function createShop(
  payload: Partial<Shop> & { description?: string | null },
  files: ShopFiles = {}
) {
  const cleanPayload: Partial<Shop> & { description?: string | null } = {
    ...payload,
    description: payload.description ?? null,
  };

  const formData = buildShopFormData(cleanPayload, files);
  return api.post<Shop>("/api/shops", formData);
}

export async function createShopSafe(
  payload: Partial<Shop> & { description?: string | null },
  files: ShopFiles = {}
) {
  try {
    return await createShop(payload, files);
  } catch (err: any) {
    if (isShopLimitError(err)) {
      const d = extractApiErrorData(err) as ShopLimitError;
      const limit = d?.limit ?? 2;
      const message = d?.message ?? `Limite atteinte : maximum ${limit} boutiques.`;
      const e = new Error(message);
      (e as any).code = "SHOP_LIMIT_REACHED";
      (e as any).limit = limit;
      throw e;
    }
    throw err;
  }
}

/** Mise à jour (owner/admin) → multipart */
export async function updateShop(
  id: number,
  payload: Partial<Shop> & { description?: string | null },
  files: ShopFiles = {}
) {
  const cleanPayload: Partial<Shop> & { description?: string | null } = {
    ...payload,
    ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}),
    description: payload.description ?? null,
  };

  const formData = buildShopFormData(cleanPayload, files);
  return api.put<Shop>(`/api/shops/${id}`, formData);
}

/** Suppression (owner/admin) */
export async function removeShop(id: number) {
  return api.delete<{ ok: true }>(`/api/shops/${id}`);
}

/** Helper UI : savoir si on peut encore créer (VENDEUR max 2) */
export async function canCreateShop(max = 2) {
  const shops = await listMyShops();
  return (shops?.length ?? 0) < max;
}