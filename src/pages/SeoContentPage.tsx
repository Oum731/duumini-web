// src/pages/SeoContentPage.tsx
//
// Rend publiquement le contenu généré par l'outil Contenu IA
// (/admin/content-ai) une fois publié — jusqu'ici ce contenu pouvait être
// généré et validé par un admin mais n'avait aucune destination sur le
// site public. Route catch-all (voir App.tsx, placée juste avant le 404) :
// si le chemin ne correspond à aucune autre route ET qu'un contenu publié
// existe pour ce slug, on l'affiche ; sinon page 404 classique.
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { LoadingState } from "../components/ui/Spinner";
import { getPublishedContent, type PublishedContent } from "../services/content";
import NotFoundPage from "./NotFoundPage";

export default function SeoContentPage() {
  const location = useLocation();
  const slug = location.pathname.replace(/^\/+|\/+$/g, "");

  const [content, setContent] = useState<PublishedContent | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    setContent(undefined);
    getPublishedContent(slug)
      .then((res) => mounted && setContent(res))
      .catch(() => mounted && setContent(null));
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (content === undefined) {
    return <LoadingState label="Chargement..." />;
  }

  if (!content) {
    return <NotFoundPage />;
  }

  const data = content.data || {};
  const title = data.meta?.title || data.h1 || "Duumini";
  const description = data.meta?.description || "";

  const jsonLd = data.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: data.faq.map((f) => ({
          "@type": "Question",
          name: f.q || "",
          acceptedAnswer: { "@type": "Answer", text: f.a || "" },
        })),
      }
    : undefined;

  return (
    <div className="container-xxl py-4" style={{ maxWidth: 860 }}>
      <Seo title={title} description={description} jsonLd={jsonLd} />

      <h1 className="fw-bold mb-3">{data.h1 || title}</h1>

      {data.body ? <p className="mb-4" style={{ whiteSpace: "pre-line" }}>{data.body}</p> : null}

      {(data.sections || []).map((s, i) => (
        <section key={i} className="mb-4">
          {s.h2 ? <h2 className="h5 fw-bold mb-2">{s.h2}</h2> : null}
          {s.body ? <p style={{ whiteSpace: "pre-line" }}>{s.body}</p> : null}
        </section>
      ))}

      {data.faq?.length ? (
        <section className="mb-4">
          <h2 className="h5 fw-bold mb-3">Questions fréquentes</h2>
          {data.faq.map((f, i) => (
            <div key={i} className="mb-3">
              <div className="fw-semibold">{f.q}</div>
              <div className="text-muted">{f.a}</div>
            </div>
          ))}
        </section>
      ) : null}

      {data.internal_links?.length ? (
        <section className="d-flex flex-wrap gap-2 mt-4">
          {data.internal_links.map((l, i) =>
            l.href ? (
              <Link key={i} to={l.href} className="btn btn-outline-dark btn-sm">
                {l.label || l.href}
              </Link>
            ) : null
          )}
        </section>
      ) : null}
    </div>
  );
}
