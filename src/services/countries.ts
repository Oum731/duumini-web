// src/services/countries.ts
import { api } from "./http";

export type CountryConfig = {
  code: string;
  label: string;
  currency: string;
  flag_emoji: string | null;
  description: string | null;
  is_active: boolean | number;
  sort_order: number;
};

/** Tous les pays configurés (actifs et à venir), triés par sort_order. */
export async function listCountries() {
  const res = await api.get<{ items: CountryConfig[] }>("/api/countries");
  return res.items;
}

/** Raccourci : uniquement les pays actifs (pour les sélecteurs de boutique). */
export async function listActiveCountries() {
  const items = await listCountries();
  return items.filter((c) => !!c.is_active);
}
