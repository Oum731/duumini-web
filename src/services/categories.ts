import { api } from "./http";
import type { Paginated } from "./types";

export type Category = { id: number; name: string; slug: string };

export async function listCategories(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  return api.get<Paginated<Category>>("/api/categories", { query: { page, pageSize } });
}
