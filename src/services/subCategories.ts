// src/services/subCategories.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type SubCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  created_at?: string;
  updated_at?: string;

  // join backend
  category_name?: string | null;
  category_slug?: string | null;
};

type ListOpts = {
  page?: number;
  pageSize?: number;
  categoryId?: number | null;
};

export async function listSubCategories(opts: ListOpts = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 200;

  const query: Record<string, any> = { page, pageSize };

  const cid = Number(opts.categoryId || 0);
  if (cid > 0) query.category_id = cid;

  return api.get<Paginated<SubCategory>>("/api/sub-categories", { query });
}

export async function createSubCategory(payload: {
  category_id: number;
  name: string;
  slug?: string;
}) {
  return api.post<SubCategory>("/api/sub-categories", {
    category_id: Number(payload.category_id),
    name: String(payload.name || "").trim(),
    ...(payload.slug ? { slug: String(payload.slug).trim() } : {}),
  });
}

export async function updateSubCategory(
  id: number,
  payload: Partial<Pick<SubCategory, "name" | "slug" | "category_id">>
) {
  const body: Record<string, any> = {};

  if (payload.name !== undefined) body.name = String(payload.name || "").trim();
  if (payload.slug !== undefined) body.slug = String(payload.slug || "").trim();

  if (payload.category_id !== undefined) {
    const cid = Number(payload.category_id || 0);
    body.category_id = cid > 0 ? cid : null;
  }

  return api.put<{ ok: true; id: number; category_id: number; name: string; slug: string }>(
    `/api/sub-categories/${id}`,
    body
  );
}

export async function removeSubCategory(id: number) {
  return api.delete<{ ok: true; deleted: boolean }>(`/api/sub-categories/${id}`);
}
