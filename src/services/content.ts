// src/services/content.ts
import { api } from "./http";

export type ContentSection = { h2?: string; body?: string };
export type ContentFaqItem = { q?: string; a?: string };
export type ContentInternalLink = { label?: string; href?: string };

export type PublishedContentData = {
  h1?: string;
  sections?: ContentSection[];
  body?: string;
  excerpt?: string;
  faq?: ContentFaqItem[];
  meta?: { title?: string; description?: string; keywords?: string[] };
  internal_links?: ContentInternalLink[];
  notes?: string;
};

export type PublishedContent = {
  id: number;
  type: string;
  slug: string;
  lang: string;
  status: string;
  score: number | null;
  data: PublishedContentData;
  updated_at?: string | null;
  published_at?: string | null;
};

export type PublishedContentListItem = {
  id: number;
  type: string;
  slug: string;
  lang: string;
  score: number | null;
  published_at?: string | null;
  updated_at?: string | null;
  h1?: string | null;
  excerpt?: string | null;
  meta?: { title?: string; description?: string; keywords?: string[] } | null;
};

export type PageInfo = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/** Contenu publié (page IA validée par un admin) par slug — 404 si absent
 * ou non publié. `slug` sans slash de tête/fin (ex: "casablanca/produits-africains").
 * `type` optionnel : sans lui, le backend cherche tous les types de contenu
 * pour ce slug (utile pour une route catch-all générique côté front). */
export async function getPublishedContent(
  slug: string,
  type?: string
): Promise<PublishedContent | null> {
  try {
    return await api.get<PublishedContent>("/api/content", {
      query: type ? { slug, type } : { slug },
    });
  } catch (e: any) {
    if (e?.status === 404 || e?.response?.status === 404) return null;
    throw e;
  }
}

/** Liste paginée du contenu publié d'un type donné (ex: index du blog). */
export async function listPublishedContent(
  type: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ items: PublishedContentListItem[]; pageInfo: PageInfo }> {
  return api.get("/api/content", {
    query: { type, list: 1, page: params.page, pageSize: params.pageSize },
  });
}
