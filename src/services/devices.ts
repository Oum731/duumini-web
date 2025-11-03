import { api } from "./http";

export async function registerDevice(push_token: string, provider = "pushy") {
  return api.post<{ ok: true }>("/api/devices", { push_token, provider });
}
