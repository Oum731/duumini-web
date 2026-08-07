// src/services/catalogB2B.ts
import { api, HttpError } from "./http";

/**
 * ✅ Catalogue B2B (book fournisseurs/partenaires) — endpoint public mais
 * protégé par un code d'accès simple (pas une vraie authentification, voir
 * duumini-api/src/routes/products.js: b2bCatalogueHandler). Champs minimaux
 * uniquement — jamais price/supplier_price_ht (voir omitInternalPriceFields
 * côté API pour le reste du catalogue).
 */
export type B2BCatalogueItem = {
  id: number;
  name: string;
  brand?: string | null;
  conditionnement?: string | null;
  country_code?: string | null;
  partner_price_ht?: number | null;
  category_name?: string | null;
  cover?: string | null;
};

export async function getB2BCatalogue(code: string) {
  return api.get<{ items: B2BCatalogueItem[] }>("/api/products/b2b-catalogue", {
    query: { code },
    noAuth: true,
  });
}

export function isB2BAccessError(e: unknown): e is HttpError {
  return e instanceof HttpError && (e.status === 403 || e.status === 503);
}
