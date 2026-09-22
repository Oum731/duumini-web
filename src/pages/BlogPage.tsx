// src/pages/BlogPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Seo } from "../components/Seo";
import { LoadingState } from "../components/ui/Spinner";
import {
  listPublishedContent,
  type PageInfo,
  type PublishedContentListItem,
} from "../services/content";

function dt(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PublishedContentListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);
    listPublishedContent("blog_post", { page, pageSize: 9 })
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.items) ? res.items : []);
        setPageInfo(res.pageInfo || null);
      })
      .catch((e) => mounted && setErr(e?.message || String(e)))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page]);

  return (
    <section className="container-xxl py-5">
      <Seo
        title="Ressources"
        description="Actualités et articles DUUMINI sur le commerce panafricain, les corridors logistiques et les produits authentiques d'Afrique."
        path="/blog"
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Ressources
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      {loading ? (
        <LoadingState label="Chargement des articles..." />
      ) : err ? (
        <div className="alert alert-danger py-2">{err}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-5">
          <BookOpen size={40} color="var(--duu-orange)" />
          <p className="text-muted mt-3 mb-0">
            Nos articles sur le commerce panafricain arrivent bientôt.
          </p>
        </div>
      ) : (
        <>
          <div className="row g-4">
            {items.map((it) => (
              <div className="col-12 col-md-6 col-lg-4" key={it.id}>
                <Link
                  to={`/${it.slug}`}
                  className="card h-100 border-0 shadow-sm text-decoration-none text-dark"
                  style={{ borderRadius: 16 }}
                >
                  <div className="card-body d-flex flex-column">
                    {it.published_at ? (
                      <div className="text-muted small mb-2">{dt(it.published_at)}</div>
                    ) : null}
                    <div className="fw-bold mb-2">{it.h1 || it.meta?.title || it.slug}</div>
                    {it.excerpt ? (
                      <p className="text-muted small mb-0">{it.excerpt}</p>
                    ) : null}
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {pageInfo && pageInfo.totalPages > 1 ? (
            <div className="d-flex justify-content-center gap-2 mt-4">
              <button
                className="btn btn-outline-dark btn-sm"
                disabled={!pageInfo.hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </button>
              <span className="align-self-center small text-muted">
                Page {pageInfo.page} / {pageInfo.totalPages}
              </span>
              <button
                className="btn btn-outline-dark btn-sm"
                disabled={!pageInfo.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
