// src/services/aiAgent.ts
import { api, type HttpConfig } from "./http";

/**
 * Timeout IA (OpenAI) : parfois > 60s
 * 180s = confortable pour Render + OpenAI
 */
const AI_TIMEOUT = 180000;

export function generateWeeklyPlan(
  payload: any = {},
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<any>("/api/ai/weekly-plan", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

export function generateSocialPosts(
  payload: any = {},
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<any>("/api/ai/social-posts", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

export function whatsappReply(
  payload: { message: string; context?: string; language?: string },
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<any>("/api/ai/whatsapp-reply", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}
