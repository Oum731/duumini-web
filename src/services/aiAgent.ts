// src/services/aiAgent.ts
import { api, type HttpConfig } from "./http";

const AI_TIMEOUT = 180000;

type AiResponse<T> = {
  ok: boolean;
  mode?: string;
  data: T;
};

export function generateWeeklyPlan(
  payload: any = {},
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<AiResponse<any>>("/api/ai/weekly-plan", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

export function generateSocialPosts(
  payload: any = {},
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<AiResponse<any>>("/api/ai/social-posts", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}

export function whatsappReply(
  payload: { message: string; context?: string; language?: string },
  cfg?: Omit<HttpConfig, "method" | "body">
) {
  return api.post<AiResponse<{ text: string }>>("/api/ai/whatsapp-reply", payload, {
    timeout: AI_TIMEOUT,
    ...cfg,
  });
}
