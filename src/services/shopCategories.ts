import { api } from "./http";
import type { Paginated } from "./types";

export type ShopCategory = { id: number; name: string; slug: string };

export async function listShopCategories(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  return api.get<Paginated<ShopCategory>>("/api/shop-categories", { query: { page, pageSize } });
}
