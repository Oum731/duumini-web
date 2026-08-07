// src/services/users.ts
import { http } from "./http";

export type Role =
  | "MEMBER"
  | "VENDEUR"
  | "FOURNISSEUR"
  | "RESTAURANT"
  | "LIVREUR"
  | "COMMERCIAL"
  | "ADMIN";

export type Sexe = "M" | "F" | "AUTRE";

export type ShopType = "VENDOR" | "SUPPLIER" | "RESTAURANT" | string;

export type ShopLite = {
  id: number;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  owner_id?: number | null;
  shop_type?: ShopType | null;
};

export type ImpersonationInfo = {
  actor_admin_id: number | null;
  impersonate_shop_id: number;
};

export type User = {
  id: number;
  phone: string;
  role: Role;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | null;
  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  sexe?: Sexe | null;
  created_at?: string | null;

  // (si ton backend /api/user/me ou /api/user renvoie)
  shops?: ShopLite[];
  impersonation?: ImpersonationInfo | null;

  // compat éventuelle si ton backend renvoie autre chose
  data?: any;
};

export type PageInfo = { page: number; pageSize: number; total: number };
export type Paged<T> = { items: T[]; pageInfo: PageInfo };

/* =========================
 * Normalisation (align auth.ts)
 * ======================= */

function normalizeRole(r: any): Role {
  const v = (r ?? "").toString().trim().toUpperCase();
  if (v === "ADMIN") return "ADMIN";
  if (v === "VENDEUR") return "VENDEUR";
  if (v === "FOURNISSEUR") return "FOURNISSEUR";
  if (v === "RESTAURANT") return "RESTAURANT";
  if (v === "LIVREUR") return "LIVREUR";
  if (v === "COMMERCIAL") return "COMMERCIAL";
  return "MEMBER";
}

function normalizeSexe(s: any): Sexe | null {
  if (s == null || s === "") return null;
  const v = String(s).trim().toUpperCase();
  if (v === "M") return "M";
  if (v === "F") return "F";
  if (v === "AUTRE") return "AUTRE";
  return null;
}

function normalizeUser(u: any): User {
  const base = (u || {}) as any;
  return {
    ...base,
    id: Number(base.id),
    phone: String(base.phone ?? ""),
    role: normalizeRole(base.role),
    sexe: normalizeSexe(base.sexe),
    shops: Array.isArray(base.shops) ? base.shops : base.shops ? [base.shops] : base.shops ?? undefined,
    impersonation: base.impersonation ?? null,
  };
}

function asPagedUsers(x: any): Paged<User> {
  const body = x && typeof x === "object" && "data" in x ? (x as any).data : x;

  const itemsRaw: any[] =
    Array.isArray(body?.items) ? body.items :
    Array.isArray(body?.data) ? body.data :
    Array.isArray(body?.rows) ? body.rows :
    Array.isArray(body) ? body :
    [];

  const items = (itemsRaw || []).map(normalizeUser);

  const pageInfo = {
    page: Number(body?.pageInfo?.page ?? 1),
    pageSize: Number(body?.pageInfo?.pageSize ?? items.length),
    total: Number(body?.pageInfo?.total ?? items.length),
  };

  return { items, pageInfo };
}

/* =========================
 * API
 * ======================= */

export async function getMe(): Promise<User | null> {
  const raw = await http<User | null | any>("/api/user/me", { method: "GET" });
  if (!raw) return null;
  return normalizeUser(raw);
}

export async function listUsers(params?: {
  page?: number;
  pageSize?: number;
  q?: string | null;
}): Promise<Paged<User>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const q = params?.q ?? null;

  // ✅ compat: pageSize + page_size
  const raw = await http<any>("/api/user", {
    method: "GET",
    query: {
      page,
      pageSize,
      page_size: pageSize,
      q: q || undefined,
    },
  });

  return asPagedUsers(raw);
}

export async function createUser(payload: {
  phone: string;
  password: string;
  first_name: string | null;
  last_name: string | null;
  role: Role;
}) {
  // ✅ on normalise le role envoyé
  const body = { ...payload, role: normalizeRole(payload.role) };

  const raw = await http<any>("/api/user", {
    method: "POST",
    body,
  });

  // certains backends renvoient {ok:true} ou l'user
  if (raw && typeof raw === "object" && "id" in raw) return normalizeUser(raw);
  if (raw?.data && "id" in raw.data) return normalizeUser(raw.data);
  return raw as { ok: true };
}

/** Edition des champs (admin) */
export async function updateUser(
  id: number,
  payload: {
    phone: string;
    first_name: string | null;
    last_name: string | null;
    ville?: string | null;
    commune?: string | null;
    quartier?: string | null;
    sexe?: Sexe | null;
    role?: Role; // optionnel si ton backend autorise
  }
) {
  const body: any = { ...payload };

  if ("role" in body && body.role != null) body.role = normalizeRole(body.role);
  if ("sexe" in body) body.sexe = normalizeSexe(body.sexe);

  const raw = await http<any>(`/api/user/${id}`, {
    method: "PUT",
    body,
  });

  return normalizeUser(raw);
}

/** Changer UNIQUEMENT le rôle */
export async function changeUserRole(id: number, role: Role) {
  const raw = await http<any>(`/api/user/${id}/role`, {
    method: "PATCH",
    body: { role: normalizeRole(role) },
  });

  return normalizeUser(raw);
}

export async function removeUser(id: number) {
  return http<{ ok: true }>(`/api/user/${id}`, { method: "DELETE" });
}