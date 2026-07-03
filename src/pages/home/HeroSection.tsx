// src/pages/home/HeroSection.tsx
import { Link } from "react-router-dom";

// Isolé dans son propre composant pour pouvoir être remplacé par une autre
// photo de marque plus tard sans toucher au reste du hero.
function HeroVisual() {
  return (
    <div
      className="position-relative overflow-hidden"
      style={{
        aspectRatio: "930 / 345",
        borderRadius: "var(--duu-radius-xl)",
      }}
    >
      <img
        src="/hero-photo.png"
        alt="Une commerçante consulte son téléphone, entourée de produits africains, avec un avion et un conteneur DUUMINI en arrière-plan symbolisant le transport entre pays"
        className="w-100 h-100"
        style={{ objectFit: "cover" }}
        loading="lazy"
      />
    </div>
  );
}

export default function HeroSection() {
  return (
    <section
      style={{
        background: "linear-gradient(135deg, #FFF8ED, #FDECD8)",
      }}
    >
      <div className="container-xxl py-5">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-12 col-lg-6">
            <h1
              className="fw-bold mb-3"
              style={{ color: "var(--duu-green)", fontSize: "clamp(2rem, 4vw, 3rem)" }}
            >
              Le commerce africain sans frontières.
            </h1>
            <p className="text-muted mb-4" style={{ fontSize: "1.05rem" }}>
              DUUMINI connecte les producteurs, commerçants et consommateurs à
              travers l'Afrique.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/solutions" className="btn btn-duu-orange px-4">
                Découvrir
              </Link>
              <Link to="/contact?intent=join" className="btn btn-duu-green px-4">
                Rejoindre DUUMINI
              </Link>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="position-relative">
              <HeroVisual />

              <div
                className="position-absolute bg-white rounded-4 p-3 d-none d-md-block"
                style={{
                  top: 16,
                  right: 16,
                  maxWidth: 220,
                  boxShadow: "var(--duu-shadow-md)",
                }}
              >
                <div className="text-muted small mb-1">Corridor actuel</div>
                <div className="fw-bold small mb-2">
                  🇲🇦 Maroc ↔ Côte d'Ivoire 🇨🇮
                </div>
                <Link to="/pays" className="small fw-semibold text-decoration-none">
                  Découvrir les corridors →
                </Link>
              </div>

              <div
                className="position-absolute bg-white rounded-4 p-3 d-none d-md-block"
                style={{
                  bottom: -16,
                  left: -16,
                  maxWidth: 220,
                  boxShadow: "var(--duu-shadow-md)",
                }}
              >
                <div className="fw-semibold small mb-1">
                  Bientôt dans toute la CEDEAO
                </div>
                <div className="text-muted small">🇸🇳 🇨🇲 🇹🇳 🇳🇬 +15 pays</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
