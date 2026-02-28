// src/services/subCategories.ts
import { api } from "./http";

export type Vertical = "FOOD" | "MARKET" | "FASHION";

/** ✅ Aligne avec ton backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number; totalPages?: number; hasNext?: boolean; hasPrev?: boolean };
};

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

type ListOpts = {
  page?: number;
  pageSize?: number;
  category_id?: number | null;
  categoryId?: number | null;
  vertical?: Vertical | string | null;
};

function normalizeVertical(v: any): Vertical | null {
  const x = String(v ?? "").trim().toUpperCase();
  if (x === "FOOD" || x === "MARKET" || x === "FASHION") return x as Vertical;
  return null;
}

function slugify(str: any) {
  const out = String(str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || Date.now().toString(36);
}

export async function listSubCategories(opts: ListOpts = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 200;

  const query: Record<string, any> = { page, pageSize };

  const cid = Number((opts.category_id ?? opts.categoryId) || 0);
  if (cid > 0) query.category_id = cid;

  const v = normalizeVertical(opts.vertical);
  if (v) query.vertical = v;

  return api.get<Paginated<SubCategory>>("/api/sub-categories", { query });
}

/**
 * ✅ POST /api/sub-categories
 * - Envoie vertical + slug (auto si absent)
 * - Evite 400 "vertical required" / "slug required"
 */
export async function createSubCategory(payload: {
  category_id: number;
  name: string;
  slug?: string;
  vertical: Vertical;
}) {
  const category_id = Number(payload.category_id || 0);
  const name = String(payload.name || "").trim();
  const vertical = normalizeVertical(payload.vertical);

  if (!category_id) throw new Error("category_id required");
  if (!name) throw new Error("name required");
  if (!vertical) throw new Error("vertical required (FOOD|MARKET|FASHION)");

  const slug =
    payload.slug != null && String(payload.slug).trim()
      ? slugify(String(payload.slug).trim())
      : slugify(name);

  return api.post<SubCategory>("/api/sub-categories", {
    category_id,
    name,
    slug,
    vertical,
  });
}

export async function updateSubCategory(
  id: number,
  payload: Partial<Pick<SubCategory, "name" | "slug" | "category_id" | "vertical">>
) {
  const body: Record<string, any> = {};

  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) throw new Error("name cannot be empty");
    body.name = name;
  }

  if (payload.slug !== undefined) {
    const slug = String(payload.slug || "").trim();
    body.slug = slug ? slugify(slug) : slug;
  }

  if (payload.category_id !== undefined) {
    const cid = Number(payload.category_id || 0);
    if (cid > 0) body.category_id = cid;
  }

  if (payload.vertical !== undefined) {
    const v = normalizeVertical(payload.vertical);
    if (!v) throw new Error("vertical invalid (FOOD|MARKET|FASHION)");
    body.vertical = v;
  }

  return api.put<{ ok: true }>(`/api/sub-categories/${id}`, body);
}

export async function removeSubCategory(id: number) {
  return api.delete<{ ok: true }>(`/api/sub-categories/${id}`);
}