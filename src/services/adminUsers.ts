// src/services/adminUsers.ts
import { api } from "./http";

export type AdminUser = {
  id: number; // ✅ user id, ou 0 si guest

  phone?: string | null;
  role?: string | null;

  first_name?: string | null;
  last_name?: string | null;

  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  sexe?: string | null;

  avatar?: string | null;
  is_active?: 0 | 1 | null;

  created_at?: string | null;
  updated_at?: string | null;

  // ✅ flags (backend: 0/1)
  has_account?: boolean | 0 | 1;
  from_orders?: boolean | 0 | 1;

  orders_count?: number | null;
};

export type PageInfo = {
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: PageInfo;
};

export type ListAdminUsersOptions = {
  page?: number;
  pageSize?: number;

  q?: string;
  role?: string; // "MEMBER" | "ADMIN" | "GUEST" | ...
  is_active?: 0 | 1 | "ALL";

  include_orders?: boolean; // ✅ users + guests
};

function cleanString(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function normalizePhoneKey(phone?: string | null) {
  return String(phone || "").trim().replace(/\s+/g, "");
}

/** GET /api/admin/users */
export async function listAdminUsers(opts: ListAdminUsersOptions = {}) {
  const page = Math.max(1, toInt(opts.page, 1) || 1);
  const pageSize = Math.max(1, toInt(opts.pageSize, 50) || 50);

  const query: Record<string, any> = { page, pageSize };

  const q = cleanString(opts.q);
  if (q) query.q = q;

  const role = cleanString(opts.role).toUpperCase();
  if (role && role !== "ALL") query.role = role;

  const act = opts.is_active;
  if (act === 0 || act === 1) query.is_active = act;

  if (typeof opts.include_orders === "boolean") {
    query.include_orders = opts.include_orders ? 1 : 0;
  }

  return api.get<Paginated<AdminUser>>("/api/admin/users", { query } as any);
}

/**
 * ✅ helper: récupère "tous" les users (pagination)
 * - utile pour picker client (scrollable)
 * - include_orders=true => inclut aussi les guests
 */
export async function listAllAdminUsers(
  opts: Omit<ListAdminUsersOptions, "page"> = {}
) {
  const pageSize = Math.min(2000, Math.max(1, toInt(opts.pageSize, 2000)));
  let page = 1;

  const all: AdminUser[] = [];
  let totalExpected = Infinity;

  while (page <= 1000) {
    const res = await listAdminUsers({ ...opts, page, pageSize });

    const items = (res.items || []) as AdminUser[];
    all.push(...items);

    const total = Number(res.pageInfo?.total ?? all.length);
    if (Number.isFinite(total)) totalExpected = total;

    if (all.length >= totalExpected) break;
    if (items.length === 0) break;

    page += 1;
  }

  // de-dupe: si id>0 => par id, sinon guest => par phone
  // priorité: user > guest (si même phone)
  const map = new Map<string, AdminUser>();

  for (const u of all) {
    const id = Number(u.id || 0);
    const phone = normalizePhoneKey(u.phone);
    const key = id > 0 ? `U:${id}` : phone ? `P:${phone}` : `X:${Math.random()}`;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, u);
      continue;
    }

    const prevIsUser = Number(prev.id || 0) > 0;
    const curIsUser = id > 0;

    // keep user
    if (prevIsUser && !curIsUser) continue;
    if (!prevIsUser && curIsUser) {
      map.set(key, u);
      continue;
    }

    // sinon garder le premier (stable)
  }

  return Array.from(map.values());
}
/** Client léger (id + coordonnées) — GET /api/user/search-clients,
 * accessible aux COMMERCIAL (pas seulement ADMIN, contrairement à
 * listAdminUsers/listAllAdminUsers ci-dessus). Sert à retrouver un
 * client déjà existant avant de déclarer une vente, pour ne jamais
 * créer de doublon de compte. */
export type ClientSearchResult = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  city: string | null;
  commune: string | null;
  district: string | null;
};

/** q vide (ou omis) -> liste complète des clients (jusqu'à 2000), comme
 * listAllAdminUsers({pageSize:2000}) côté admin — à charger une fois puis
 * filtrer localement (voir CommercialHome.tsx). q renseigné -> filtre déjà
 * appliqué côté serveur (nom/téléphone), pour un usage ciblé éventuel. */
export async function searchClients(q: string = "") {
  const query = q.trim();
  return api.get<{ items: ClientSearchResult[] }>(
    `/api/user/search-clients${query ? `?q=${encodeURIComponent(query)}` : ""}`
  );
}
