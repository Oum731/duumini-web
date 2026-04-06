import { API_BASE } from "./http";

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
  shops?: ShopLite[];
  impersonation?: ImpersonationInfo | null;
};

type LoginRes = {
  access_token: string;
  refresh_token: string;
  user: User;
};

const API = API_BASE;

export const STORAGE_KEYS = {
  access: "duumini_access",
  refresh: "duumini_refresh",
  user: "duumini_user",
  imp_access: "duumini_imp_access",
  imp_meta: "duumini_imp_meta",
};

function normalizeRole(r: any): Role {
  const v = (r ?? "").toString().trim().toUpperCase();

  if (v === "ADMIN") return "ADMIN";

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

  if (
    v === "FOURNISSEUR" ||
    v === "SUPPLIER" ||
    v === "FOURNISSEUR_PARTNER"
  ) {
    return "FOURNISSEUR";
  }

  if (v === "RESTAURANT") return "RESTAURANT";

  if (
    v === "LIVREUR" ||
    v === "DELIVERY" ||
    v === "RIDER" ||
    v === "COURIER"
  ) {
    return "LIVREUR";
  }

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

export function normalizePhone(phone: string): string {
  let raw = String(phone || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "");

  if (!raw) return "";

  if (raw.startsWith("00")) {
    raw = "+" + raw.slice(2);
  }

  if (/^0\d{9}$/.test(raw)) {
    raw = "+212" + raw.slice(1);
  }

  if (/^212\d{9}$/.test(raw)) {
    raw = "+" + raw;
  }

  if (!raw.startsWith("+")) {
    raw = "+" + raw;
  }

  return raw;
}

export function getImpersonationMeta(): ImpersonationInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.imp_meta);
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  } catch {
    return null;
  }
}

function normalizeUser(u: any): User {
  if (!u) return u;
  return {
    ...u,
    phone: normalizePhone(String(u.phone || "")),
    role: normalizeRole(u.role),
    sexe: normalizeSexe(u.sexe),
    impersonation: getImpersonationMeta() || u.impersonation || null,
  };
}

export function mapCityCodeToVille(code?: string | null): string | null {
  if (!code) return null;
  const v = code.toString().trim().toUpperCase();
  if (v === "CASABLANCA") return "Casablanca";
  if (v === "MARRAKECH") return "Marrakech";
  return null;
}

export function isImpersonating(): boolean {
  return !!localStorage.getItem(STORAGE_KEYS.imp_access);
}

export function startImpersonation(
  access_token: string,
  meta: ImpersonationInfo
) {
  localStorage.setItem(STORAGE_KEYS.imp_access, access_token);
  localStorage.setItem(STORAGE_KEYS.imp_meta, JSON.stringify(meta || null));
}

export function stopImpersonation() {
  localStorage.removeItem(STORAGE_KEYS.imp_access);
  localStorage.removeItem(STORAGE_KEYS.imp_meta);
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.imp_access) ||
    localStorage.getItem(STORAGE_KEYS.access)
  );
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
  stopImpersonation();
  localStorage.setItem(STORAGE_KEYS.access, data.access_token);
  localStorage.setItem(STORAGE_KEYS.refresh, data.refresh_token);
  localStorage.setItem(
    STORAGE_KEYS.user,
    JSON.stringify(normalizeUser(data.user))
  );
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
    throw new Error(
      (err as any)?.error || (err as any)?.message || res.statusText
    );
  }
  return res.json() as Promise<T>;
}

let refreshPromise: Promise<string> | null = null;

export async function refresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const token = getRefreshToken();
    if (!token) {
      clearSession();
      throw new Error("No refresh token");
    }

    const res = await fetch(`${API}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
      mode: "cors",
      credentials: "include",
    });

    if (!res.ok) {
      clearSession();
      throw new Error("Refresh failed");
    }

    const data = await res.json().catch(() => null);

    if (!data?.access_token) {
      clearSession();
      throw new Error("Invalid refresh response");
    }

    localStorage.setItem(STORAGE_KEYS.access, data.access_token);
    return data.access_token as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retry = true
): Promise<Response> {
  const initHeaders: HeadersInit = (init.headers as HeadersInit) || {};
  const hdrs = new Headers(initHeaders);

  const at = getAccessToken();
  if (at) hdrs.set("Authorization", `Bearer ${at}`);

  if (!hdrs.has("Content-Type") && init.body && typeof init.body === "string") {
    hdrs.set("Content-Type", "application/json");
  }

  let res = await fetch(input, {
    ...init,
    headers: hdrs,
    mode: "cors",
    credentials: init.credentials || "include",
  });

  if (res.status === 401 && retry) {
    try {
      const newToken = await refresh();

      const retryHeaders = new Headers(initHeaders);
      if (newToken) retryHeaders.set("Authorization", `Bearer ${newToken}`);

      if (
        !retryHeaders.has("Content-Type") &&
        init.body &&
        typeof init.body === "string"
      ) {
        retryHeaders.set("Content-Type", "application/json");
      }

      res = await fetch(input, {
        ...init,
        headers: retryHeaders,
        mode: "cors",
        credentials: init.credentials || "include",
      });
    } catch {
      clearSession();
      throw new Error("Session expirée");
    }
  }

  if (res.status === 401) {
    clearSession();
    throw new Error("Session expirée");
  }

  return res;
}

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
  const cleanPayload = {
    ...payload,
    phone: normalizePhone(payload.phone),
  };

  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanPayload),
    mode: "cors",
    credentials: "include",
  });

  return parseJson<{ ok: true }>(res);
}

export async function login(phone: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: normalizePhone(phone),
      password,
    }),
    mode: "cors",
    credentials: "include",
  });

  const data = await parseJson<LoginRes>(res);
  saveSession(data);
  return getCurrentUser() as User;
}

export async function logout() {
  try {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      mode: "cors",
      credentials: "include",
    });
  } finally {
    clearSession();
  }
}

export async function me(): Promise<User | null> {
  try {
    const res = await authFetch(`${API}/api/user/me`);
    const u = await parseJson<User | null>(res);

    if (!u) {
      clearSession();
      return null;
    }

    const normalized = normalizeUser(u);
    setUserInStorage(normalized);
    return normalized;
  } catch {
    clearSession();
    return null;
  }
}

export async function updateProfile(payload: Partial<User>) {
  const cleanPayload: any = { ...payload };

  if ("role" in cleanPayload) delete cleanPayload.role;
  if ("impersonation" in cleanPayload) delete cleanPayload.impersonation;
  if ("shops" in cleanPayload) delete cleanPayload.shops;
  if ("phone" in cleanPayload && cleanPayload.phone != null) {
    cleanPayload.phone = normalizePhone(String(cleanPayload.phone));
  }

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

export async function changePassword(
  current_password: string,
  new_password: string
) {
  const res = await authFetch(`${API}/api/auth/change-password`, {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
    headers: { "Content-Type": "application/json" },
  });

  return parseJson<{ ok: true; message: string }>(res);
}

export async function adminResetDefaultPassword(userId: number) {
  const res = await authFetch(
    `${API}/api/auth/admin-reset-default-password/${userId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  return parseJson<{
    ok: true;
    user_id: number;
    login_phone: string;
    default_password: string;
    message: string;
  }>(res);
}