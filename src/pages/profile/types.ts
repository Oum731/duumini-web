export type LocationsStore = {
  version: 1;
  villes: string[];
  communesByVille: Record<string, string[]>;
  quartiersByVille: Record<string, string[]>;
};
