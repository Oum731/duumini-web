import { api } from "../../services/http";
import { normalizeSuggestionItems } from "./helpers";
import type { ItemsEnvelope, LocationSuggestion } from "./types";

export async function listCommunesByCity(ville?: string, signal?: AbortSignal) {
  const v = String(ville || "").trim();
  if (!v) return [] as LocationSuggestion[];
  const res = await api.get<ItemsEnvelope<any>>("/api/locations/communes", {
    query: { ville: v, limit: 30 },
    // @ts-ignore
    signal,
  });
  return normalizeSuggestionItems(res);
}

export async function listQuartiersByCityCommune(
  ville?: string,
  commune?: string,
  signal?: AbortSignal,
) {
  const v = String(ville || "").trim();
  const c = String(commune || "").trim();
  if (!v || !c) return [] as LocationSuggestion[];
  const res = await api.get<ItemsEnvelope<any>>("/api/locations/quartiers", {
    query: { ville: v, commune: c, limit: 30 },
    // @ts-ignore
    signal,
  });
  return normalizeSuggestionItems(res);
}

export async function trackLocationSuggestion(
  kind: "VILLE" | "COMMUNE" | "QUARTIER",
  payload: { ville?: string; commune?: string; quartier?: string },
) {
  try {
    await api.post("/api/locations/track", { kind, ...payload });
  } catch {}
}
