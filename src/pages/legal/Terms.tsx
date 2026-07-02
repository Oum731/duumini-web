// src/pages/legal/Terms.tsx
export default function Terms() {
  return (
    <section className="container-xxl py-4">
      <header className="mb-3">
        <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>
          Conditions d’utilisation (CGU) de www.duumini.com
        </h1>
        <p className="text-muted mb-0">
          Dernière révision : 2 juillet 2026 (première publication : 30 octobre 2025)
        </p>
      </header>

      <div className="alert alert-warning border-0 shadow-sm mb-3">
        <strong>Phase pilote (test)</strong> : disponibilité, fonctionnalités et procédures susceptibles d’évoluer rapidement.
      </div>

      <div className="vstack gap-3">
        <Card title="1. Définitions">
          <ul className="text-muted mb-0">
            <li><strong>Utilisateur</strong> : toute personne qui visite le Site.</li>
            <li><strong>Client</strong> : tout Utilisateur qui passe commande sur le Site.</li>
            <li><strong>Vendeur</strong> : professionnel référencé sur duumini qui propose ses propres produits à la vente sur la Plateforme.</li>
            <li><strong>Fournisseur</strong> : professionnel référencé sur duumini qui approvisionne des Vendeurs ou des Clients professionnels, notamment dans le cadre du commerce interafricain (ex. corridor Maroc ↔ Côte d’Ivoire).</li>
            <li><strong>duumini</strong> : l’opérateur de la Plateforme, qui met en relation Vendeurs, Fournisseurs et Clients à travers plusieurs pays africains, et assure la centralisation des commandes, le paiement et la logistique transfrontalière.</li>
          </ul>
        </Card>

        <Card title="2. Objet">
          <p className="text-muted mb-2">
            duumini est une plateforme de mise en relation entre Vendeurs, Fournisseurs et Clients à travers l’Afrique.
            Les Vendeurs et Fournisseurs référencent et vendent leurs propres produits sur la Plateforme ; duumini
            centralise les commandes, sécurise le paiement, et assure ou coordonne le transport — y compris entre pays
            (aujourd’hui le corridor Maroc ↔ Côte d’Ivoire, avec d’autres pays à venir).
          </p>
          <p className="text-muted mb-0">
            <strong>Rôle de duumini</strong> : duumini n’est pas systématiquement le vendeur des produits présentés —
            chaque fiche produit indique la boutique/Vendeur responsable. duumini reste néanmoins l’interlocuteur
            unique du Client pour la commande, le paiement et le service après-vente, et supervise la conformité des
            Vendeurs et Fournisseurs référencés sur la Plateforme.
          </p>
        </Card>

        <Card title="Dispositions spécifiques à la phase pilote (test)">
          <ul className="text-muted mb-0">
            <li><strong>Disponibilité limitée</strong> : zones desservies, créneaux et quantités peuvent être restreints et évoluer.</li>
            <li><strong>Modifications rapides</strong> : fonctionnalités, prix et procédures peuvent être ajustés pendant le test.</li>
            <li><strong>Communication préalable</strong> : toute substitution ou variation de prix doit être validée avec le Client avant exécution.</li>
            <li><strong>Moyens de paiement</strong> : ceux disponibles pendant la phase pilote sont indiqués au checkout; à défaut, un paiement à la livraison peut être proposé.</li>
            <li><strong>Interruption du service</strong> : duumini peut suspendre le test à tout moment pour raisons opérationnelles.</li>
          </ul>
        </Card>

        <Card title="3. Compte et accès">
          <ul className="text-muted mb-0">
            <li>La création de compte nécessite des informations exactes et à jour. Vous êtes responsable de la confidentialité de vos identifiants.</li>
            <li>duumini peut suspendre un compte en cas d’usage abusif, de fraude ou de non-respect des CGU.</li>
          </ul>
        </Card>

        <Card title="4. Produits, disponibilité et prix">
          <ul className="text-muted mb-2">
            <li><strong>Achat à la demande</strong> : certaines références étant approvisionnées après commande, la disponibilité dépend des stocks chez nos partenaires le jour du retrait. En cas d’indisponibilité, duumini propose : (i) une alternative équivalente (marque/format) soumise à votre accord préalable, ou (ii) le remboursement.</li>
            <li><strong>Photos & fiches</strong> : les photos sont illustratives. Les fiches produits précisent l’origine, le poids, les allergènes le cas échéant, et les conditions de conservation.</li>
            <li><strong>Prix</strong> : les prix affichés sont TTC, hors frais de livraison. Pour certaines denrées sujettes à fluctuation, un ajustement mineur peut intervenir ; toute variation est notifiée et validée avant exécution. Sans votre accord, la commande est remboursée.</li>
          </ul>
        </Card>

        <Card title="5. Commande et paiement">
          <ul className="text-muted mb-0">
            <li>La validation de commande vaut acceptation des CGU et des Conditions de vente (incluant la Politique de retour/annulation).</li>
            <li>Les moyens de paiement acceptés sont listés au checkout. Les transactions électroniques sont sécurisées conformément à la réglementation.</li>
          </ul>
        </Card>

        <Card title="6. Livraison">
          <ul className="text-muted mb-0">
            <li>Zones, délais indicatifs, frais et modes de livraison affichés au moment de la commande — y compris pour les livraisons transfrontalières sur les corridors actifs (aujourd’hui Maroc ↔ Côte d’Ivoire).</li>
            <li>Le transfert des risques intervient à la remise au Client (ou au point relais). Vérifiez l’état du colis à réception et signalez toute anomalie selon la Politique de retour.</li>
          </ul>
        </Card>

        <Card title="7. Modèle opérationnel et responsabilité">
          <ul className="text-muted mb-0">
            <li>Chaque Vendeur ou Fournisseur référencé est responsable de la conformité, de la qualité et de la sécurité des produits qu’il propose, sans préjudice des garanties légales applicables au Client.</li>
            <li>duumini supervise le référencement (standards qualité, traçabilité, conditions de conservation) et reste le point de contact unique du Client pour la commande, le paiement, la facturation et le service après-vente, y compris lorsque le produit provient d’un Vendeur ou Fournisseur situé dans un autre pays du réseau duumini.</li>
          </ul>
        </Card>

        <Card title="8. Contenus et avis">
          <p className="text-muted mb-0">
            Les avis publiés doivent refléter une expérience réelle et respecter la loi. duumini se réserve le droit de modérer
            ou retirer tout contenu illicite (diffamatoire, haineux, contrefaisant, etc.).
          </p>
        </Card>

        <Card title="9. Propriété intellectuelle">
          <p className="text-muted mb-0">
            Le Site et ses éléments (textes, logos, chartes graphiques, photos) sont protégés. Toute reproduction non autorisée est interdite.
          </p>
        </Card>

        <Card title="10. Interdictions">
          <ul className="text-muted mb-0">
            <li>Utilisation du Site à des fins illégales, contrefaisantes, frauduleuses ou nuisibles à la Plateforme.</li>
            <li>Produits interdits (exemples) : substances illicites, médicaments sur prescription, armes, produits dangereux, espèces protégées, produits volés, contenus haineux/pornographiques, etc.</li>
          </ul>
        </Card>

        <Card title="11. Garanties légales">
          <p className="text-muted mb-0">
            Les produits bénéficient des garanties légales applicables (défaut de conformité, vices cachés) et des garanties commerciales éventuelles.
          </p>
        </Card>

        <Card title="12. Limitation de responsabilité">
          <p className="text-muted mb-0">
            duumini ne saurait être tenue responsable des dommages indirects.
          </p>
        </Card>

        <Card title="13. Données personnelles et cookies">
          <p className="text-muted mb-0">
            Le traitement des données est régi par la Politique de confidentialité disponible sur le Site. Les réglages cookies sont accessibles via le bandeau dédié.
          </p>
        </Card>

        <Card title="14. Droit applicable – Juridiction compétente">
          <p className="text-muted mb-0">
            Les CGU sont soumises au droit marocain. Tout litige relèvera des tribunaux compétents du ressort du siège de duumini, sauf disposition d’ordre public contraire.
          </p>
        </Card>

        <Card title="15. Modifications">
          <p className="text-muted mb-0">
            duumini peut modifier les CGU ; la version applicable est celle en vigueur lors de la commande ou de l’utilisation du Site.
          </p>
        </Card>

        <ContactFooter />
      </div>
    </section>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h2 className="h6 mb-2" style={{ color: "var(--duu-black)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ContactFooter() {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h2 className="h6 mb-1" style={{ color: "var(--duu-black)" }}>Contact</h2>
          <p className="text-muted mb-0">
            <a href="mailto:admin@duumini.com">admin@duumini.com</a> • WhatsApp :{" "}
            <a href="https://wa.me/212623677884" target="_blank" rel="noopener noreferrer">+212 623 677 884</a>
          </p>
        </div>
        <div className="d-flex gap-2">
          <a className="btn btn-duu btn-sm" href="mailto:admin@duumini.com">Écrire un e-mail</a>
          <a className="btn btn-outline-dark btn-sm" href="https://wa.me/212623677884" target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
