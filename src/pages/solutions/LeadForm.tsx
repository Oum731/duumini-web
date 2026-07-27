// src/pages/solutions/LeadForm.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import type { PersonaKey } from "../home/data";

const CONTACT_EMAIL = "duuminima@gmail.com";

// Fournisseur / revendeur ont déjà un vrai parcours métier (candidature
// vétée avec DFE/RC, revue par l'équipe admin) : on y renvoie directement
// plutôt que de dupliquer un formulaire qui ne mènerait nulle part.
const REJOINDRE_LABEL: Partial<Record<PersonaKey, string>> = {
  fournisseur: "Déposer une demande de partenariat",
  revendeur: "Demander un compte professionnel",
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
          Cette étape se fait via notre formulaire de candidature (nom légal,
          documents justificatifs) : votre demande est ensuite examinée par
          notre équipe.
        </p>
        <Link to={`/rejoindre?type=${persona}`} className="btn btn-duu-orange btn-lg">
          {rejoindreLabel}
        </Link>
      </div>
    );
  }

  return <ContactLeadForm title={title} />;
}

// Client / partenaire : pas de parcours métier vétifié équivalent — un vrai
// petit formulaire qui ouvre le client email de l'utilisateur avec le
// message pré-rempli (honnête : pas de fausse confirmation "envoyé").
function ContactLeadForm({ title }: { title: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const subject = encodeURIComponent(`DUUMINI — ${title} : ${name || "contact"}`);
    const body = encodeURIComponent(
      `Nom : ${name}\nContact : ${contact}\n\nMessage :\n${message}`
    );

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setOpened(true);
  }

  return (
    <div
      className="p-4 p-md-5"
      style={{ borderRadius: "var(--duu-radius-xl)", background: "#fff", boxShadow: "var(--duu-shadow-sm)" }}
    >
      <div className="fw-bold mb-3">{title}</div>

      {opened && (
        <div className="alert alert-success py-2">
          Votre messagerie va s'ouvrir avec le message pré-rempli — il ne
          reste qu'à l'envoyer.
        </div>
      )}

      <form onSubmit={handleSubmit} className="row g-3" style={{ maxWidth: 560 }}>
        <div className="col-12 col-sm-6">
          <label className="form-label">Nom</label>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="col-12 col-sm-6">
          <label className="form-label">Téléphone ou email</label>
          <input
            className="form-control"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
          />
        </div>
        <div className="col-12">
          <label className="form-label">Message</label>
          <textarea
            className="form-control"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Votre demande..."
          />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-duu-orange">
            Envoyer par email
          </button>
        </div>
      </form>
    </div>
  );
}
