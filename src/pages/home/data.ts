// src/pages/home/data.ts
import {
  UserRound,
  Briefcase,
  Leaf,
  Globe2,
  Smartphone,
  Package,
  Truck,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

export type PersonaKey = "diaspora" | "entreprises" | "producteurs" | "importateurs";

export type Persona = {
  key: PersonaKey;
  icon: LucideIcon;
  title: string;
  description: string;
  tint: "orange" | "green";
  photo: string;
  detail: string[];
};

export const PERSONAS: Persona[] = [
  {
    key: "diaspora",
    icon: UserRound,
    title: "Diaspora & communautés africaines",
    description: "Accédez aux produits qui circulent d'un pays africain à l'autre, où que vous soyez.",
    tint: "orange",
    photo:
      "https://images.unsplash.com/photo-1752070182361-9fa562ed7f97?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Attiéké, placali, huile de palme, épices, produits cosmétiques traditionnels : DUUMINI fait circuler ces produits entre pays africains, pas seulement du pays d'origine vers vous.",
      "Chaque commande s'appuie sur le même réseau de vendeurs et fournisseurs vérifiés que celui utilisé par les entreprises et importateurs — vous profitez de la même interconnexion panafricaine.",
    ],
  },
  {
    key: "entreprises",
    icon: Briefcase,
    title: "Entreprises",
    description: "Développez votre activité grâce à notre réseau et nos solutions B2B.",
    tint: "green",
    photo:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Sourcez des produits africains authentiques auprès de fournisseurs vérifiés, sans avoir à gérer vous-même la logistique transfrontalière.",
      "Que vous soyez restaurateur, épicier ou distributeur, DUUMINI vous met en relation directe avec des producteurs et grossistes du corridor Maroc–Côte d'Ivoire.",
    ],
  },
  {
    key: "producteurs",
    icon: Leaf,
    title: "Producteurs",
    description: "Vendez vos produits à de nouveaux marchés en toute simplicité.",
    tint: "orange",
    photo:
      "https://images.unsplash.com/photo-1741874299706-2b8e16839aaa?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Publiez votre catalogue et touchez des acheteurs professionnels en dehors de votre marché local, sans avoir à investir dans votre propre logistique export.",
      "DUUMINI s'occupe du transport et de la mise en relation ; vous suivez chaque commande et chaque paiement depuis votre tableau de bord.",
    ],
  },
  {
    key: "importateurs",
    icon: Globe2,
    title: "Importateurs",
    description: "Accédez à une centrale d'achat fiable et compétitive à travers l'Afrique.",
    tint: "green",
    photo:
      "https://images.unsplash.com/photo-1773126378915-793b5c48fb38?w=200&h=200&fit=crop&q=80&auto=format",
    detail: [
      "Approvisionnez-vous auprès de plusieurs fournisseurs vérifiés à travers un point d'entrée unique, avec un suivi de commande transparent de bout en bout.",
      "Le corridor Maroc–Côte d'Ivoire est le premier maillon d'un réseau destiné à s'étendre à toute la zone CEDEAO.",
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
