// src/services/products.ts
import { api } from "./http";

export type Product = {
  id: number;
  shop_id: number | null;            // ← peut être NULL côté ADMIN
  category_id?: number | null;
  name: string;
  slug: string;
  price: number;
  currency?: string;
  description?: string | null;
  stock?: number | null;
  is_featured?: 0 | 1;
  promo_eligible?: 0 | 1;
  // 🔹 On autorise maintenant des canaux custom (et plus seulement "product" | "food")
  sub_category?: string | null;
  created_at?: string;
  updated_at?: string;
  images?: { id: number; url: string; sort_order: number }[];
  cover?: string | null;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number; pages: number };
};

type Channel = "african-food" | "african-market";

/* ---------- Utils ---------- */
// 🔹 On ne force plus à "product" / "food" : on garde ce que le front envoie
function normalizeSubCategory(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s;
}

/* ---------- List ---------- */
export async function listProducts(opts: {
  page?: number;
  pageSize?: number;
  channel?: Channel;
} = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const base =
    opts.channel === "african-food"
      ? "/api/products/african-food"
      : opts.channel === "african-market"
      ? "/api/products/african-market"
      : "/api/products";

  return api.get<Paginated<Product>>(base, { query: { page, pageSize } });
}

/* ---------- Read ---------- */
export async function getProduct(id: number) {
  return api.get<Product>(`/api/products/${id}`);
}

/* ---------- Create ---------- */
/** Création: shop_id/category_id gérés au backend.
 *  - VENDEUR: shop_id déduit de l'utilisateur connecté
 *  - ADMIN: shop_id = NULL
 */
export async function createProduct(draft: Partial<Product>, files: File[]) {
  const fd = new FormData();
  if (draft.name) fd.append("name", draft.name);
  if (draft.price != null) fd.append("price", String(draft.price));
  if (draft.currency) fd.append("currency", draft.currency);
  if (draft.description != null) fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.is_featured != null) {
    // accepte 0|1 ou boolean
    const v = typeof draft.is_featured === "number" ? draft.is_featured : draft.is_featured ? 1 : 0;
    fd.append("is_featured", String(v));
  }
  if (draft.promo_eligible != null) {
    const v = typeof draft.promo_eligible === "number" ? draft.promo_eligible : draft.promo_eligible ? 1 : 0;
    fd.append("promo_eligible", String(v));
  }

  const sub = normalizeSubCategory(draft.sub_category ?? undefined);
  if (sub) fd.append("sub_category", sub);

  // images
  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.post<{ id: number; channel: Channel }>("/api/products", fd);
}

/* ---------- Update ---------- */
export async function updateProduct(
  id: number,
  draft: Partial<Product>,
  files: File[],
  replaceImages = false
) {
  const fd = new FormData();
  if (draft.name) fd.append("name", draft.name);
  if (draft.price != null) fd.append("price", String(draft.price));
  if (draft.currency) fd.append("currency", draft.currency);
  if (draft.description != null) fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.is_featured != null) {
    const v = typeof draft.is_featured === "number" ? draft.is_featured : draft.is_featured ? 1 : 0;
    fd.append("is_featured", String(v));
  }
  if (draft.promo_eligible != null) {
    const v = typeof draft.promo_eligible === "number" ? draft.promo_eligible : draft.promo_eligible ? 1 : 0;
    fd.append("promo_eligible", String(v));
  }

  const sub = normalizeSubCategory(draft.sub_category ?? undefined);
  if (sub) fd.append("sub_category", sub);

  if (draft.category_id != null) fd.append("category_id", String(draft.category_id));
  if (replaceImages) fd.append("replace_images", "true");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.put<{ ok: true }>(`/api/products/${id}`, fd);
}

/* ---------- Delete ---------- */
export async function removeProduct(id: number) {
  return api.delete<{ ok: true }>(`/api/products/${id}`);
}
