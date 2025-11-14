// src/services/devices.ts
import { api } from "./http";

export async function registerDevice(push_token: string, provider = "pushy") {
  return api.post<{ ok: true }>("/api/devices", { push_token, provider });
}

export async function unregisterDevice(push_token?: string, provider = "pushy") {
  // Si push_token est omis, l'API supprimera tous les devices de ce provider pour l'user
  return api.post<{ ok: true }>("/api/devices/unregister", {
    push_token,
    provider,
  });
}
