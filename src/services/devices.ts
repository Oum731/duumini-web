// src/services/devices.ts
import { api } from "./http";

export async function registerDevice(push_token: string, provider = "pushy") {
  if (!push_token) return { data: { ok: true } } as any;
  return api.post<{ ok: true }>("/api/devices", { push_token, provider });
}

export async function unregisterDevice(push_token?: string, provider = "pushy") {
  return api.post<{ ok: true }>("/api/devices/unregister", {
    push_token: push_token || undefined,
    provider,
  });
}