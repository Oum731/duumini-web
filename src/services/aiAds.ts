// src/services/aiAds.ts
import { api, type HttpConfig } from "./http";

/**
 * Timeout IA + APIs externes (Meta Graph) :
 * build/publish peuvent être lents => 180s
 */
const AI_TIMEOUT = 180000;

/* =========================
 * META (build -> publish)
 * =======================*/

export type MetaBuildPayload = {
  objective?: string;
  offer?: string;
  url?: string;
  audience?: string;
  daily_budget_mad?: number;
  days?: number;
  city_focus?: string;
};

export type MetaBuildResponse = {
  ok: true;
  mode?: string;
  draft_id: string;
  preview: {
    campaign: any;
    adset: any;
    creative: any;
  };
};

export function buildMetaCampaign(
  payload: MetaBuildPayload = {},
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<MetaBuildResponse>("/api/ads/meta/build", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

export type MetaPublishPayload = {
  draft_id: string;
  activate?: boolean; // si mode AUTO, active si true
};

export type MetaPublishResponse = {
  ok: true;
  mode?: string;
  activated?: boolean;
  campaign?: { id: string };
  adset?: { id: string };
  creative?: { id: string };
  ad?: { id: string; status?: string };
  preview?: any;
};

export function publishMetaCampaign(
  payload: MetaPublishPayload,
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<MetaPublishResponse>("/api/ads/meta/publish", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

/* =========================
 * GOOGLE (build -> export CSV)
 * =======================*/

export type GoogleBuildPayload = {
  objective?: string;
  offer?: string;
  url?: string;
  audience?: string;
  variants?: number;
  city_focus?: string;
};

export type GoogleBuildResponse = {
  ok: true;
  mode?: string;
  draft_id: string;
  preview: any;
};

export function buildGoogleCampaign(
  payload: GoogleBuildPayload = {},
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<GoogleBuildResponse>("/api/ads/google/build", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

/**
 * Retourne juste l'URL d'export CSV.
 * Important: si ton API est sur un autre domaine (duumini-api.onrender.com),
 * construis l'URL complète côté front avec API_BASE.
 */
export function exportGoogleCsvUrl(draft_id: string) {
  return `/api/ads/google/export?draft_id=${encodeURIComponent(draft_id)}`;
}
