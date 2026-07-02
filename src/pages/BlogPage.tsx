// src/pages/BlogPage.tsx
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export default function BlogPage() {
  return (
    <section className="container-xxl py-5">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Blog
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      <div className="text-center py-5">
        <BookOpen size={40} color="var(--duu-orange)" />
        <p className="text-muted mt-3 mb-0">
          Nos articles sur le commerce panafricain arrivent bientôt.
        </p>
      </div>
    </section>
  );
}
