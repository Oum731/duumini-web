// src/services/subCategories.ts
import { api } from "./http";

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

export type Vertical = "FOOD" | "MARKET" | "FASHION";

export type SubCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;

  vertical?: Vertical | null;

  created_at?: string | null;
  updated_at?: string | null;

  category_name?: string | null;
  category_slug?: string | null;
};

function normVertical(v: any): Vertical | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "FOOD" || s === "MARKET" || s === "FASHION") return s as Vertical;
  return null;
}

type ListOpts = {
  page?: number;
  pageSize?: number;
  category_id?: number | null;
  categoryId?: number | null;
  q?: string;
  vertical?: Vertical;
  onlyActive?: boolean;
};

export async function listSubCategories(opts: ListOpts = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 200;

  const query: Record<string, any> = { page, pageSize };

  const cid = Number((opts.category_id ?? opts.categoryId) || 0);
  if (cid > 0) query.category_id = cid;

  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  const v = normVertical(opts.vertical);
  if (v) {
    query.vertical = v;
    query.v = v;
  }

  if (typeof opts.onlyActive === "boolean") query.onlyActive = opts.onlyActive ? 1 : 0;

  return api.get<Paginated<SubCategory>>("/api/sub-categories", { query });
}

/**
 * ✅ Certains backends exigent aussi vertical sur sub-categories.
 * On l’envoie si fourni (recommandé).
 */
export async function createSubCategory(payload: {
  category_id: number;
  name: string;
  slug?: string;
  vertical?: Vertical; // ✅ send if backend requires
}) {
  const vertical = normVertical(payload.vertical);

  return api.post<SubCategory>("/api/sub-categories", {
    category_id: Number(payload.category_id),
    name: String(payload.name || "").trim(),
    ...(payload.slug != null && String(payload.slug).trim()
      ? { slug: String(payload.slug).trim() }
      : {}),
    ...(vertical ? { vertical } : {}),
  });
}

export async function updateSubCategory(
  id: number,
  payload: Partial<Pick<SubCategory, "name" | "slug" | "category_id" | "vertical">>
) {
  const body: Record<string, any> = {};

  if (payload.name !== undefined) body.name = String(payload.name || "").trim();
  if (payload.slug !== undefined) body.slug = String(payload.slug || "").trim();

  if (payload.category_id !== undefined) {
    const cid = Number(payload.category_id || 0);
    if (cid > 0) body.category_id = cid;
  }

  if (payload.vertical !== undefined) {
    const v = normVertical(payload.vertical);
    if (!v) throw new Error("vertical invalid (FOOD|MARKET|FASHION)");
    body.vertical = v;
  }

  return api.put<{ ok: true }>(`/api/sub-categories/${id}`, body);
}

export async function removeSubCategory(id: number) {
  return api.delete<{ ok: true; deleted: boolean }>(`/api/sub-categories/${id}`);
}