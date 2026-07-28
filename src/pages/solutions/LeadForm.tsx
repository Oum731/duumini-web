// src/pages/solutions/LeadForm.tsx
import { Link } from "react-router-dom";
import type { PersonaKey } from "../home/data";

// Fournisseur / revendeur / partenaire ont un vrai parcours métier tracé
// (candidature revue par l'équipe admin, cf. RejoindrePage) : on y renvoie
// directement plutôt que de dupliquer un formulaire.
const REJOINDRE_LABEL: Partial<Record<PersonaKey, string>> = {
  fournisseur: "Déposer une demande de partenariat",
  revendeur: "Demander un compte professionnel",
  partenaire: "Déposer une demande de partenariat",
};

export default function LeadForm({ persona, title }: { persona: PersonaKey; title: string }) {
  const rejoindreLabel = REJOINDRE_LABEL[persona];

  if (rejoindreLabel) {
    return (
      <div
        className="p-4 p-md-5 text-center"
        style={{ borderRadius: "var(--duu-radius-xl)", background: "#fff", boxShadow: "var(--duu-shadow-sm)" }}
      >
        <div className="fw-bold mb-2">{title}</div>
        <p className="text-muted mb-4" style={{ maxWidth: 480, margin: "0 auto" }}>
          Cette étape se fait via notre formulaire de candidature : votre
          demande est ensuite examinée par notre équipe.
        </p>
        <Link to={`/rejoindre?type=${persona}`} className="btn btn-duu-orange btn-lg">
          {rejoindreLabel}
        </Link>
      </div>
    );
  }

  // Client : pas de candidature à vétifier, juste un compte à créer.
  return (
    <div
      className="p-4 p-md-5 text-center"
      style={{ borderRadius: "var(--duu-radius-xl)", background: "#fff", boxShadow: "var(--duu-shadow-sm)" }}
    >
      <div className="fw-bold mb-2">{title}</div>
      <p className="text-muted mb-4" style={{ maxWidth: 480, margin: "0 auto" }}>
        Aucune candidature à déposer : explorez le catalogue et créez votre
        compte pour commander.
      </p>
      <div className="d-flex flex-wrap gap-2 justify-content-center">
        <Link to="/catalogue" className="btn btn-outline-dark btn-lg">
          Explorer le catalogue
        </Link>
        <Link to="/profile" className="btn btn-duu-orange btn-lg">
          Créer mon compte
        </Link>
      </div>
    </div>
  );
}
