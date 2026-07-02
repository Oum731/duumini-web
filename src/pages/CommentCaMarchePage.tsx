// src/pages/CommentCaMarchePage.tsx
import { Link } from "react-router-dom";
import { HOW_IT_WORKS_STEPS } from "./home/data";

const STEP_DETAILS: string[] = [
  "Le vendeur ou le producteur crée sa fiche produit sur DUUMINI : photos, prix, quantités disponibles. Aucune installation technique n'est nécessaire, tout se fait depuis l'espace vendeur.",
  "DUUMINI vérifie chaque commande, centralise les produits de plusieurs vendeurs si besoin, et prépare l'expédition. C'est cette étape qui nous distingue : vous n'avez pas à gérer la logistique transfrontalière vous-même.",
  "Le transport est assuré de bout en bout par DUUMINI et ses partenaires logistiques, avec un suivi à chaque étape du corridor (aujourd'hui Maroc ↔ Côte d'Ivoire).",
  "Le client final ou l'entreprise acheteuse reçoit sa commande, et le vendeur suit le règlement (montant total, part DUUMINI, montant versé) directement depuis son tableau de bord.",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Qui peut publier un produit sur DUUMINI ?",
    a: "Les vendeurs et fournisseurs vérifiés par notre équipe. L'inscription se fait sur demande via la page Contact — nous n'avons pas encore d'inscription en libre-service.",
  },
  {
    q: "Combien de temps prend le transport sur le corridor Maroc ↔ Côte d'Ivoire ?",
    a: "Le délai dépend du volume et du type de produit. Notre équipe communique un délai précis à la validation de chaque commande.",
  },
  {
    q: "DUUMINI gère-t-il les paiements ?",
    a: "Oui. DUUMINI centralise l'encaissement client puis reverse aux vendeurs et fournisseurs leur part, commission déduite, avec un suivi transparent du montant envoyé et du montant restant.",
  },
  {
    q: "Puis-je suivre ma commande en temps réel ?",
    a: "Chaque vendeur et fournisseur dispose d'un tableau de bord pour suivre le statut de ses commandes (en cours, livré, annulé) et l'état des paiements.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <section className="container-xxl py-5">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Comment ça marche ?
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      <p className="text-muted mb-5" style={{ maxWidth: 640 }}>
        DUUMINI met en relation vendeurs, fournisseurs et acheteurs à travers
        l'Afrique, et prend en charge la centralisation des commandes et le
        transport transfrontalier.
      </p>

      <div className="d-flex flex-column gap-4 mb-5">
        {HOW_IT_WORKS_STEPS.map((step, i) => {
          const Icon = step.icon;
          const color =
            step.emphasis === "orange"
              ? "var(--duu-orange)"
              : step.emphasis === "green"
              ? "var(--duu-green)"
              : "var(--duu-black)";
          const bg =
            step.emphasis === "orange"
              ? "rgba(var(--duu-orange-rgb), .12)"
              : step.emphasis === "green"
              ? "rgba(var(--duu-green-rgb), .12)"
              : "rgba(17,17,17,.06)";

          return (
            <div className="row g-3 align-items-start" key={step.title}>
              <div className="col-auto">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: 56, height: 56, borderRadius: "50%", background: bg }}
                >
                  <Icon size={26} color={color} />
                </div>
              </div>
              <div className="col">
                <div className="fw-bold mb-1" style={{ color, fontSize: "1.1rem" }}>
                  {i + 1}. {step.title}
                </div>
                <p className="text-muted mb-0">{STEP_DETAILS[i]}</p>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="h4 mb-3">Questions fréquentes</h2>
      <div className="d-flex flex-column gap-3" style={{ maxWidth: 720 }}>
        {FAQ.map((item) => (
          <div key={item.q}>
            <div className="fw-semibold mb-1">{item.q}</div>
            <p className="text-muted mb-0">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
