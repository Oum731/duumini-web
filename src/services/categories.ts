// src/services/categories.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type Category = { id: number; name: string; slug: string };

/* ---------- Liste des catégories ---------- */
export async function listCategories(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  return api.get<Paginated<Category>>("/api/categories", { query: { page, pageSize } });
}

/* ---------- Création d'une nouvelle catégorie ---------- */
export async function createCategory(name: string) {
  // On laisse le backend générer et dédupliquer le slug
  return api.post<{ id: number; name: string; slug: string }>("/api/categories", {
    name,
  });
}
