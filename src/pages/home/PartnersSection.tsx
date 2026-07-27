// src/pages/home/PartnersSection.tsx
// Section dynamique : dès qu'un partenaire logistique/institutionnel est
// annoncé publiquement, son logo vient ici. En attendant, on garde une
// place honnête plutôt que d'inventer des partenaires fictifs.
import { Link } from "react-router-dom";

export default function PartnersSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h2 className="fw-bold m-0">Nos partenaires</h2>
        <Link to="/solutions/partenaire" className="small fw-semibold text-decoration-none">
          Devenir partenaire →
        </Link>
      </div>

      <div
        className="p-4 p-md-5 text-center"
        style={{
          borderRadius: "var(--duu-radius-xl)",
          background: "#fff",
          boxShadow: "var(--duu-shadow-sm)",
        }}
      >
        <div className="text-muted">
          Le réseau de partenaires DUUMINI se construit avec le corridor
          Maroc–Côte d'Ivoire. Investisseurs, logisticiens, institutions :
          rejoignez les premiers partenaires du projet.
        </div>
      </div>
    </section>
  );
}
