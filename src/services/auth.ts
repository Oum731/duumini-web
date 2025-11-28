// src/services/auth.ts
const API = (import.meta as any).env?.VITE_API_BASE || "";

export type Role = "MEMBER" | "VENDEUR" | "LIVREUR" | "ADMIN";
export type Sexe = "M" | "F" | "AUTRE";
export type CityCode = "CASABLANCA" | "MARRAKECH";

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
};

/* ===== Normalisation stricte (DB source of truth) ===== */
function normalizeRole(r: any): Role {
  const v = (r ?? "").toString().trim().toUpperCase();
  if (v === "ADMIN") return "ADMIN";
  if (v === "VENDEUR") return "VENDEUR";
  if (v === "LIVREUR") return "LIVREUR";
  return "MEMBER";
}

/* ===== Helper front: code ville → libellé DB ===== */
export function mapCityCodeToVille(code?: string | null): string | null {
  if (!code) return null;
  const v = code.toString().trim().toUpperCase();
  if (v === "CASABLANCA") return "Casablanca";
  if (v === "MARRAKECH") return "Marrakech";
  return null;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.access);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refresh);
}
export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  try {
    const parsed = raw ? (JSON.parse(raw) as User) : null;
    return parsed ? { ...parsed, role: normalizeRole(parsed.role) } : null;
  } catch {
    return null;
  }
}
export function saveSession(data: LoginRes) {
  const normalizedUser: User = {
    ...data.user,
    role: normalizeRole(data.user.role),
  };
  localStorage.setItem(STORAGE_KEYS.access, data.access_token);
  localStorage.setItem(STORAGE_KEYS.refresh, data.refresh_token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizedUser));
}
export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
  localStorage.removeItem(STORAGE_KEYS.user);
}
function setUserInStorage(user: User) {
  const normalized = { ...user, role: normalizeRole(user.role) } as User;
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalized));
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error || res.statusText);
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
 * ========================= */

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
  saveSession({ ...data, user: { ...data.user, role: normalizeRole(data.user.role) } });
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
  const res = await fetch(`${API}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: token }),
  });
  const data = await parseJson<{ access_token: string }>(res);
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
  const normalized = { ...u, role: normalizeRole(u.role) } as User;
  setUserInStorage(normalized);
  return normalized;
}

export async function updateProfile(payload: Partial<User>) {
  const res = await authFetch(`${API}/api/user/me`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  const user = await parseJson<User>(res);
  const normalized = { ...user, role: normalizeRole(user.role) } as User;
  setUserInStorage(normalized);
  return normalized;
}
