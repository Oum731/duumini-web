// src/services/auth.ts
const API = (import.meta as any).env?.VITE_API_BASE || "";

export type Role =
  | "MEMBER"
  | "VENDEUR"
  | "FOURNISSEUR"
  | "RESTAURANT"
  | "LIVREUR"
  | "ADMIN";

export type Sexe = "M" | "F" | "AUTRE";
export type CityCode = "CASABLANCA" | "MARRAKECH";

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
  data?: any;
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

  // si /api/user/me les renvoie
  shops?: ShopLite[];
  impersonation?: ImpersonationInfo | null;
};

type LoginRes = {
  access_token: string;
  refresh_token: string;
  user: User;
};

export const STORAGE_KEYS = {
  access: "duumini_access",
  refresh: "duumini_refresh",
  user: "duumini_user",

  // impersonation
  imp_access: "duumini_imp_access",
  imp_meta: "duumini_imp_meta", // JSON { actor_admin_id, impersonate_shop_id }
};

/* =========================
 * Normalisation (align backend)
 * =======================*/
function normalizeRole(r: any): Role {
  const v = (r ?? "").toString().trim().toUpperCase();

  // ADMIN
  if (v === "ADMIN") return "ADMIN";

  // VENDEUR (backend peut renvoyer VENDOR/SELLER/etc.)
  if (
    v === "VENDEUR" ||
    v === "VENDOR" ||
    v === "SELLER" ||
    v === "SHOP" ||
    v === "BOUTIQUE" ||
    v === "STORE"
  ) {
    return "VENDEUR";
  }

  // FOURNISSEUR
  if (v === "FOURNISSEUR" || v === "SUPPLIER" || v === "FOURNISSEUR_PARTNER") return "FOURNISSEUR";

  // RESTAURANT
  if (v === "RESTAURANT") return "RESTAURANT";

  // LIVREUR
  if (v === "LIVREUR" || v === "DELIVERY" || v === "RIDER" || v === "COURIER") return "LIVREUR";

  // fallback
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
  if (!u) return u;
  return {
    ...u,
    role: normalizeRole(u.role),
    sexe: normalizeSexe(u.sexe),
    impersonation: getImpersonationMeta() || u.impersonation || null,
  };
}

/* ===== Helper front: code ville → libellé DB ===== */
export function mapCityCodeToVille(code?: string | null): string | null {
  if (!code) return null;
  const v = code.toString().trim().toUpperCase();
  if (v === "CASABLANCA") return "Casablanca";
  if (v === "MARRAKECH") return "Marrakech";
  return null;
}

/* =========================
 * Impersonation helpers
 * =======================*/
export function isImpersonating(): boolean {
  return !!localStorage.getItem(STORAGE_KEYS.imp_access);
}

export function getImpersonationMeta(): ImpersonationInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.imp_meta);
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  } catch {
    return null;
  }
}

export function startImpersonation(access_token: string, meta: ImpersonationInfo) {
  localStorage.setItem(STORAGE_KEYS.imp_access, access_token);
  localStorage.setItem(STORAGE_KEYS.imp_meta, JSON.stringify(meta || null));
}

export function stopImpersonation() {
  localStorage.removeItem(STORAGE_KEYS.imp_access);
  localStorage.removeItem(STORAGE_KEYS.imp_meta);
}

/* =========================
 * Session helpers
 * =======================*/
export function getAccessToken(): string | null {
  // priorité impersonation
  return localStorage.getItem(STORAGE_KEYS.imp_access) || localStorage.getItem(STORAGE_KEYS.access);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refresh);
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  try {
    const parsed = raw ? (JSON.parse(raw) as User) : null;
    if (!parsed) return null;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
}

export function saveSession(data: LoginRes) {
  // quand on login normal, on sort de l’impersonation
  stopImpersonation();

  localStorage.setItem(STORAGE_KEYS.access, data.access_token);
  localStorage.setItem(STORAGE_KEYS.refresh, data.refresh_token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizeUser(data.user)));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
  localStorage.removeItem(STORAGE_KEYS.user);
  stopImpersonation();
}

function setUserInStorage(user: User) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizeUser(user)));
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error || (err as any)?.message || res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Requête avec Authorization + retry auto sur 401 via /auth/refresh */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retry = true
): Promise<Response> {
  const at = getAccessToken();
  const initHeaders: HeadersInit = (init.headers as HeadersInit) || {};
  const hdrs = new Headers(initHeaders);

  if (at) hdrs.set("Authorization", `Bearer ${at}`);

  // ne force Content-Type que si body string
  if (!hdrs.has("Content-Type") && init.body && typeof init.body === "string") {
    hdrs.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers: hdrs, mode: "cors" });

  if (res.status === 401 && retry) {
    try {
      await refresh();
      return authFetch(input, init, false);
    } catch {
      clearSession();
    }
  }

  return res;
}

/* =========================
 * API calls
 * =======================*/
export async function register(payload: {
  phone: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  sexe?: Sexe | null;
}) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<{ ok: true }>(res);
}

export async function login(phone: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });

  const data = await parseJson<LoginRes>(res);
  saveSession(data);
  return getCurrentUser() as User;
}

export async function logout() {
  try {
    await fetch(`${API}/api/auth/logout`, { method: "POST" });
  } finally {
    clearSession();
  }
}

export async function refresh() {
  const token = getRefreshToken();
  if (!token) throw new Error("No refresh token");

  // si impersonation active, on refresh le token principal uniquement
  const res = await fetch(`${API}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: token }),
  });

  const data = await parseJson<{ access_token: string }>(res);

  // on met à jour le token principal, sans toucher imp_access
  localStorage.setItem(STORAGE_KEYS.access, data.access_token);
  return data.access_token;
}

/**
 * me(): lit depuis la DB, met à jour le storage, et renvoie l’utilisateur normalisé
 */
export async function me(): Promise<User | null> {
  const res = await authFetch(`${API}/api/user/me`);
  const u = await parseJson<User | null>(res);
  if (!u) return null;

  const normalized = normalizeUser(u);
  setUserInStorage(normalized);
  return normalized;
}

export async function updateProfile(payload: Partial<User>) {
  const cleanPayload: any = { ...payload };

  // sécurité: le front ne doit pas envoyer role
  if ("role" in cleanPayload) delete cleanPayload.role;
  if ("impersonation" in cleanPayload) delete cleanPayload.impersonation;
  if ("shops" in cleanPayload) delete cleanPayload.shops;

  const res = await authFetch(`${API}/api/user/me`, {
    method: "PUT",
    body: JSON.stringify(cleanPayload),
    headers: { "Content-Type": "application/json" },
  });

  const user = await parseJson<User>(res);
  const normalized = normalizeUser(user);
  setUserInStorage(normalized);
  return normalized;
}