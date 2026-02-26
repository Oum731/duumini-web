// src/services/shopCategories.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type ShopCategory = { id: number; name: string; slug: string };

/** Liste paginée des catégories de boutiques */
export async function listShopCategories(
  opts: { page?: number; pageSize?: number } = {}
) {
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
  const payload: any = { name: String(name || "").trim() };
  if (!payload.name) throw new Error("name required");
  if (slug && String(slug).trim()) payload.slug = String(slug).trim();

  return api.post<ShopCategory>("/api/shop-categories", payload);
}

/** Mise à jour d'une catégorie (Admin) */
export async function updateShopCategory(
  id: number,
  data: { name: string; slug?: string }
) {
  const payload: any = { name: String(data?.name || "").trim() };
  if (!payload.name) throw new Error("name required");
  if (data?.slug && String(data.slug).trim()) payload.slug = String(data.slug).trim();

  return api.put<ShopCategory>(`/api/shop-categories/${id}`, payload);
}

/** Suppression d'une catégorie (Admin) */
export async function deleteShopCategory(id: number) {
  return api.delete<{ ok: true }>(`/api/shop-categories/${id}`);
}