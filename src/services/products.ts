// src/services/products.ts
import { api } from "./http";

export type Product = {
  id: number;
  shop_id: number | null; // ← boutique associée (obligatoire côté ADMIN)
  category_id?: number | null;
  name: string;
  slug: string;

  /**
   * 💰 Prix affiché côté client (prix vendeur + commission Duumini)
   * → C'est cette valeur qui doit être utilisée sur le site / app côté client.
   */
  price: number;

  /**
   * 💼 Prix de base saisi par le vendeur/admin (hors commission Duumini).
   * - Si présent, c’est cette valeur que le back-office doit éditer.
   * - La commission est ensuite ajoutée côté backend pour calculer `price`.
   */
  vendor_price?: number | null;

  currency?: string;
  description?: string | null;
  stock?: number | null;
  is_featured?: 0 | 1;
  promo_eligible?: 0 | 1;
  // 🔹 Utilisé côté backend pour savoir si c'est FOOD (18%) ou MARKET (11%)
  //    En pratique: 'food' | 'product'
  sub_category?: string | null;
  created_at?: string;
  updated_at?: string;
  images?: { id: number; url: string; sort_order: number }[];
  cover?: string | null;

  // 🔹 Infos boutique (jointure shops)
  shop_name?: string | null;
  shop_logo?: string | null;
  shop_cover?: string | null;

  // 🔹 Activation / désactivation du produit
  is_active?: 0 | 1;

  // 🔹 Champs supplémentaires renvoyés par certaines routes (facultatifs)
  total_qty?: number; // pour /top-ordered
  avg_rating?: number; // pour /top-rated
  rating_count?: number; // pour /top-rated
};

export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number; pages: number };
};

type Channel = "african-food" | "african-market";

/* ---------- Utils ---------- */
// On laisse passer la valeur telle quelle, mais l’UI doit bien envoyer 'food' ou 'product'
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
  /** seulement produits actifs (is_active = 1) */
  onlyActive?: boolean;
} = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const base =
    opts.channel === "african-food"
      ? "/api/products/african-food"
      : opts.channel === "african-market"
      ? "/api/products/african-market"
      : "/api/products";

  const query: Record<string, any> = { page, pageSize };
  if (opts.onlyActive) {
    query.onlyActive = 1;
  }

  return api.get<Paginated<Product>>(base, { query });
}

/* ---------- Read ---------- */
export async function getProduct(id: number) {
  return api.get<Product>(`/api/products/${id}`);
}

/* ---------- Create ---------- */
/** Création:
 *  - VENDEUR: shop_id déduit de l'utilisateur connecté côté API
 *  - ADMIN: shop_id doit être fourni (sélect "Boutique" dans le back-office)
 *
 * 💡 IMPORTANT:
 *  - `vendor_price` = prix base saisi par vendeur/admin
 *  - `price` côté BDD = prix vendeur, la commission est ajoutée côté backend
 *  - Le backend renvoie ensuite `price` (client) + `vendor_price` (base)
 */
export async function createProduct(draft: Partial<Product>, files: File[]) {
  const fd = new FormData();
  if (draft.name) fd.append("name", draft.name);

  // 💰 Prix base envoyé à l'API = vendor_price si dispo, sinon price
  const basePrice =
    draft.vendor_price != null ? draft.vendor_price : draft.price;
  if (basePrice != null) {
    fd.append("price", String(basePrice));
  }

  if (draft.currency) fd.append("currency", draft.currency);
  if (draft.description != null)
    fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  // 🔹 Catégorie (Market)
  if (draft.category_id != null) {
    fd.append("category_id", String(draft.category_id));
  }

  if (draft.is_featured != null) {
    // accepte 0|1 ou boolean
    const v =
      typeof draft.is_featured === "number"
        ? draft.is_featured
        : draft.is_featured
        ? 1
        : 0;
    fd.append("is_featured", String(v));
  }
  if (draft.promo_eligible != null) {
    const v =
      typeof draft.promo_eligible === "number"
        ? draft.promo_eligible
        : draft.promo_eligible
        ? 1
        : 0;
    fd.append("promo_eligible", String(v));
  }

  // 🔹 Actif / inactif (par défaut 1 côté API si non fourni)
  if (draft.is_active != null) {
    const v =
      typeof draft.is_active === "number" ? draft.is_active : draft.is_active ? 1 : 0;
    fd.append("is_active", String(v));
  }

  const sub = normalizeSubCategory(draft.sub_category ?? undefined);
  if (sub) fd.append("sub_category", sub);

  // 🔹 Boutique (ADMIN doit en choisir une)
  if (draft.shop_id != null) {
    fd.append("shop_id", String(draft.shop_id));
  }

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

  // 💰 Même logique que create:
  // - si vendor_price présent → c'est le prix base à jour
  // - sinon on tombe en fallback sur draft.price (mais attention: c'est le prix client
  //   si on ne met pas à jour l'UI backoffice pour éditer vendor_price).
  const basePrice =
    draft.vendor_price != null ? draft.vendor_price : draft.price;
  if (basePrice != null) {
    fd.append("price", String(basePrice));
  }

  if (draft.currency) fd.append("currency", draft.currency);
  if (draft.description != null)
    fd.append("description", String(draft.description || ""));
  if (draft.stock != null) fd.append("stock", String(draft.stock));

  if (draft.is_featured != null) {
    const v =
      typeof draft.is_featured === "number"
        ? draft.is_featured
        : draft.is_featured
        ? 1
        : 0;
    fd.append("is_featured", String(v));
  }
  if (draft.promo_eligible != null) {
    const v =
      typeof draft.promo_eligible === "number"
        ? draft.promo_eligible
        : draft.promo_eligible
        ? 1
        : 0;
    fd.append("promo_eligible", String(v));
  }

  // 🔹 Actif / inactif
  if (draft.is_active != null) {
    const v =
      typeof draft.is_active === "number" ? draft.is_active : draft.is_active ? 1 : 0;
    fd.append("is_active", String(v));
  }

  const sub = normalizeSubCategory(draft.sub_category ?? undefined);
  if (sub) fd.append("sub_category", sub);

  if (draft.category_id != null) fd.append("category_id", String(draft.category_id));

  // 🔹 Possibilité de changer de boutique (ADMIN uniquement côté API)
  if (draft.shop_id != null) {
    fd.append("shop_id", String(draft.shop_id));
  }

  if (replaceImages) fd.append("replace_images", "true");

  files.slice(0, 8).forEach((f) => fd.append("images[]", f));

  return api.put<{ ok: true }>(`/api/products/${id}`, fd);
}

/* ---------- Delete ---------- */
export async function removeProduct(id: number) {
  return api.delete<{ ok: true }>(`/api/products/${id}`);
}

/* ---------- Top produits : les plus commandés ---------- */
export async function listTopOrderedProducts(limit = 8) {
  return api.get<Product[]>("/api/products/top-ordered", {
    query: { limit },
  });
}

/* ---------- Top produits : les mieux notés ---------- */
export async function listTopRatedProducts(
  opts: { limit?: number; minCount?: number } = {}
) {
  const limit = opts.limit ?? 8;
  const minCount = opts.minCount ?? 2;
  return api.get<Product[]>("/api/products/top-rated", {
    query: { limit, minCount },
  });
}
