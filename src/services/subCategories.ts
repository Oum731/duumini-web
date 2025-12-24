// src/services/subCategories.ts
import { api } from "./http";

/** ✅ Aligne avec ton backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

export type SubCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;

  // optionnels
  vertical?: "FOOD" | "MARKET" | "FASHION" | null;

  created_at?: string | null;
  updated_at?: string | null;

  // join backend
  category_name?: string | null;
  category_slug?: string | null;
};

type ListOpts = {
  page?: number;
  pageSize?: number;
  category_id?: number | null; // ✅ backend: category_id
  categoryId?: number | null; // compat front
};

export async function listSubCategories(opts: ListOpts = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 200;

  const query: Record<string, any> = { page, pageSize };

  // ✅ backend attend category_id (mais on accepte aussi categoryId côté caller)
  const cid = Number((opts.category_id ?? opts.categoryId) || 0);
  if (cid > 0) query.category_id = cid;

  return api.get<Paginated<SubCategory>>("/api/sub-categories", { query });
}

export async function createSubCategory(payload: {
  category_id: number;
  name: string;
  slug?: string;
  // ⚠️ backend sub-categories.js (celui que tu as montré) n'accepte pas vertical en body.
  // Donc on le garde seulement en type, mais on ne l'envoie pas.
}) {
  return api.post<SubCategory>("/api/sub-categories", {
    category_id: Number(payload.category_id),
    name: String(payload.name || "").trim(),
    ...(payload.slug != null && String(payload.slug).trim()
      ? { slug: String(payload.slug).trim() }
      : {}),
  });
}

export async function updateSubCategory(
  id: number,
  payload: Partial<Pick<SubCategory, "name" | "slug" | "category_id">>
) {
  const body: Record<string, any> = {};

  if (payload.name !== undefined) body.name = String(payload.name || "").trim();
  if (payload.slug !== undefined) body.slug = String(payload.slug || "").trim();

  // ✅ backend: si category_id absent => inchangé
  // ⚠️ ton backend ignore newCategoryId si null/0 => donc on n'envoie rien si invalide
  if (payload.category_id !== undefined) {
    const cid = Number(payload.category_id || 0);
    if (cid > 0) body.category_id = cid;
  }

  return api.put<{ ok: true; id: number; category_id: number; name: string; slug: string }>(
    `/api/sub-categories/${id}`,
    body
  );
}

export async function removeSubCategory(id: number) {
  return api.delete<{ ok: true; deleted: boolean }>(`/api/sub-categories/${id}`);
}
