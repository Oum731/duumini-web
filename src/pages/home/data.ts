// src/pages/home/data.ts
import {
  Factory,
  ShoppingCart,
  ShoppingBag,
  Handshake,
  Smartphone,
  Package,
  Truck,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

export type PersonaKey = "fournisseur" | "revendeur" | "client" | "partenaire";

export type Persona = {
  key: PersonaKey;
  icon: LucideIcon;
  emoji: string;
  title: string;
  description: string;
  tint: "orange" | "green";
  photo: string;
  detail: string[];
};

export const PERSONAS: Persona[] = [
  {
    key: "fournisseur",
    icon: Factory,
    emoji: "🏭",
    title: "Fournisseur",
    description: "Producteurs, fabricants et marques africaines : développez votre présence au Maroc.",
    tint: "orange",
    photo:
      "https://images.unsplash.com/photo-1741874299706-2b8e16839aaa?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Publiez votre catalogue et touchez des acheteurs professionnels en dehors de votre marché local, sans avoir à investir dans votre propre logistique export.",
      "DUUMINI s'occupe du transport et de la mise en relation ; vous suivez chaque commande et chaque paiement depuis votre tableau de bord.",
    ],
  },
  {
    key: "revendeur",
    icon: ShoppingCart,
    emoji: "🛒",
    title: "Revendeur",
    description: "Épiceries, restaurants, hôtels, grossistes et distributeurs : approvisionnez-vous en toute confiance.",
    tint: "green",
    photo:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Sourcez des produits africains authentiques auprès de fournisseurs vérifiés, sans avoir à gérer vous-même la logistique transfrontalière.",
      "Que vous soyez restaurateur, épicier ou distributeur, DUUMINI vous met en relation directe avec des producteurs et grossistes du corridor Maroc–Côte d'Ivoire.",
    ],
  },
  {
    key: "client",
    icon: ShoppingBag,
    emoji: "🛍",
    title: "Client",
    description: "Consommateurs souhaitant acheter des produits africains authentiques, où que vous soyez.",
    tint: "orange",
    photo:
      "https://images.unsplash.com/photo-1752070182361-9fa562ed7f97?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Attiéké, placali, huile de palme, épices, produits cosmétiques traditionnels : DUUMINI fait circuler ces produits entre pays africains, pas seulement du pays d'origine vers vous.",
      "Chaque commande s'appuie sur le même réseau de vendeurs et fournisseurs vérifiés que celui utilisé par les revendeurs et partenaires — vous profitez de la même interconnexion panafricaine.",
    ],
  },
  {
    key: "partenaire",
    icon: Handshake,
    emoji: "🤝",
    title: "Partenaire",
    description: "Investisseurs, logisticiens, institutions et incubateurs : construisons ensemble l'infrastructure commerciale de demain.",
    tint: "green",
    photo:
      "https://images.unsplash.com/photo-1773126378915-793b5c48fb38?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "DUUMINI n'est pas une simple marketplace mais une infrastructure commerciale : nous cherchons des partenaires logistiques, institutionnels et financiers pour accompagner sa croissance.",
      "Que vous soyez investisseur, distributeur ou organisation d'accompagnement, prenez contact pour identifier ensemble les opportunités de collaboration autour du corridor Maroc–Côte d'Ivoire et de son extension à d'autres pays africains.",
    ],
  },
];

export type HowItWorksStep = {
  icon: LucideIcon;
  title: string;
  description: string;
  emphasis?: "orange" | "green";
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    icon: Smartphone,
    title: "Le vendeur publie",
    description: "Le vendeur ajoute ses produits sur la plateforme DUUMINI.",
  },
  {
    icon: Package,
    title: "DUUMINI centralise",
    description: "Nous centralisons, vérifions et préparons les commandes.",
    emphasis: "orange",
  },
  {
    icon: Truck,
    title: "Transport",
    description: "Nous assurons le transport sécurisé vers la destination.",
  },
  {
    icon: PackageCheck,
    title: "Livraison",
    description: "Le client reçoit sa commande rapidement et en toute sécurité.",
    emphasis: "green",
  },
];
