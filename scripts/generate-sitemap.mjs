#!/usr/bin/env node
// scripts/generate-sitemap.mjs
//
// Génère dist/sitemap.xml après le build Vite, avec toutes les pages
// produits/boutiques actives en plus des pages statiques — le
// public/sitemap.xml précédent était entièrement écrit à la main et ne
// listait donc jamais un seul produit ni une seule boutique, ce qui prive
// Google de la quasi-totalité du catalogue lors de l'exploration du site.
//
// Appelé depuis .github/workflows/deploy.yml, après `npm run build` et
// avant le déploiement FTP. Ne fait jamais échouer le déploiement : si
// l'API est injoignable (ex: cold start Render), on retombe sur les pages
// statiques seules plutôt que de bloquer la mise en ligne.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "..", "dist");

const SITE_URL = "https://duumini.com";
const API_BASE = process.env.SITEMAP_API_BASE || "https://duumini-api.onrender.com";

const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/comment-ca-marche", changefreq: "monthly", priority: "0.8" },
  { loc: "/solutions", changefreq: "monthly", priority: "0.8" },
  { loc: "/pays", changefreq: "monthly", priority: "0.7" },
  { loc: "/rejoindre", changefreq: "monthly", priority: "0.8" },
  { loc: "/about", changefreq: "monthly", priority: "0.6" },
  { loc: "/contact", changefreq: "monthly", priority: "0.6" },
  { loc: "/blog", changefreq: "weekly", priority: "0.6" },
  { loc: "/african-food", changefreq: "daily", priority: "0.9" },
  { loc: "/african-market", changefreq: "daily", priority: "0.9" },
  { loc: "/fashion", changefreq: "daily", priority: "0.9" },
  { loc: "/top-products", changefreq: "daily", priority: "0.8" },
  { loc: "/catalogue", changefreq: "daily", priority: "0.9" },
];

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchAllPages(basePath, { pageSize = 200, maxPages = 200 } = {}) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const data = await fetchJson(`${basePath}${sep}page=${page}&pageSize=${pageSize}`);
    const pageItems = Array.isArray(data?.items) ? data.items : [];
    items.push(...pageItems);

    const totalPages = Number(data?.pageInfo?.totalPages || 0);
    if (!totalPages || page >= totalPages || pageItems.length === 0) break;
  }
  return items;
}

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function toLastmod(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  const entries = STATIC_PAGES.map((p) => urlEntry({ ...p, loc: `${SITE_URL}${p.loc}` }));

  try {
    const products = await fetchAllPages("/api/products?onlyActive=1");
    for (const p of products) {
      const idOrSlug = p.slug || p.id;
      if (!idOrSlug) continue;
      entries.push(
        urlEntry({
          loc: `${SITE_URL}/products/${encodeURIComponent(idOrSlug)}`,
          lastmod: toLastmod(p.updated_at || p.created_at),
          changefreq: "weekly",
          priority: "0.7",
        })
      );
    }
    console.log(`[generate-sitemap] ${products.length} produit(s) ajouté(s).`);
  } catch (e) {
    console.warn(`[generate-sitemap] produits non récupérés (${e.message}) — sitemap sans produits.`);
  }

  try {
    const shops = await fetchAllPages("/api/shops");
    for (const s of shops) {
      if (!s.slug) continue;
      entries.push(
        urlEntry({
          loc: `${SITE_URL}/boutique/${encodeURIComponent(s.slug)}`,
          lastmod: toLastmod(s.updated_at || s.created_at),
          changefreq: "weekly",
          priority: "0.6",
        })
      );
    }
    console.log(`[generate-sitemap] ${shops.length} boutique(s) ajoutée(s).`);
  } catch (e) {
    console.warn(`[generate-sitemap] boutiques non récupérées (${e.message}) — sitemap sans boutiques.`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
    "\n"
  )}\n</urlset>\n`;

  await writeFile(join(DIST_DIR, "sitemap.xml"), xml, "utf8");
  console.log(`[generate-sitemap] dist/sitemap.xml écrit (${entries.length} URL au total).`);
}

main().catch((e) => {
  console.error("[generate-sitemap] FAILED (non bloquant pour le déploiement):", e.message);
  // ✅ Ne fait jamais échouer le job de déploiement : le sitemap précédent
  // (copié tel quel depuis public/ par Vite) reste en place dans dist/.
  process.exit(0);
});
