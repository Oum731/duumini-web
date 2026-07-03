// src/pages/home/HeroSection.tsx
import { Link } from "react-router-dom";

// L'image contient déjà le titre, le texte, les statistiques et les
// cartes du hero (voir public/hero-stats.png, recadré depuis page.png) —
// on ne recrée pas ce texte en HTML, on superpose uniquement des zones
// cliquables réelles (transparentes) aux endroits des actions visibles.
const HERO_IMAGE = "/hero-stats.png";

// Positions en pourcentage de l'image (1510×545), pour rester alignées
// quelle que soit la largeur d'écran puisque l'image garde son ratio.
const HOTSPOTS: {
  to: string;
  label: string;
  top: string;
  left: string;
  width: string;
  height: string;
}[] = [
  {
    to: "/solutions",
    label: "Découvrir",
    top: "56.5%",
    left: "8.4%",
    width: "7.8%",
    height: "9.5%",
  },
  {
    to: "/contact?intent=join",
    label: "Rejoindre DUUMINI",
    top: "56.5%",
    left: "16.9%",
    width: "12.4%",
    height: "9.5%",
  },
  {
    to: "/pays",
    label: "Découvrir les corridors",
    top: "72%",
    left: "75.8%",
    width: "8%",
    height: "5.5%",
  },
];

export default function HeroSection() {
  return (
    <section className="position-relative">
      <img
        src={HERO_IMAGE}
        alt="Le commerce africain sans frontières. DUUMINI connecte les producteurs, commerçants et consommateurs à travers l'Afrique. Corridor actuel : Maroc ↔ Côte d'Ivoire. +1 000 produits authentiques disponibles, +500 vendeurs et producteurs partenaires, +10 000 clients satisfaits à travers le Maroc."
        className="w-100"
        style={{ display: "block" }}
      />

      {HOTSPOTS.map((h) => (
        <Link
          key={h.label}
          to={h.to}
          aria-label={h.label}
          className="position-absolute"
          style={{
            top: h.top,
            left: h.left,
            width: h.width,
            height: h.height,
          }}
        />
      ))}
    </section>
  );
}
