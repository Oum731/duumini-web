// src/pages/About.tsx
import { Link } from "react-router-dom";

const MAP_Q = "33.555706,-7.704473";
const MAP_URL = `https://maps.google.com/?q=${MAP_Q}`;

export default function AboutPage() {
  return (
    <section className="container-xxl py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>À propos de duumini</h1>
        <Link to="/" className="btn btn-outline-dark">Accueil</Link>
      </div>

      {/* Bandeau statut */}
      <div className="alert alert-warning border-0 shadow-sm">
        <div className="d-flex flex-column">
          <strong>Dernière révision : 2 juillet 2026 (première publication : 30 octobre 2025)</strong>
          <span className="mt-1">
            ℹ️ <strong>Statut du service</strong> : <em>Phase pilote (test)</em>. duumini n’est pas encore immatriculée en société.
            Les commandes sont traitées à titre expérimental, avec périmètre et volumes limités.
          </span>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <p className="lead mb-3" style={{ color: "var(--duu-black)" }}>
                duumini, la plateforme qui connecte vendeurs, fournisseurs et producteurs à travers l’Afrique.
              </p>
              <p className="text-muted">
                Notre mission : faire circuler les produits africains d’un pays à l’autre — pas seulement les livrer
                à la diaspora installée au Maroc, mais mettre en relation directe ceux qui produisent, ceux qui
                fournissent et ceux qui vendent, où qu’ils soient sur le continent. Le corridor Maroc ↔ Côte d’Ivoire
                est notre premier maillon ; d’autres pays africains suivront.
              </p>

              <h2 className="h6 mt-4" style={{ color: "var(--duu-black)" }}>Impact & ambition</h2>
              <p className="text-muted">
                duumini veut ouvrir de nouveaux débouchés aux vendeurs, fournisseurs et producteurs africains, en
                leur donnant accès à des marchés au-delà de leurs frontières, avec des outils pour se
                professionnaliser et une visibilité durable.
              </p>

              <h2 className="h6 mt-4" style={{ color: "var(--duu-black)" }}>Notre credo</h2>
              <p className="text-muted">
                Professionnaliser et fiabiliser le commerce interafricain de produits authentiques — du sourcing
                chez le producteur à la livraison chez le vendeur ou le client final, en traversant les frontières —
                pour tirer tout l’écosystème vers le haut.
              </p>

              <h2 className="h6 mt-4" style={{ color: "var(--duu-black)" }}>Ce que nous faisons concrètement</h2>
              <ul className="text-muted mb-3">
                <li><strong>Mise en relation vendeurs ↔ fournisseurs</strong> : un guichet unique pour sourcer, référencer et vendre des produits africains (alimentaires & culturels) d’un pays à l’autre.</li>
                <li><strong>Standards qualité</strong> : traçabilité, contrôles, chaîne du froid, étiquetage conforme.</li>
                <li><strong>Professionnalisation des vendeurs et fournisseurs</strong> : onboarding, fiches produits normées, outils de facturation et de suivi, coaching.</li>
                <li><strong>Logistique & paiement transfrontaliers</strong> : transport sécurisé sur les corridors actifs (aujourd’hui Maroc ↔ Côte d’Ivoire), paiements centralisés et reversés de façon transparente.</li>
                <li><strong>Transparence</strong> : informations claires sur l’origine, les ingrédients et les conditions de conservation.</li>
              </ul>

              <h2 className="h6 mt-4" style={{ color: "var(--duu-black)" }}>Nos engagements</h2>
              <ul className="text-muted mb-0">
                <li>Qualité et sécurité des produits.</li>
                <li>Commerce équitable avec nos partenaires, où qu’ils soient sur le continent.</li>
                <li>Service client réactif et empathique.</li>
                <li>Protection des données personnelles et transparence.</li>
              </ul>
            </div>
          </div>

          {/* Mentions d’identification */}
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h6 mb-2" style={{ color: "var(--duu-black)" }}>
                Mentions d’identification (phase pilote – à compléter)
              </h2>
              <ul className="text-muted">
                <li><strong>Statut actuel</strong> : projet en phase test (société non encore constituée)</li>
                <li><strong>Responsable du projet (personne physique)</strong> : [Nom Prénom]</li>
                <li><strong>Téléphone</strong> : +212 623 677 884</li>
                <li><strong>Email</strong> : <a href="mailto:admin@duumini.com">admin@duumini.com</a></li>
                <li><strong>Adresse de contact</strong> : Casablanca — Riad Oulfa, non loin du terminus 20 (<a href={MAP_URL} target="_blank" rel="noopener noreferrer">voir la carte</a>)</li>
                <li className="mb-0">
                  <em>(À venir au lancement)</em> Raison sociale, forme, RC, ICE, IF, capital social, hébergeur,
                  n°/date de notification CNDP.
                </li>
              </ul>

              <h2 className="h6 mb-2" style={{ color: "var(--duu-black)" }}>Localisation</h2>
              <div className="ratio ratio-16x9 rounded overflow-hidden" style={{ background: "#f7f7f7" }}>
                <iframe
                  title="Localisation duumini"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(MAP_Q)}&output=embed`}
                />
              </div>
              <div className="d-flex flex-wrap gap-2 mt-3">
                <a className="btn btn-duu" href={MAP_URL} target="_blank" rel="noopener noreferrer">Voir sur Google Maps</a>
                <Link to="/contact" className="btn btn-outline-dark">Nous contacter</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Visuel / points clés */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h6 mb-3" style={{ color: "var(--duu-black)" }}>En bref</h2>
              <ul className="list-unstyled m-0 text-muted">
                <li className="mb-2">✅ Paiement à la livraison</li>
                <li className="mb-2">✅ Service client WhatsApp</li>
                <li className="mb-2">✅ Produits d’Afrique subsaharienne</li>
                <li className="mb-2">✅ Livraison Casablanca</li>
              </ul>
              <div className="mt-3">
                <img src="/accueil.jpeg" alt="duumini" className="img-fluid rounded" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-secondary mt-4 mb-0">
        <small className="text-muted">
          Besoin d’aide ? Écris-nous à <a href="mailto:admin@duumini.com">admin@duumini.com</a> ou WhatsApp
          <a className="ms-1" href="https://wa.me/212623677884" target="_blank" rel="noopener noreferrer">+212 623 677 884</a>.
        </small>
      </div>
    </section>
  );
}
