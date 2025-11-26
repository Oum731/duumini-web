// src/services/shops.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type Shop = {
  id: number;
  owner_id: number;
  name: string;
  slug: string;
  description?: string | null;
  category_id?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
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

export type ShopFiles = {
  logo?: File | null;
  cover?: File | null;
};

/* ====== Stats d'une boutique (admin ou vendeur propriétaire) ====== */
/**
 * Structure renvoyée par GET /api/shops/:id/stats
 * - turnover = CA basé sur le prix NORMAL du produit (products.price), hors frais de livraison
 * - duumini  = commission Duumini (pourcentage du prix normal, selon la sous-catégorie)
 * - top_products.total_amount = CA 30j pour ce produit (toujours sur le prix normal, hors livraison)
 */
export type ShopStats = {
  turnover: {
    day: number;   // CA (prix normal vendeur) du jour, hors livraison
    month: number; // CA (prix normal vendeur) du mois
    year: number;  // CA (prix normal vendeur) de l'année
  };
  duumini: {
    day: number;   // Commission Duumini du jour (pourcentage du prix normal, hors livraison)
    month: number; // Commission Duumini du mois
    year: number;  // Commission Duumini de l'année
  };
  top_products: {
    product_id: number;
    name: string;
    total_qty: number;
    total_amount: number; // CA 30j pour ce produit (prix normal, hors livraison)
    cover?: string | null;
  }[];
};

/** ======= Public / Vendor / Admin ======= */

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

/** Stats complètes d'une boutique (admin ou vendeur propriétaire) */
export async function getShopStats(id: number) {
  // Backend: GET /api/shops/:id/stats (ADMIN ou VENDEUR)
  return api.get<ShopStats>(`/api/shops/${id}/stats`);
}

/** ======= "Admin" (même endpoints, mais usage côté dashboard) ======= */

export async function listShopsAdmin(opts: { page?: number; pageSize?: number; q?: string } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const q = opts.q;
  return api.get<Paginated<Shop>>("/api/shops", {
    query: { page, pageSize, ...(q ? { q } : {}) },
  });
}

export async function getShopAdmin(id: number) {
  return api.get<Shop>(`/api/shops/${id}`);
}

/** 🔹 Helper pour construire le FormData à partir du draft + fichiers */
function buildShopFormData(
  payload: Partial<Shop> & { description?: string | null },
  files?: ShopFiles
) {
  const fd = new FormData();

  // 🔴 Nom OBLIGATOIRE pour la création (le backend refuse si vide)
  if (payload.name !== undefined) {
    const cleanName = String(payload.name ?? "").trim();
    if (!cleanName) {
      throw new Error("Le nom de la boutique est obligatoire.");
    }
    fd.append("name", cleanName);
  }

  // Description
  if (payload.description !== undefined && payload.description !== null) {
    fd.append("description", String(payload.description));
  }

  // Champs texte optionnels
  if (payload.category_id != null) fd.append("category_id", String(payload.category_id));
  if (payload.address != null) fd.append("address", String(payload.address));
  if (payload.city != null) fd.append("city", String(payload.city));
  if (payload.country != null) fd.append("country", String(payload.country));
  if (payload.lat != null) fd.append("lat", String(payload.lat));
  if (payload.lng != null) fd.append("lng", String(payload.lng));

  // Support logo/cover URL texte si pas de fichier
  if (payload.logo != null && !files?.logo) {
    fd.append("logo", String(payload.logo));
  }
  if (payload.cover != null && !files?.cover) {
    fd.append("cover", String(payload.cover));
  }

  // Fichiers
  if (files?.logo) {
    fd.append("logo_file", files.logo);
  }
  if (files?.cover) {
    fd.append("cover_file", files.cover);
  }

  return fd;
}

/** Création (vendor ou admin) → multipart/form-data */
export async function createShop(
  payload: Partial<Shop> & { description?: string | null },
  files: ShopFiles = {}
) {
  const cleanPayload: Partial<Shop> & { description?: string | null } = {
    ...payload,
    description: payload.description ?? null,
  };

  const formData = buildShopFormData(cleanPayload, files);

  // ✅ On passe directement le FormData en 2ᵉ argument (body)
  return api.post<Shop>("/api/shops", formData);
}

/** Mise à jour (vendor propriétaire ou admin) → multipart/form-data */
export async function updateShop(
  id: number,
  payload: Partial<Shop> & { description?: string | null },
  files: ShopFiles = {}
) {
  const cleanPayload: Partial<Shop> & { description?: string | null } = {
    ...payload,
    ...(payload.name !== undefined
      ? { name: String(payload.name).trim() }
      : {}),
    description: payload.description ?? null,
  };

  const formData = buildShopFormData(cleanPayload, files);

  // ✅ Là aussi on passe le FormData directement
  return api.put<Shop>(`/api/shops/${id}`, formData);
}

/** Suppression (vendor propriétaire ou admin) */
export async function removeShop(id: number) {
  return api.delete<{ ok: true }>(`/api/shops/${id}`);
}
