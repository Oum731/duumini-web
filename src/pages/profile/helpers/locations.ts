import { normKey, titleCase, uniqSorted, safeJsonParse } from "./strings";
import type { LocationsStore } from "../types";

export const COUNTRY_FIXED = "Maroc";
export const LS_LOCATIONS_KEY = "duumini:locations:v1";

/** Fallback cities */
export const BASE_VILLES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tanger",
  "Fès",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Safi",
  "El Jadida",
  "Béni Mellal",
  "Nador",
  "Laâyoune",
  "Dakhla",
] as const;

/** Fallback communes */
export const BASE_COMMUNES_CASA: string[] = [
  "Anfa",
  "Maârif",
  "Sidi Belyout",
  "Aïn Chock",
  "Hay Hassani",
  "Ben Msick",
  "Moulay Rachid",
  "Sidi Bernoussi",
  "Aïn Sebaâ",
  "Al Fida",
  "Mers Sultan",
  "Sidi Othmane",
];

export const BASE_COMMUNES_MARRAKECH: string[] = [
  "Guéliz",
  "Ménara",
  "Médina",
  "Sidi Youssef Ben Ali",
  "Annakhil",
  "Nakhil",
];

export function loadLocations(): LocationsStore {
  const fallback: LocationsStore = {
    version: 1,
    villes: uniqSorted([...BASE_VILLES]),
    communesByVille: {
      [normKey("Casablanca")]: uniqSorted(BASE_COMMUNES_CASA),
      [normKey("Marrakech")]: uniqSorted(BASE_COMMUNES_MARRAKECH),
    },
    quartiersByVille: {},
  };

  const stored = safeJsonParse<LocationsStore>(
    localStorage.getItem(LS_LOCATIONS_KEY),
    fallback
  );

  const villes = uniqSorted([...(stored?.villes || []), ...fallback.villes]);

  const communesByVille: Record<string, string[]> = {
    ...(stored?.communesByVille || {}),
  };
  const quartiersByVille: Record<string, string[]> = {
    ...(stored?.quartiersByVille || {}),
  };

  const casaKey = normKey("Casablanca");
  const marKey = normKey("Marrakech");
  communesByVille[casaKey] = uniqSorted([
    ...(communesByVille[casaKey] || []),
    ...BASE_COMMUNES_CASA,
  ]);
  communesByVille[marKey] = uniqSorted([
    ...(communesByVille[marKey] || []),
    ...BASE_COMMUNES_MARRAKECH,
  ]);

  const out: LocationsStore = {
    version: 1,
    villes,
    communesByVille,
    quartiersByVille,
  };
  localStorage.setItem(LS_LOCATIONS_KEY, JSON.stringify(out));
  return out;
}

export function saveLocations(store: LocationsStore) {
  localStorage.setItem(LS_LOCATIONS_KEY, JSON.stringify(store));
}

export function addVille(store: LocationsStore, ville: string) {
  const v = titleCase(ville);
  if (!v) return store;

  const next: LocationsStore = { ...store };
  next.villes = uniqSorted([...(store.villes || []), v]);

  const key = normKey(v);
  if (!next.communesByVille[key]) next.communesByVille[key] = [];
  if (!next.quartiersByVille[key]) next.quartiersByVille[key] = [];

  saveLocations(next);
  return next;
}

export function addCommune(store: LocationsStore, ville: string, commune: string) {
  const v = titleCase(ville);
  const c = titleCase(commune);
  if (!v || !c) return store;

  let next = addVille(store, v);
  const key = normKey(v);

  next = { ...next, communesByVille: { ...next.communesByVille } };
  next.communesByVille[key] = uniqSorted([
    ...(next.communesByVille[key] || []),
    c,
  ]);

  saveLocations(next);
  return next;
}

export function addQuartier(store: LocationsStore, ville: string, quartier: string) {
  const v = titleCase(ville);
  const q = titleCase(quartier);
  if (!v || !q) return store;

  let next = addVille(store, v);
  const key = normKey(v);

  next = { ...next, quartiersByVille: { ...next.quartiersByVille } };
  next.quartiersByVille[key] = uniqSorted([
    ...(next.quartiersByVille[key] || []),
    q,
  ]);

  saveLocations(next);
  return next;
}

export function communesForVille(store: LocationsStore, ville: string) {
  const key = normKey(ville);
  return uniqSorted(store.communesByVille[key] || []);
}

export function quartiersForVille(store: LocationsStore, ville: string) {
  const key = normKey(ville);
  return uniqSorted(store.quartiersByVille[key] || []);
}
