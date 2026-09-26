// src/pages/Home.tsx
import { Seo } from "../components/Seo";
import HeroSection from "./home/HeroSection";
import CategoryHighlightsSection from "./home/CategoryHighlightsSection";
import PersonasSection from "./home/PersonasSection";
import BuyingPathsSection from "./home/BuyingPathsSection";
import MissionSection from "./home/MissionSection";
import CategoriesSection from "./home/CategoriesSection";
import PopularProductsSection from "./home/PopularProductsSection";
import HowItWorksSection from "./home/HowItWorksSection";
import WhyDuuminiSection from "./home/WhyDuuminiSection";
import PartnersSection from "./home/PartnersSection";
import FinalCtaSection from "./home/FinalCtaSection";

export default function Home() {
  return (
    // ✅ Refonte 2026 (phase 2) : nouveau design system (theme.css) scopé à
    // l'accueil via .dz-body — fond crème + typographie Work Sans/Fraunces —
    // sans toucher au Navbar/Footer globaux ni aux autres pages.
    <div className="dz-body" style={{ background: "var(--dz-paper)" }}>
      <Seo
        title="Produits subsahariens et africains authentiques au Maroc"
        description="Attiéké, placali, épicerie et produits subsahariens et africains authentiques livrés au Maroc. DUUMINI connecte producteurs, commerçants et consommateurs entre le Maroc et la Côte d'Ivoire."
        path="/"
      />
      <HeroSection />
      <CategoryHighlightsSection />
      <CategoriesSection />
      <PopularProductsSection />
      <PersonasSection />
      <BuyingPathsSection />
      <MissionSection />
      <HowItWorksSection />
      <WhyDuuminiSection />
      <PartnersSection />
      <FinalCtaSection />
    </div>
  );
}
