// src/services/shopCategories.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type ShopCategory = { id: number; name: string; slug: string };

/** Liste paginée des catégories de boutiques */
export async function listShopCategories(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  return api.get<Paginated<ShopCategory>>("/api/shop-categories", {
    query: { page, pageSize },
  });
}

/** Détail d'une catégorie */
export async function getShopCategory(id: number) {
  return api.get<ShopCategory>(`/api/shop-categories/${id}`);
}

/** Création d'une catégorie (Admin) */
export async function createShopCategory(name: string, slug?: string) {
  const payload: any = { name };
  if (slug && slug.trim()) payload.slug = slug.trim();

  return api.post<ShopCategory>("/api/shop-categories", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Mise à jour d'une catégorie (Admin) */
export async function updateShopCategory(id: number, data: { name: string; slug?: string }) {
  const payload: any = { name: data.name };
  if (data.slug && data.slug.trim()) payload.slug = data.slug.trim();

  return api.put<ShopCategory>(`/api/shop-categories/${id}`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Suppression d'une catégorie (Admin) */
export async function deleteShopCategory(id: number) {
  return api.delete<{ ok: true }>(`/api/shop-categories/${id}`);
}
