// src/services/contentAi.ts
import { API_BASE } from "./http";
import { getAccessToken } from "./auth";

/* =========================
 * Types (alignés sur ta page)
 * =======================*/
export type ContentStatus = "draft" | "published" | "archived";
export type ContentType = "page" | "city_page" | string;

export type ContentListItem = {
  id: number;
  type: ContentType;
  slug: string;
  lang: string;
  status: ContentStatus;
  score?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

export type ContentItem = ContentListItem & {
  data?: any;
};

export type VersionRow = {
  id: number;
  content_item_id: number;
  score_before?: number | null;
  score_after?: number | null;
  reason?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

function authHeaders(): Record<string, string> {
  const t = getAccessToken();
  if (!t) return {};
  return { Authorization: `Bearer ${t}`, "x-access-token": t };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.details || data?.error || `GET ${path} failed`);
  return data as T;
}

async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.details || data?.error || `POST ${path} failed`);
  return data as T;
}

/* =========================
 * API: Content AI Admin
 * =======================*/
export function listContentAi(opts: {
  status?: ContentStatus | "";
  type?: ContentType | "";
  lang?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  if (opts.type) qs.set("type", opts.type);
  if (opts.lang) qs.set("lang", opts.lang);
  if (opts.q?.trim()) qs.set("q", opts.q.trim());
  qs.set("limit", String(opts.limit ?? 80));
  qs.set("offset", String(opts.offset ?? 0));

  return apiGet<{ ok: boolean; items: ContentListItem[] }>(`/api/admin/content-ai?${qs.toString()}`);
}

export function getContentAi(id: number) {
  return apiGet<{ ok: boolean; item: ContentItem }>(`/api/admin/content-ai/${id}`);
}

export function getContentAiVersions(id: number) {
  return apiGet<{ ok: boolean; versions: VersionRow[] }>(`/api/admin/content-ai/${id}/versions`);
}

export function publishContentAi(id: number) {
  return apiPost<{ ok: boolean }>(`/api/admin/content-ai/${id}/publish`);
}

export function unpublishContentAi(id: number) {
  return apiPost<{ ok: boolean }>(`/api/admin/content-ai/${id}/unpublish`);
}

export function rollbackContentAi(id: number, versionId: number) {
  return apiPost<{ ok: boolean }>(`/api/admin/content-ai/${id}/rollback`, { version_id: versionId });
}

/**
 * Optimisation SEO backend-only (ta route IA)
 * POST /api/ai/seo/optimize-page
 */
export function optimizeSeoDraft(payload: {
  slug: string;
  lang: string;
  type: string;
  current?: any;
}) {
  return apiPost<{ ok: boolean; draft: { id: number }; preview: any }>(
    `/api/ai/seo/optimize-page`,
    payload
  );
}
