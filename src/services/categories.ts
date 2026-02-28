// src/services/categories.ts
import { api } from "./http";

/** ✅ Aligne avec ton backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

export type Vertical = "FOOD" | "MARKET" | "FASHION";

export type Category = {
  id: number;
  name: string;
  slug: string;

  // ✅ optionnels (si colonnes existent côté backend)
  vertical?: Vertical | null;
  is_active?: 0 | 1 | null;
  active?: 0 | 1 | null; // compat

  created_at?: string | null;
  updated_at?: string | null;
};

function unwrap<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res) return res.data as T;
  return res as T;
}

function asPaginated<T = any>(x: any): Paginated<T> {
  const body = unwrap<any>(x);

  if (body && Array.isArray(body.items) && body.pageInfo) return body as Paginated<T>;
  if (body?.data && Array.isArray(body.data.items) && body.data.pageInfo) return body.data as Paginated<T>;

  const items: T[] = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
  const pageInfo = {
    page: Number(body?.pageInfo?.page ?? 1),
    pageSize: Number(body?.pageInfo?.pageSize ?? items.length),
    total: Number(body?.pageInfo?.total ?? items.length),
  };
  return { items, pageInfo };
}

function normalizeVertical(v: any): Vertical | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;

  const noAccent = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const s = noAccent.trim().toUpperCase();

  if (s === "FOOD") return "FOOD";
  if (s === "MARKET" || s === "MARCHE" || s === "MARCHÉ") return "MARKET";
  if (s === "FASHION") return "FASHION";

  // compat éventuels
  const low = s.toLowerCase();
  if (low === "african-food") return "FOOD";
  if (low === "african-market") return "MARKET";
  if (low === "fashionstyle") return "FASHION";

  return null;
}

function to01(v: any): 0 | 1 | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return 1;
  if (s === "0" || s === "false" || s === "no" || s === "off") return 0;
  return null;
}

function withPageCompat(query: Record<string, any>, page: number, pageSize: number) {
  query.page = page;
  query.pageSize = pageSize;
  query.page_size = pageSize; // compat éventuelle
  return query;
}

/* ---------- Liste des catégories ---------- */
export async function listCategories(opts: {
  page?: number;
  pageSize?: number;
  q?: string;
  onlyActive?: boolean;
  vertical?: Vertical;
} = {}): Promise<Paginated<Category>> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;

  const query: Record<string, any> = {};
  withPageCompat(query, page, pageSize);

  if (opts.q && String(opts.q).trim()) query.q = String(opts.q).trim();

  if (opts.onlyActive === true) query.onlyActive = 1;
  if (opts.onlyActive === false) query.onlyActive = 0;

  const vert = normalizeVertical(opts.vertical);
  if (vert) {
    query.vertical = vert;
    query.v = vert;
  }

  const raw = await api.get<any>("/api/categories", { query });
  return asPaginated<Category>(raw);
}

/* ---------- Création d'une nouvelle catégorie ---------- */
/**
 * ✅ IMPORTANT: ton backend peut avoir categories.vertical NOT NULL
 * => on envoie un vertical par défaut (MARKET) si non fourni.
 */
export async function createCategory(
  payload:
    | { name: string; slug?: string; vertical?: Vertical; is_active?: 0 | 1 | boolean | null }
    | string
): Promise<{ id: number; name: string; slug: string; vertical?: Vertical | null; is_active?: 0 | 1 | null }> {
  const name = typeof payload === "string" ? payload : payload.name;
  const slug = typeof payload === "string" ? undefined : payload.slug;

  const body: Record<string, any> = {
    name: String(name || "").trim(),
  };

  if (slug != null && String(slug).trim()) body.slug = String(slug).trim();

  const vert = typeof payload === "string" ? null : normalizeVertical(payload.vertical);
  body.vertical = vert || "MARKET"; // ✅ default safe

  const act = typeof payload === "string" ? null : to01(payload.is_active);
  if (act != null) body.is_active = act;

  const raw = await api.post<any>("/api/categories", body);
  return unwrap(raw);
}

/* ---------- Update catégorie ---------- */
export async function updateCategory(
  id: number,
  patch: Partial<{ name: string; slug: string; vertical: Vertical; is_active: 0 | 1 | boolean }>
): Promise<{ ok: true }> {
  const body: Record<string, any> = {};

  if (patch.name !== undefined) body.name = String(patch.name || "").trim();
  if (patch.slug !== undefined) body.slug = String(patch.slug || "").trim();

  if (patch.vertical !== undefined) {
    const vert = normalizeVertical(patch.vertical);
    if (vert) body.vertical = vert; // si invalide, on ne l’envoie pas
  }

  if (patch.is_active !== undefined) {
    const act = to01(patch.is_active);
    if (act != null) body.is_active = act;
  }

  const raw = await api.put<any>(`/api/categories/${id}`, body);
  return unwrap<{ ok: true }>(raw);
}

/* ---------- Delete catégorie ---------- */
export async function removeCategory(id: number): Promise<{ ok: true }> {
  const raw = await api.delete<any>(`/api/categories/${id}`);
  return unwrap<{ ok: true }>(raw);
}