// src/services/http.ts
import { refresh as doRefresh, getAccessToken, clearSession } from "./auth";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpConfig = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  /** Corps de requête (objets -> JSON.stringify, FormData gardé tel quel) */
  body?: any;
  /** Paramètres de requête (ajoutés à l'URL) */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Timeout en ms (par défaut 20s) */
  timeout?: number;
  /** Forcer no-auth même si un token existe */
  noAuth?: boolean;
  /** Inclure cookies (si besoin) */
  credentials?: RequestCredentials;
};

export type HttpErrorPayload = {
  error?: string;
  message?: string;
  code?: string | number;
  [k: string]: any;
};

export class HttpError extends Error {
  status: number;
  payload?: HttpErrorPayload;
  constructor(status: number, message: string, payload?: HttpErrorPayload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

/** Base URL (en .env Vite : VITE_API_BASE=https://duumini-api.onrender.com) */
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE?.toString().replace(/\/+$/, "") ||
  window.location.origin.replace(/\/+$/, "");

/** Construit l'URL absolue + query params */
function buildUrl(path: string, query?: HttpConfig["query"]): string {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(API_BASE + (path.startsWith("/") ? path : `/${path}`));

  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/** Détermine si le body est du FormData */
function isFormData(x: any): x is FormData {
  return typeof FormData !== "undefined" && x instanceof FormData;
}

/** Parse la réponse selon le Content-Type */
async function parseResponse<T>(res: Response): Promise<T> {
  const ctype = res.headers.get("content-type") || "";
  if (!ctype) {
    return undefined as unknown as T;
  }
  if (ctype.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  return text as T;
}

/**
 * Client HTTP générique avec retry/refresh auto sur 401
 */
export async function http<T = unknown>(path: string, config: HttpConfig = {}): Promise<T> {
  const {
    method = "GET",
    headers = {},
    body,
    query,
    timeout = 20000,
    noAuth = false,
    credentials,
  } = config;

  const hdrs: Record<string, string> = { Accept: "application/json", ...headers };

  // Auth bearer si token dispo (utilise la même source que auth.ts)
  const token = noAuth ? null : getAccessToken();
  const finalQuery: HttpConfig["query"] = { ...(query || {}) };

  if (token) {
    if (!hdrs.Authorization) hdrs.Authorization = `Bearer ${token}`;
  }

  const url = buildUrl(path, finalQuery);

  let finalBody: BodyInit | undefined = undefined;
  if (body !== undefined && body !== null) {
    if (isFormData(body)) {
      finalBody = body; // ne pas ajouter content-type
    } else if (typeof body === "string") {
      finalBody = body;
      hdrs["Content-Type"] ||= "application/json";
    } else {
      finalBody = JSON.stringify(body);
      hdrs["Content-Type"] ||= "application/json";
    }
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  async function doFetch() {
    return fetch(url, {
      method,
      headers: hdrs,
      body: finalBody,
      signal: controller.signal,
      mode: "cors",
      credentials, // "include" si tu utilises des cookies côté API
    });
  }

  let res: Response | null = null;
  try {
    res = await doFetch();

    // 🔁 Si 401 et on n’était pas en noAuth → tente un refresh 1 fois
    if (res.status === 401 && !noAuth) {
      try {
        await doRefresh(); // met à jour le token dans localStorage
        const newToken = getAccessToken();
        if (newToken) {
          (hdrs as any).Authorization = `Bearer ${newToken}`;
        }
        res = await doFetch(); // re-tente
      } catch {
        clearSession(); // on nettoie la session si refresh KO
      }
    }
  } catch (e: any) {
    clearTimeout(t);
    const msg = e?.name === "AbortError" ? "Requête annulée (timeout)" : e?.message || "Erreur réseau";
    throw new HttpError(0, msg);
  } finally {
    clearTimeout(t);
  }

  if (!res) {
    throw new HttpError(0, "Aucune réponse du serveur");
  }

  if (!res.ok) {
    let payload: HttpErrorPayload | undefined;
    try {
      payload = await parseResponse<HttpErrorPayload>(res);
    } catch { /* ignore */ }
    const msg = payload?.error || payload?.message || `HTTP ${res.status} ${res.statusText}`;
    throw new HttpError(res.status, msg, payload);
  }

  return parseResponse<T>(res);
}

/* ===========================
 * Helpers pratiques (api.*)
 * =========================== */
export const api = {
  get<T = unknown>(path: string, cfg?: Omit<HttpConfig, "method" | "body">) {
    return http<T>(path, { ...cfg, method: "GET" });
  },
  post<T = unknown>(path: string, body?: any, cfg?: Omit<HttpConfig, "method" | "body">) {
    return http<T>(path, { ...cfg, method: "POST", body });
  },
  put<T = unknown>(path: string, body?: any, cfg?: Omit<HttpConfig, "method" | "body">) {
    return http<T>(path, { ...cfg, method: "PUT", body });
  },
  patch<T = unknown>(path: string, body?: any, cfg?: Omit<HttpConfig, "method" | "body">) {
    return http<T>(path, { ...cfg, method: "PATCH", body });
  },
  delete<T = unknown>(path: string, cfg?: Omit<HttpConfig, "method" | "body">) {
    return http<T>(path, { ...cfg, method: "DELETE" });
  },

  /** Upload multipart (FormData) */
  async upload<T = unknown>(path: string, form: FormData, cfg?: Omit<HttpConfig, "method" | "body" | "headers">) {
    return http<T>(path, { ...cfg, method: "POST", body: form });
  },
};
