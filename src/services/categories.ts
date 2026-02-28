// src/services/categories.ts
import { api } from "./http";

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

export type Vertical = "FOOD" | "MARKET" | "FASHION";

export type Category = {
  id: number;
  name: string;
  slug: string;

  vertical?: Vertical | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function normVertical(v: any): Vertical | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "FOOD" || s === "MARKET" || s === "FASHION") return s as Vertical;
  return null;
}

export async function listCategories(opts: {
  page?: number;
  pageSize?: number;
  q?: string;
  vertical?: Vertical;
  onlyActive?: boolean;
} = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;

  const query: Record<string, any> = { page, pageSize };
  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  const v = normVertical(opts.vertical);
  if (v) {
    query.vertical = v;
    query.v = v;
  }

  if (typeof opts.onlyActive === "boolean") query.onlyActive = opts.onlyActive ? 1 : 0;

  return api.get<Paginated<Category>>("/api/categories", { query });
}

/**
 * ✅ Backend now requires vertical (FOOD|MARKET|FASHION)
 * - Accepts:
 *    createCategory("Boissons", "FOOD")
 *    createCategory({name:"Boissons", slug:"boissons", vertical:"FOOD"})
 */
export async function createCategory(
  payload:
    | string
    | {
        name: string;
        slug?: string;
        vertical?: Vertical;
      },
  verticalArg?: Vertical
) {
  const name = typeof payload === "string" ? payload : payload.name;
  const slug = typeof payload === "string" ? undefined : payload.slug;

  const vertical =
    typeof payload === "string" ? normVertical(verticalArg) : normVertical((payload as any).vertical ?? verticalArg);

  if (!vertical) {
    throw new Error("vertical required (FOOD|MARKET|FASHION)");
  }

  return api.post<Category>("/api/categories", {
    name: String(name || "").trim(),
    ...(slug != null && String(slug).trim() ? { slug: String(slug).trim() } : {}),
    vertical,
  });
}