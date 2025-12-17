import { api } from "./http";

export async function getPageCopy(slug: string, lang = "fr") {
  return api.get<{ slug: string; lang: string; data: any }>(`/api/page-copy/${slug}`, {
    query: { lang },
  });
}
