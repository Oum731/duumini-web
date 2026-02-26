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
  params?: Record<string, any>; // ✅ alias

  /** ✅ AbortController support (pour autocomplete / cancel request) */
  signal?: AbortSignal;

  /** ✅ Ville forcée pour cette requête (override localStorage) */
  city?: string | null;

  /** ✅ Ne pas envoyer la ville sur cette requête */
  noCity?: boolean;
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

/* =========================
 * ✅ API_BASE robuste
 * - Dev: fallback sur origin (vite proxy possible)
 * - Prod: JAMAIS fallback sur www.duumini.com par erreur
 * =======================*/
const ENV_API =
  (import.meta as any).env?.VITE_API_BASE?.toString().trim().replace(/\/+$/, "") ||
  "";

/** ⚠️ Mets ici ton vrai backend prod si VITE_API_BASE n'est pas défini */
const DEFAULT_PROD_API = "https://duumini-api.onrender.com";

function safeDefaultApiBase() {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";

  if (isLocal) return window.location.origin.replace(/\/+$/, "");

  // Prod: fallback sûr vers l'API (pas le front)
  return DEFAULT_PROD_API.replace(/\/+$/, "");
}

export const API_BASE = ENV_API || safeDefaultApiBase();

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
  if (!ctype) return undefined as unknown as T;

  if (ctype.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  return text as T;
}

/** Combine 2 AbortSignals (si le navigateur le supporte) */
function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;

  const controller = new AbortController();
  const anyAbort = () => controller.abort();

  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }

  a.addEventListener("abort", anyAbort, { once: true });
  b.addEventListener("abort", anyAbort, { once: true });

  return controller.signal;
}

/** Fetch avec timeout dédié + support signal externe */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  const mergedSignal = mergeSignals(signal, controller.signal);

  try {
    return await fetch(url, {
      ...init,
      signal: mergedSignal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Lecture safe de la ville globale */
function readCityFromStorage(): string | null {
  try {
    const v = localStorage.getItem("duumini_city");
    const s = String(v || "").trim();
    return s ? s : null;
  } catch {
    return null;
  }
}

/**
 * Client HTTP générique avec retry/refresh auto sur 401
 */
export async function http<T = unknown>(
  path: string,
  config: HttpConfig = {}
): Promise<T> {
  const {
    method = "GET",
    headers = {},
    body,
    query,
    timeout = 20000,
    noAuth = false,
    credentials,
    signal,
    city,     // ✅ override ville
    noCity,   // ✅ désactiver ville
  } = config;

  const hdrs: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  // ✅ Ville globale envoyée automatiquement (sans répétition dans les pages)
  if (!noCity) {
    const cityToSend =
      typeof city !== "undefined" ? (city ? String(city).trim() : null) : readCityFromStorage();

    if (cityToSend) {
      hdrs["X-Duumini-City"] = cityToSend;
    }
  }

  // Auth bearer si token dispo (utilise la même source que auth.ts)
  const token = noAuth ? null : getAccessToken();
  const finalQuery: HttpConfig["query"] = { ...(query || {}) };

  if (token && !hdrs.Authorization) {
    hdrs.Authorization = `Bearer ${token}`;
  }

  const url = buildUrl(path, finalQuery);

  let finalBody: BodyInit | undefined = undefined;
  if (body !== undefined && body !== null) {
    if (isFormData(body)) {
      finalBody = body;
    } else if (typeof body === "string") {
      finalBody = body;
      hdrs["Content-Type"] ||= "application/json";
    } else {
      finalBody = JSON.stringify(body);
      hdrs["Content-Type"] ||= "application/json";
    }
  }

  const makeInit = (): RequestInit => ({
    method,
    headers: hdrs,
    body: finalBody,
    mode: "cors",
    credentials,
  });

  let res: Response;

  try {
    res = await fetchWithTimeout(url, makeInit(), timeout, signal);

    if (res.status === 401 && !noAuth) {
      try {
        await doRefresh();
        const newToken = getAccessToken();
        if (newToken) {
          hdrs.Authorization = `Bearer ${newToken}`;
        }
        res = await fetchWithTimeout(url, makeInit(), timeout, signal);
      } catch {
        clearSession();
      }
    }
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Requête annulée"
        : e?.message || "Erreur réseau";
    throw new HttpError(0, msg);
  }

  if (!res.ok) {
    let payload: HttpErrorPayload | undefined;
    try {
      payload = await parseResponse<HttpErrorPayload>(res);
    } catch {
      /* ignore */
    }
    const msg =
      payload?.error ||
      payload?.message ||
      `HTTP ${res.status} ${res.statusText}`;
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
  post<T = unknown>(
    path: string,
    body?: any,
    cfg?: Omit<HttpConfig, "method" | "body">
  ) {
    return http<T>(path, { ...cfg, method: "POST", body });
  },
  put<T = unknown>(
    path: string,
    body?: any,
    cfg?: Omit<HttpConfig, "method" | "body">
  ) {
    return http<T>(path, { ...cfg, method: "PUT", body });
  },
  patch<T = unknown>(
    path: string,
    body?: any,
    cfg?: Omit<HttpConfig, "method" | "body">
  ) {
    return http<T>(path, { ...cfg, method: "PATCH", body });
  },
  delete<T = unknown>(path: string, cfg?: Omit<HttpConfig, "method" | "body">) {
    return http<T>(path, { ...cfg, method: "DELETE" });
  },

  /** Upload multipart (FormData) */
  upload<T = unknown>(
    path: string,
    form: FormData,
    cfg?: Omit<HttpConfig, "method" | "body" | "headers">
  ) {
    return http<T>(path, { ...cfg, method: "POST", body: form });
  },
};