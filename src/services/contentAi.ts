// src/services/contentAi.ts
import { api } from "./http";

/* =========================
 * Types
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
  return api.get<{ ok: boolean; items: ContentListItem[] }>(
    `/api/admin/content-ai`,
    {
      credentials: "include",
      query: {
        status: opts.status || undefined,
        type: opts.type || undefined,
        lang: opts.lang || undefined,
        q: opts.q?.trim() ? opts.q.trim() : undefined,
        limit: opts.limit ?? 80,
        offset: opts.offset ?? 0,
      },
    }
  );
}

export function getContentAi(id: number) {
  return api.get<{ ok: boolean; item: ContentItem }>(`/api/admin/content-ai/${id}`, {
    credentials: "include",
  });
}

export function getContentAiVersions(id: number) {
  return api.get<{ ok: boolean; versions: VersionRow[] }>(
    `/api/admin/content-ai/${id}/versions`,
    { credentials: "include" }
  );
}

export function publishContentAi(id: number) {
  return api.post<{ ok: boolean }>(`/api/admin/content-ai/${id}/publish`, {}, {
    credentials: "include",
  });
}

export function unpublishContentAi(id: number) {
  return api.post<{ ok: boolean }>(`/api/admin/content-ai/${id}/unpublish`, {}, {
    credentials: "include",
  });
}

export function rollbackContentAi(id: number, versionId: number) {
  return api.post<{ ok: boolean }>(
    `/api/admin/content-ai/${id}/rollback`,
    { version_id: versionId },
    { credentials: "include" }
  );
}

/**
 * Optimisation SEO backend-only (ta route IA)
 * POST /api/ai/seo/optimize-page
 * Timeout élevé (comme aiAds.ts) : la génération OpenAI peut dépasser
 * les 20s par défaut du client HTTP, ce qui abort la requête côté client
 * ("signal is aborted without reason") même quand le backend répond bien.
 */
export function optimizeSeoDraft(payload: {
  slug: string;
  lang: string;
  type: string;
  current?: any;
}) {
  return api.post<{ ok: boolean; draft: { id: number }; preview: any }>(
    `/api/ai/seo/optimize-page`,
    payload,
    { credentials: "include", timeout: 180000 }
  );
}
