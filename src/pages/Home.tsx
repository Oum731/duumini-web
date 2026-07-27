// src/pages/Home.tsx
import { Seo } from "../components/Seo";
import HeroSection from "./home/HeroSection";
import PersonasSection from "./home/PersonasSection";
import MissionSection from "./home/MissionSection";
import CategoriesSection from "./home/CategoriesSection";
import HowItWorksSection from "./home/HowItWorksSection";
import WhyDuuminiSection from "./home/WhyDuuminiSection";
import PartnersSection from "./home/PartnersSection";
import FinalCtaSection from "./home/FinalCtaSection";

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
      <MissionSection />
      <CategoriesSection />
      <HowItWorksSection />
      <WhyDuuminiSection />
      <PartnersSection />
      <FinalCtaSection />
    </>
  );
}
