// src/services/content.ts
import { api } from "./http";

export type ContentSection = { h2?: string; body?: string };
export type ContentFaqItem = { q?: string; a?: string };
export type ContentInternalLink = { label?: string; href?: string };

export type PublishedContentData = {
  h1?: string;
  sections?: ContentSection[];
  body?: string;
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

/** Contenu publié (page IA validée par un admin) par slug — 404 si absent
 * ou non publié. `slug` sans slash de tête/fin (ex: "casablanca/produits-africains"). */
export async function getPublishedContent(
  slug: string,
  type: string = "city_page"
): Promise<PublishedContent | null> {
  try {
    return await api.get<PublishedContent>("/api/content", { query: { slug, type } });
  } catch (e: any) {
    if (e?.status === 404 || e?.response?.status === 404) return null;
    throw e;
  }
}
