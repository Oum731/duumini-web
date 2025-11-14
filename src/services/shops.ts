// src/services/shops.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type Shop = {
  id: number;
  owner_id: number;
  name: string;
  slug: string;
  category_id?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  logo?: string | null;
  cover?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_active?: boolean;
  category_name?: string | null;
  category_slug?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** ======= Public / Vendor ======= */

/** Liste paginée publique (avec recherche optionnelle q) */
export async function listShops(opts: { page?: number; pageSize?: number; q?: string } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const q = opts.q;
  return api.get<Paginated<Shop>>("/api/shops", {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

/** Mes boutiques (vendor / admin) */
export async function listMyShops() {
  return api.get<Shop[]>("/api/shops/mine");
}

/** Détail public d’une boutique */
export async function getShop(id: number) {
  return api.get<Shop>(`/api/shops/${id}`);
}

/** ======= "Admin" (même endpoints, mais usage côté dashboard) ======= */

/** Liste paginée pour l’admin */
export async function listShopsAdmin(opts: { page?: number; pageSize?: number; q?: string } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const q = opts.q;
  return api.get<Paginated<Shop>>("/api/shops", {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

/** Détail pour l’admin */
export async function getShopAdmin(id: number) {
  return api.get<Shop>(`/api/shops/${id}`);
}

/** Création (vendor ou admin) */
export async function createShop(payload: Partial<Shop>) {
  return api.post<Shop>("/api/shops", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Mise à jour (vendor propriétaire ou admin) */
export async function updateShop(id: number, payload: Partial<Shop>) {
  return api.put<Shop>(`/api/shops/${id}`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Suppression (vendor propriétaire ou admin) */
export async function removeShop(id: number) {
  return api.delete<{ ok: true }>(`/api/shops/${id}`);
}
