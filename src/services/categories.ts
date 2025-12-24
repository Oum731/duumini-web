// src/services/categories.ts
import { api } from "./http";

/** ✅ Aligne avec ton backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
};

/* ---------- Liste des catégories ---------- */
export async function listCategories(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;

  // ✅ ton backend utilise getPagination(req) et renvoie items/pageInfo
  return api.get<Paginated<Category>>("/api/categories", {
    query: { page, pageSize },
  });
}

/* ---------- Création d'une nouvelle catégorie ---------- */
export async function createCategory(payload: { name: string; slug?: string } | string) {
  const name = typeof payload === "string" ? payload : payload.name;
  const slug = typeof payload === "string" ? undefined : payload.slug;

  return api.post<{ id: number; name: string; slug: string }>("/api/categories", {
    name: String(name || "").trim(),
    ...(slug != null && String(slug).trim() ? { slug: String(slug).trim() } : {}),
  });
}
