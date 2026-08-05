// src/pages/solutions/content.ts
import type { PersonaKey } from "../home/data";

export type FaqItem = { q: string; a: string };

export type SolutionContent = {
  benefits: string[];
  services: string[];
  faq: FaqItem[];
};

export const SOLUTIONS_CONTENT: Record<PersonaKey, SolutionContent> = {
  fournisseur: {
    benefits: [
      "Accédez à de nouveaux marchés sans investir dans votre propre logistique export.",
      "Vendez à des acheteurs professionnels vérifiés (revendeurs, distributeurs).",
      "Suivez chaque commande et chaque paiement depuis un tableau de bord dédié.",
      "Bénéficiez de l'accompagnement DUUMINI pour développer votre présence au Maroc.",
    ],
    services: [
      "Publication de catalogue produits (photos, descriptions, prix).",
      "Transport et logistique transfrontalière pris en charge par DUUMINI.",
      "Mise en relation directe avec des revendeurs et grossistes vérifiés.",
      "Suivi des commandes et des paiements en temps réel.",
    ],
    faq: [
      {
        q: "Quels types de produits puis-je vendre sur DUUMINI ?",
        a: "Alimentation, boissons, épices, cosmétique, artisanat, mode — tout produit africain authentique destiné aux marchés du corridor Maroc–Côte d'Ivoire.",
      },
      {
        q: "Comment DUUMINI gère-t-il le transport ?",
        a: "DUUMINI centralise, vérifie et prépare les commandes puis assure le transport sécurisé vers la destination.",
      },
      {
        q: "Comment rejoindre DUUMINI en tant que fournisseur ?",
        a: "Déposez une demande de partenariat via le formulaire ci-dessous ; notre équipe vous recontacte pour finaliser votre inscription.",
      },
      {
        q: "Y a-t-il des frais pour rejoindre DUUMINI ?",
        a: "Contactez notre équipe pour connaître les conditions actuelles, qui dépendent de votre profil et de vos volumes.",
      },
    ],
  },
  revendeur: {
    benefits: [
      "Sourcez des produits africains authentiques sans gérer vous-même la logistique transfrontalière.",
      "Accédez à plusieurs fournisseurs vérifiés via un point d'entrée unique.",
      "Élargissez votre offre avec de nouveaux produits régulièrement.",
      "Bénéficiez de conditions professionnelles adaptées à votre activité.",
    ],
    services: [
      "Catalogue fournisseurs consultable en ligne.",
      "Commande en ligne avec suivi en temps réel.",
      "Compte professionnel avec conditions dédiées.",
      "Livraison groupée et sécurisée.",
    ],
    faq: [
      {
        q: "Puis-je commander en petites quantités pour tester un produit ?",
        a: "Oui, DUUMINI propose des formats adaptés aux besoins des épiceries comme des grossistes.",
      },
      {
        q: "Comment obtenir un compte professionnel ?",
        a: "Faites une demande via le formulaire ci-dessous ; notre équipe valide votre profil et active votre accès.",
      },
      {
        q: "Quels délais de livraison ?",
        a: "Ils varient selon le corridor et le volume ; ils sont communiqués à la confirmation de commande.",
      },
      {
        q: "DUUMINI travaille-t-il avec les restaurants et hôtels ?",
        a: "Oui, DUUMINI accompagne épiceries, restaurants, hôtels, grossistes et distributeurs.",
      },
    ],
  },
  client: {
    benefits: [
      "Accédez à des produits africains authentiques, où que vous soyez.",
      "Achetez en toute confiance auprès de vendeurs vérifiés.",
      "Découvrez régulièrement de nouveaux produits et de nouvelles boutiques.",
      "Profitez d'un parcours d'achat simple, du panier à la livraison.",
    ],
    services: [
      "Catalogue en ligne avec recherche et filtres.",
      "Paiement et suivi de commande simplifiés.",
      "Livraison suivie jusqu'à votre porte.",
      "Support client par WhatsApp et email.",
    ],
    faq: [
      {
        q: "Comment savoir si un produit est authentique ?",
        a: "Chaque fiche produit précise l'origine et le vendeur ; DUUMINI travaille avec des fournisseurs et producteurs vérifiés.",
      },
      {
        q: "Quels sont les délais et frais de livraison ?",
        a: "Ils sont affichés avant la validation de votre commande, selon votre ville et le produit choisi.",
      },
      {
        q: "Puis-je payer à la livraison ?",
        a: "Les moyens de paiement disponibles sont indiqués au moment du paiement.",
      },
      {
        q: "Comment vous contacter en cas de problème ?",
        a: "Notre équipe est joignable par WhatsApp et email, ou via le formulaire ci-dessous.",
      },
    ],
  },
  partenaire: {
    benefits: [
      "Rejoignez l'infrastructure commerciale d'un corridor africain en pleine croissance.",
      "Identifiez des opportunités de collaboration concrètes (logistique, investissement, accompagnement).",
      "Bénéficiez d'un interlocuteur direct pour construire un partenariat sur mesure.",
      "Participez à l'extension du réseau DUUMINI à de nouveaux pays africains.",
    ],
    services: [
      "Échange dédié pour comprendre la vision et la feuille de route DUUMINI.",
      "Étude conjointe des opportunités de collaboration selon votre domaine.",
      "Mise en relation avec les équipes opérationnelles concernées.",
      "Suivi personnalisé du partenariat une fois engagé.",
    ],
    faq: [
      {
        q: "Quels types de partenaires DUUMINI recherche-t-il ?",
        a: "Investisseurs, logisticiens, institutions, incubateurs, distributeurs et organisations d'accompagnement.",
      },
      {
        q: "Comment se déroule une première prise de contact ?",
        a: "Vous nous laissez vos coordonnées via le formulaire ci-dessous, notre équipe vous recontacte pour un premier échange.",
      },
      {
        q: "DUUMINI est-il ouvert à d'autres corridors que Maroc–Côte d'Ivoire ?",
        a: "Oui, le corridor actuel est le premier maillon d'un réseau destiné à s'étendre à d'autres pays africains.",
      },
      {
        q: "Puis-je proposer un partenariat logistique ou technologique ?",
        a: "Oui, DUUMINI est ouvert à toute collaboration qui renforce son infrastructure commerciale.",
      },
    ],
  },
  livreur: {
    benefits: [
      "Acceptez des courses près de chez vous, selon votre disponibilité (moto, voiture ou vélo).",
      "Suivez vos courses et votre solde depuis votre espace livreur dédié.",
      "Rejoignez un réseau vérifié : chaque candidature est validée par DUUMINI avant activation.",
    ],
    services: [
      "Candidature en ligne avec pièce d'identité et photo.",
      "Validation en agence avec vos documents originaux.",
      "Espace livreur : courses disponibles, suivi en temps réel, règlement du solde.",
    ],
    faq: [
      {
        q: "Quels documents dois-je fournir ?",
        a: "Une pièce d'identité (photo ou scan) et une photo de vous, directement dans le formulaire de candidature.",
      },
      {
        q: "Puis-je accepter des courses tout de suite après ma candidature ?",
        a: "Non, vous devez d'abord vous présenter à l'agence DUUMINI avec vos documents originaux pour validation.",
      },
      {
        q: "Comment suis-je payé ?",
        a: "Votre solde est suivi dans votre espace livreur ; le règlement est effectué selon les modalités communiquées lors de votre validation.",
      },
    ],
  },
};
