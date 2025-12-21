// src/services/locations.ts
import { api } from "./http";

export async function listCities(q?: string) {
  return api.get<{ items: string[] }>("/api/locations/cities", { query: q ? { q } : {} });
}
export async function addCity(city: string) {
  return api.post<{ ok: true; city: string }>("/api/locations/cities", { city });
}

export async function listCommunes(city: string) {
  return api.get<{ items: string[] }>("/api/locations/communes", { query: { city } });
}
export async function addCommune(city: string, commune: string) {
  return api.post<{ ok: true; city: string; commune: string }>("/api/locations/communes", { city, commune });
}

export async function listQuartiers(city: string, commune: string) {
  return api.get<{ items: string[] }>("/api/locations/quartiers", { query: { city, commune } });
}
export async function addQuartier(city: string, commune: string, quartier: string) {
  return api.post<{ ok: true; city: string; commune: string; quartier: string }>(
    "/api/locations/quartiers",
    { city, commune, quartier }
  );
}
