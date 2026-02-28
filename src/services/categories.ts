// src/services/categories.ts
import { api } from "./http";

export type Vertical = "FOOD" | "MARKET" | "FASHION";

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number; totalPages?: number; hasNext?: boolean; hasPrev?: boolean };
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  vertical?: Vertical | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeVertical(v: any): Vertical | null {
  const x = String(v ?? "").trim().toUpperCase();
  if (x === "FOOD" || x === "MARKET" || x === "FASHION") return x as Vertical;
  return null;
}

export async function listCategories(opts: { page?: number; pageSize?: number; vertical?: Vertical | string | null } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;

  const query: Record<string, any> = { page, pageSize };
  const v = normalizeVertical(opts.vertical);
  if (v) query.vertical = v;

  return api.get<Paginated<Category>>("/api/categories", { query });
}

/**
 * ✅ POST /api/categories
 * backend: vertical required
 */
export async function createCategory(
  payload: { name: string; slug?: string; vertical: Vertical } | string,
  vertical?: Vertical
) {
  const name = typeof payload === "string" ? payload : payload.name;
  const slug = typeof payload === "string" ? undefined : payload.slug;
  const v = normalizeVertical(typeof payload === "string" ? vertical : (payload as any).vertical);

  if (!v) throw new Error("vertical required (FOOD|MARKET|FASHION)");

  return api.post<{ id: number; name: string; slug: string; vertical?: Vertical | null }>(
    "/api/categories",
    {
      name: String(name || "").trim(),
      ...(slug != null && String(slug).trim() ? { slug: String(slug).trim() } : {}),
      vertical: v,
    }
  );
}