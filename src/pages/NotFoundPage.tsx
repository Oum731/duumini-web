// src/pages/NotFoundPage.tsx
import { Link } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Seo } from "../components/Seo";

/**
 * ✅ Route "*" (aucune correspondance). Le SPA n'a pas de rendu serveur, donc
 * cette page répond toujours en HTTP 200 — un "soft 404". Googlebot exécute
 * le JS et indexait donc son contenu comme s'il s'agissait d'une vraie page
 * (ex: une ancienne URL de produit supprimée). Seo noindex empêche cette
 * page d'apparaître dans les résultats de recherche.
 */
export default function NotFoundPage() {
  return (
    <div className="container-xxl py-5 text-center" style={{ maxWidth: 520 }}>
      <Seo
        title="Page introuvable"
        description="Cette page n'existe pas ou n'est plus disponible sur Duumini."
        noindex
      />

      <div
        className="d-inline-flex align-items-center justify-content-center mb-3"
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(var(--duu-orange-rgb), .12)",
        }}
      >
        <Search size={28} color="var(--duu-orange)" />
      </div>

      <h1 className="h4 mb-2">Page introuvable</h1>
      <p className="text-muted mb-4">
        Ce lien n'existe pas ou n'est plus disponible. Il a peut-être expiré,
        ou l'adresse contient une erreur.
      </p>

      <div className="d-flex gap-2 justify-content-center flex-wrap">
        <Link to="/" className="btn btn-duu-green">
          <ArrowLeft size={16} className="me-1" />
          Retour à l'accueil
        </Link>
        <Link to="/catalogue" className="btn btn-outline-dark">
          Voir le catalogue
        </Link>
      </div>
    </div>
  );
}
