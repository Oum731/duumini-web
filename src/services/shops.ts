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
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

/** ======= Public / Vendor ======= */

/** Liste paginée (publique / vendor) */
export async function listShops(opts: { page?: number; pageSize?: number; q?: string } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const q = opts.q;
  return api.get<Paginated<Shop>>("/api/shops", {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

/** Mes boutiques (vendor) */
export async function listMyShops() {
  return api.get<Shop[]>("/api/shops/mine");
}

/** Détail public (si jamais tu en as besoin côté vitrine) */
export async function getShop(id: number) {
  return api.get<Shop>(`/api/shops/${id}`);
}

/** ======= Admin ======= */

/** Liste paginée (admin) — utile si ton back sépare les endpoints admin */
export async function listShopsAdmin(opts: { page?: number; pageSize?: number; q?: string } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const q = opts.q;
  return api.get<Paginated<Shop>>("/api/admin/shops", {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

/** Détail (admin) */
export async function getShopAdmin(id: number) {
  return api.get<Shop>(`/api/admin/shops/${id}`);
}

/** Création (admin) — JSON simple; passe en FormData si tu envoies un logo plus tard */
export async function createShop(payload: Partial<Shop>) {
  return api.post<Shop>("/api/admin/shops", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Mise à jour (admin) */
export async function updateShop(id: number, payload: Partial<Shop>) {
  return api.put<Shop>(`/api/admin/shops/${id}`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Suppression (admin) */
export async function removeShop(id: number) {
  return api.delete<{ ok: true } | any>(`/api/admin/shops/${id}`);
}
