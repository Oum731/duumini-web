// src/pages/solutions/SolutionDetailPage.tsx
import { Link, Navigate, useParams } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { PERSONAS, type PersonaKey } from "../home/data";
import { SOLUTIONS_CONTENT } from "./content";
import LeadForm from "./LeadForm";

export default function SolutionDetailPage() {
  const { persona: personaParam } = useParams<{ persona: string }>();
  const persona = PERSONAS.find((p) => p.key === personaParam);

  if (!persona) {
    return <Navigate to="/solutions" replace />;
  }

  const key = persona.key as PersonaKey;
  const content = SOLUTIONS_CONTENT[key];
  const color = persona.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)";
  const bg = persona.tint === "orange" ? "rgba(var(--duu-orange-rgb), .12)" : "rgba(var(--duu-green-rgb), .12)";

  return (
    <div className="container-xxl py-4 py-md-5">
      <Seo
        title={`Solution ${persona.title}`}
        description={persona.description}
        path={`/solutions/${key}`}
      />

      {/* Bannière */}
      <div
        className="row align-items-center g-4 p-4 p-md-5 mb-4 mb-md-5"
        style={{ borderRadius: "var(--duu-radius-xl)", background: bg }}
      >
        <div className="col-12 col-lg-8">
          <Link to="/solutions" className="small fw-semibold text-decoration-none d-inline-block mb-2" style={{ color }}>
            ← Toutes les solutions
          </Link>
          <div className="d-flex align-items-center gap-3 mb-2">
            <span style={{ fontSize: "2rem" }} aria-hidden="true">
              {persona.emoji}
            </span>
            <h1 className="fw-bold m-0" style={{ color }}>
              Je suis {persona.title.toLowerCase()}
            </h1>
          </div>
          <p className="text-muted m-0" style={{ maxWidth: 560 }}>
            {persona.description}
          </p>
        </div>
        <div className="col-12 col-lg-4 text-center">
          <img
            src={persona.photo}
            alt={persona.title}
            className="img-fluid"
            style={{ maxWidth: 180, borderRadius: "50%", aspectRatio: "1 / 1", objectFit: "cover" }}
          />
        </div>
      </div>

      {/* Bénéfices */}
      <section className="mb-5">
        <h2 className="h4 fw-bold mb-3">Les bénéfices</h2>
        <div className="row g-3">
          {content.benefits.map((b) => (
            <div className="col-12 col-md-6" key={b}>
              <div
                className="h-100 p-3 d-flex gap-2"
                style={{ borderRadius: "var(--duu-radius-lg)", background: "#fff", boxShadow: "var(--duu-shadow-sm)" }}
              >
                <span style={{ color }}>✓</span>
                <span className="small">{b}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="mb-5">
        <h2 className="h4 fw-bold mb-3">Les services</h2>
        <div className="row g-3">
          {content.services.map((s) => (
            <div className="col-12 col-md-6" key={s}>
              <div
                className="h-100 p-3 d-flex gap-2"
                style={{ borderRadius: "var(--duu-radius-lg)", background: "#fff", boxShadow: "var(--duu-shadow-sm)" }}
              >
                <span style={{ color }}>•</span>
                <span className="small">{s}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fonctionnement */}
      <section className="mb-5">
        <h2 className="h4 fw-bold mb-3">Comment ça fonctionne pour vous</h2>
        {persona.detail.map((paragraph, i) => (
          <p className="text-muted" key={i} style={{ maxWidth: 720 }}>
            {paragraph}
          </p>
        ))}
      </section>

      {/* FAQ */}
      <section className="mb-5">
        <h2 className="h4 fw-bold mb-3">Questions fréquentes</h2>
        <div className="d-flex flex-column gap-3" style={{ maxWidth: 720 }}>
          {content.faq.map((item) => (
            <div key={item.q}>
              <div className="fw-semibold mb-1">{item.q}</div>
              <p className="text-muted mb-0">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formulaire */}
      <section>
        <h2 className="h4 fw-bold mb-3">Passer à l'étape suivante</h2>
        <LeadForm persona={key} title={`Je suis ${persona.title.toLowerCase()}`} />
      </section>
    </div>
  );
}
