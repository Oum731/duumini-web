import { useRef } from "react";
import { api } from "../../../services/http";
import { normKey, titleCase, uniqSorted, normalizeItems } from "../helpers/strings";

/* =========================
 * Locations API (production)
 * - caching (Map)
 * - abort in-flight requests
 * ========================= */
export function useLocationsApi() {
  const citiesCache = useRef<Map<string, string[]>>(new Map());
  const communesCache = useRef<Map<string, string[]>>(new Map());
  const quartiersCache = useRef<Map<string, string[]>>(new Map());

  const inFlight = useRef<{
    cities?: AbortController | null;
    communes?: AbortController | null;
    quartiers?: AbortController | null;
  }>({});

  function abort(kind: "cities" | "communes" | "quartiers") {
    try {
      inFlight.current[kind]?.abort();
    } catch {}
    inFlight.current[kind] = null;
  }

  async function listCities(q: string) {
    const key = normKey(q || "");
    if (citiesCache.current.has(key)) return citiesCache.current.get(key)!;

    abort("cities");
    const ac = new AbortController();
    inFlight.current.cities = ac;

    const res = await api.get<any>("/api/locations/cities", {
      query: q ? { q } : undefined,
      signal: ac.signal as any,
    });

    const items = uniqSorted(normalizeItems(res));
    citiesCache.current.set(key, items);
    return items;
  }

  async function listCommunes(city: string) {
    const c = titleCase(city);
    const key = normKey(c);
    if (!c) return [];
    if (communesCache.current.has(key)) return communesCache.current.get(key)!;

    abort("communes");
    const ac = new AbortController();
    inFlight.current.communes = ac;

    const res = await api.get<any>("/api/locations/communes", {
      query: { city: c },
      signal: ac.signal as any,
    });

    const items = uniqSorted(normalizeItems(res));
    communesCache.current.set(key, items);
    return items;
  }

  async function listQuartiers(city: string, commune: string) {
    const c = titleCase(city);
    const m = titleCase(commune);
    if (!c || !m) return [];
    const key = `${normKey(c)}||${normKey(m)}`;
    if (quartiersCache.current.has(key))
      return quartiersCache.current.get(key)!;

    abort("quartiers");
    const ac = new AbortController();
    inFlight.current.quartiers = ac;

    const res = await api.get<any>("/api/locations/quartiers", {
      query: { city: c, commune: m },
      signal: ac.signal as any,
    });

    const items = uniqSorted(normalizeItems(res));
    quartiersCache.current.set(key, items);
    return items;
  }

  async function addCity(city: string) {
    const c = titleCase(city);
    if (!c) return;
    try {
      await api.post("/api/locations/cities", { city: c });
      citiesCache.current.delete("");
    } catch {}
  }

  async function addCommune(city: string, commune: string) {
    const c = titleCase(city);
    const m = titleCase(commune);
    if (!c || !m) return;
    try {
      await api.post("/api/locations/communes", { city: c, commune: m });
      communesCache.current.delete(normKey(c));
    } catch {}
  }

  async function addQuartier(city: string, commune: string, quartier: string) {
    const c = titleCase(city);
    const m = titleCase(commune);
    const q = titleCase(quartier);
    if (!c || !m || !q) return;
    try {
      await api.post("/api/locations/quartiers", {
        city: c,
        commune: m,
        quartier: q,
      });
      quartiersCache.current.delete(`${normKey(c)}||${normKey(m)}`);
    } catch {}
  }

  return {
    listCities,
    listCommunes,
    listQuartiers,
    addCity,
    addCommune,
    addQuartier,
  };
}
