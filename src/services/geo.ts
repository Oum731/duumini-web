// src/services/geo.ts
import { api } from "./http";

export type GeoIpResponse = {
  city?: string | null;
  country?: string | null;
  region?: string | null;
  source?: "ip" | "unknown";
};

export async function geoByIp(): Promise<GeoIpResponse> {
  // ✅ backend: GET /api/geo/ip
  return api.get<GeoIpResponse>("/api/geo/ip", { noAuth: true });
}