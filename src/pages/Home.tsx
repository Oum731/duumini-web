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
        title="Produits africains authentiques en ligne au Maroc"
        description="Attiéké, placali, épicerie et produits africains authentiques livrés au Maroc. DUUMINI connecte producteurs, commerçants et consommateurs entre le Maroc et la Côte d'Ivoire."
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
