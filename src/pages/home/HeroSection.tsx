// src/pages/home/HeroSection.tsx
import { Link } from "react-router-dom";
import NetworkIllustration from "./NetworkIllustration";

export default function HeroSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div className="row align-items-center g-4 g-lg-5">
        <div className="col-12 col-lg-6">
          <h1
            className="fw-bold mb-3"
            style={{ fontSize: "clamp(2rem, 4.5vw, 2.9rem)", lineHeight: 1.15 }}
          >
            Le pont commercial entre l'Afrique et ses diasporas.
          </h1>

          <p className="text-muted mb-4" style={{ fontSize: "1.05rem", maxWidth: 520 }}>
            DUUMINI connecte producteurs, revendeurs et consommateurs à travers
            l'Afrique. Corridor actuel : Maroc ↔ Côte d'Ivoire, avec l'ambition
            de s'étendre à tout le continent.
          </p>

          <div className="d-flex flex-wrap gap-3">
            <Link to="/solutions" className="btn btn-duu-orange btn-lg">
              Découvrir nos solutions
            </Link>
            <Link to="/african-market" className="btn btn-outline-dark btn-lg">
              Explorer le catalogue
            </Link>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            <NetworkIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
