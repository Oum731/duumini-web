// src/pages/legal/ReturnsPolicy.tsx
export default function ReturnsPolicy() {
  return (
    <section className="container-xxl py-4">
      <header className="mb-3">
        <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>
          Politique de retour et d’annulation de commande
        </h1>
        <p className="text-muted mb-0">Dernière mise à jour : 30 octobre 2025</p>
      </header>

      <div className="vstack gap-3">
        <Card title="1. Droit de rétractation (ventes à distance)">
          <ul className="text-muted mb-0">
            <li>Le Client dispose d’un délai légal de 7 jours pour exercer son droit de rétractation à compter de la réception du bien (ou de l’acceptation de l’offre pour les services), sans avoir à justifier ni à payer de pénalités, hors frais de retour lorsque applicables.</li>
            <li><strong>Exceptions</strong> : notamment biens confectionnés selon les spécifications du Client ou nettement personnalisés, biens qui ne peuvent être réexpédiés ou susceptibles de se détériorer/perimer rapidement (ex. denrées fraîches/surgelées), enregistrements audio/vidéo/logiciels descellés, journaux/périodiques.</li>
          </ul>
        </Card>

        <Card title="2. Retours et remboursements">
          <ul className="text-muted">
            <li><strong>Éligibilité</strong> : produits non ouverts, non utilisés, dans leur emballage d’origine et en état de revente.</li>
            <li><strong>Procédure</strong> : (i) demande via votre compte ou email <a href="mailto:admin@duumini.com">admin@duumini.com</a> avec n° de commande ; (ii) réception d’un numéro de retour et des instructions ; (iii) renvoi du produit dans les 7 jours suivant l’acceptation.</li>
            <li><strong>Frais</strong> : sauf erreur de préparation ou produit défectueux, les frais de retour sont à la charge du Client.</li>
          </ul>
          <p className="text-muted mb-0">
            <strong>Remboursement</strong> : effectué sur le moyen de paiement d’origine dans les 7 jours suivant la réception/contrôle du retour.
          </p>
        </Card>

        <Card title="3. Produits non retournables (à titre indicatif)">
          <ul className="text-muted mb-0">
            <li>Produits alimentaires périssables (frais, surgelés, préparations sensibles)</li>
            <li>Produits à DLC courte une fois livrés</li>
            <li>Articles personnalisés</li>
            <li>Produits descellés pour des raisons d’hygiène (ex. cosmétiques ouverts)</li>
          </ul>
        </Card>

        <Card title="4. Retard de livraison">
          <p className="text-muted mb-0">
            Lorsque la date limite de livraison convenue est dépassée de 7 jours (hors force majeure), le Client peut
            résoudre de plein droit la commande relative au bien non livré, par notification écrite. Les sommes avancées
            sont remboursées sous 7 jours à compter de la réception de la notification par duumini.
          </p>
        </Card>

        <Card title="5. Conformité / Produit endommagé">
          <p className="text-muted mb-0">
            À la réception, signalez toute anomalie apparente (colis endommagé, manquant) dans un délai raisonnable avec
            photos. duumini organisera, selon les cas, un échange, un avoir, ou un remboursement.
          </p>
        </Card>

        <Card title="6. Annulation de commande">
          <ul className="text-muted mb-0">
            <li><strong>Avant</strong> déclenchement de l’achat auprès du commerce partenaire : annulation possible via le compte client ; remboursement intégral.</li>
            <li><strong>Après</strong> déclenchement de l’achat (produit réservé/acheté) : suivre la procédure de rétractation/retour lorsque applicable (voir § 1–3). Pour les denrées périssables, l’annulation peut ne pas être possible.</li>
          </ul>
        </Card>

        <Card title="7. Modalités pratiques">
          <ul className="text-muted mb-0">
            <li><strong>Adresse de retour</strong> : [Entrepôt duumini – adresse complète]</li>
            <li><strong>Contact</strong> : <a href="mailto:contact@duumini.com">contact@duumini.com</a> / +212 623 677 884</li>
          </ul>
        </Card>

        <Card title="8. Litiges">
          <p className="text-muted mb-0">
            La présente Politique est régie par le droit marocain. En cas de litige, une solution amiable sera recherchée
            avant toute action. À défaut, les tribunaux compétents du ressort du siège de duumini seront saisis, sans priver
            le consommateur des règles d’ordre public protectrices.
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
          <h2 className="h6 mb-1" style={{ color: "var(--duu-black)" }}>Support</h2>
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
