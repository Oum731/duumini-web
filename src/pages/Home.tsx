// src/pages/Home.tsx
import HeroSection from "./home/HeroSection";
import StatsBar from "./home/StatsBar";
import PersonasSection from "./home/PersonasSection";
import HowItWorksSection from "./home/HowItWorksSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <PersonasSection />
      <HowItWorksSection />
    </>
  );
}
