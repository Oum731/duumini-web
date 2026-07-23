// src/pages/Home.tsx
import { Seo } from "../components/Seo";
import HeroSection from "./home/HeroSection";
import PersonasSection from "./home/PersonasSection";
import HowItWorksSection from "./home/HowItWorksSection";

export default function Home() {
  return (
    <>
      <Seo
        title="Le commerce africain sans frontières"
        description="DUUMINI connecte producteurs, commerçants et consommateurs à travers l'Afrique. Achetez et vendez des produits authentiques entre le Maroc et la Côte d'Ivoire, en toute confiance."
        path="/"
      />
      <HeroSection />
      <PersonasSection />
      <HowItWorksSection />
    </>
  );
}
