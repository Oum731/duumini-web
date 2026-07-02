// src/pages/legal/PrivacyPolicy.tsx
export default function PrivacyPolicy() {
  return (
    <section className="container-xxl py-4">
      <header className="mb-3">
        <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>
          Politique de confidentialité (Confidentialité du traitement des données)
        </h1>
        <p className="text-muted mb-0">
          Dernière révision : 2 juillet 2026 (première publication : 30 octobre 2025)
        </p>
      </header>

      <div className="vstack gap-3">
        <Card title="0. Phase pilote (test)">
          <p className="text-muted mb-0">
            Pendant la phase pilote, duumini limite la collecte au strict nécessaire (prise de commande, livraison, support)
            et peut supprimer/anonymiser certaines données à l’issue du test. Les bases légales demeurent celles décrites
            ci-dessous (exécution du contrat, intérêts légitimes, consentement pour la prospection/cookies). Certaines
            fonctionnalités (ex. compte client, newsletters) peuvent être désactivées.
          </p>
        </Card>

        <Card title="1. Cadre légal">
          <p className="text-muted mb-0">
            Le traitement des données personnelles est réalisé conformément au droit marocain, notamment la loi 09-08 relative
            à la protection des personnes physiques à l’égard du traitement des données à caractère personnel et sous le
            contrôle de la CNDP (Commission Nationale de Contrôle de la Protection des Données à Caractère Personnel).
            Les échanges électroniques et signatures sont encadrés par la loi 53-05.
          </p>
        </Card>

        <Card title="2. Responsable de traitement">
          <ul className="text-muted mb-0">
            <li><strong>Responsable</strong> : DUUMINI</li>
            <li><strong>Contact</strong> : <a href="mailto:admin@duumini.com">admin@duumini.com</a> / +212 623 677 884</li>
          </ul>
        </Card>

        <Card title="3. Données collectées">
          <ul className="text-muted mb-0">
            <li><strong>Identification</strong> : nom, prénom, téléphone, email, adresse(s)</li>
            <li><strong>Compte</strong> : identifiants, préférences</li>
            <li><strong>Commande</strong> : produits, montants, adresses de livraison/facturation</li>
            <li><strong>Paiement</strong> : jetons/identifiants de transaction fournis par nos prestataires (duumini n’enregistre pas les numéros de carte en clair)</li>
            <li><strong>Navigation</strong> : cookies/traceurs (voir § 9)</li>
            <li><strong>Support</strong> : messages, enregistrements nécessaires au traitement de votre demande</li>
          </ul>
        </Card>

        <Card title="4. Finalités et bases légales">
          <ul className="text-muted mb-0">
            <li><strong>Exécution du contrat</strong> : gestion du compte, commandes, livraison, service après-vente</li>
            <li><strong>Intérêts légitimes</strong> : prévention de fraude, amélioration du Site, statistiques anonymisées, sécurité</li>
            <li><strong>Obligations légales</strong> : comptabilité, conservation de certaines pièces</li>
            <li><strong>Consentement</strong> : prospection commerciale par email/SMS, cookies non essentiels</li>
          </ul>
        </Card>

        <Card title="5. Destinataires">
          <ul className="text-muted mb-0">
            <li>Équipes internes habilitées</li>
            <li>Prestataires (paiement, logistique, hébergement, emailing, analytique) liés par contrat et obligations de confidentialité</li>
            <li>Vendeurs et fournisseurs partenaires : lorsque votre commande implique un vendeur ou un fournisseur d’un autre pays du réseau duumini (ex. corridor Maroc ↔ Côte d’Ivoire), les informations strictement nécessaires à l’exécution de la commande (nom, adresse de livraison, contenu de la commande) peuvent leur être transmises, dans les mêmes conditions de confidentialité.</li>
            <li>Autorités légalement habilitées</li>
          </ul>
        </Card>

        <Card title="6. Transferts internationaux">
          <p className="text-muted mb-0">
            duumini connecte des vendeurs, fournisseurs et clients situés dans plusieurs pays africains (aujourd’hui le
            Maroc et la Côte d’Ivoire, avec d’autres pays à venir). Lorsque des données sont hébergées, traitées ou
            transmises hors du Maroc dans ce cadre, duumini s’assure du respect des règles applicables (formalités
            CNDP, clauses contractuelles, encadrement du transfert) et met en place des garanties appropriées.
          </p>
        </Card>

        <Card title="7. Durées de conservation (principes)">
          <ul className="text-muted mb-0">
            <li><strong>Compte client</strong> : tant que le compte est actif, puis archivage légal (jusqu’à 5 ans à compter de la dernière activité)</li>
            <li><strong>Commandes/facturation</strong> : durée légale de conservation</li>
            <li><strong>Prospection</strong> : 3 ans à compter du dernier contact</li>
            <li><strong>Cookies</strong> : voir § 9</li>
          </ul>
        </Card>

        <Card title="8. Vos droits">
          <p className="text-muted mb-0">
            Conformément à la loi 09-08, vous disposez de droits d’accès, rectification, opposition, effacement, limitation,
            et portabilité lorsque applicable. Vous pouvez aussi définir des directives sur le sort de vos données.
            <br />
            <strong>Exercer vos droits</strong> : <a href="mailto:admin@duumini.com">admin@duumini.com</a> • Réclamation : auprès de la CNDP
          </p>
        </Card>

        <Card title="9. Cookies et traceurs">
          <ul className="text-muted mb-0">
            <li><strong>Essentiels</strong> : nécessaires au fonctionnement du Site (panier, session)</li>
            <li><strong>Mesure d’audience</strong> : statistiques anonymisées (opt-in/opt-out selon paramétrage)</li>
            <li><strong>Marketing</strong> : soumis à votre consentement préalable</li>
          </ul>
          <p className="text-muted mb-0 mt-2">
            Vous pouvez gérer vos choix via le bandeau cookies et les paramètres du navigateur. Le refus de certains cookies peut dégrader l’expérience.
          </p>
        </Card>

        <Card title="10. Sécurité">
          <p className="text-muted mb-0">
            Mesures organisationnelles et techniques (chiffrement en transit, cloisonnement, contrôle d’accès, journalisation,
            tests de sécurité) proportionnées aux risques. En cas d’incident majeur, nous informerons les personnes concernées
            et la CNDP si requis.
          </p>
        </Card>

        <Card title="11. Mineurs">
          <p className="text-muted mb-0">
            Le Site n’est pas destiné aux moins de 18 ans sans autorisation parentale. Nous ne collectons pas sciemment de données
            de mineurs sans consentement des titulaires de l’autorité parentale.
          </p>
        </Card>

        <Card title="12. Modifications">
          <p className="text-muted mb-0">
            Nous pouvons mettre à jour cette Politique. Toute version mise à jour sera publiée sur le Site avec sa date d’effet.
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
          <h2 className="h6 mb-1" style={{ color: "var(--duu-black)" }}>Vos droits & contact</h2>
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
