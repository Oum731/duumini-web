// src/pages/home/HeroSection.tsx
import { Link } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";

const TRUST_ITEMS = [
  "Paiement à la livraison",
  "Produits authentiques",
  "Vendeurs vérifiés",
];

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1741874299706-2b8e16839aaa?w=900&h=900&fit=crop&q=80&auto=format";

export default function HeroSection() {
  return (
    <section style={{ width: "100%", background: "var(--duu-green)" }}>
      <div className="container-xxl py-5">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-12 col-lg-6">
            <div
              className="dz-badge dz-badge-terracotta mb-3"
              style={{ width: "fit-content" }}
            >
              <Sparkles size={13} />
              Produits subsahariens authentiques, livrés au Maroc
            </div>

            <h1
              className="dz-display fw-semibold mb-3"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.1rem)", lineHeight: 1.1, color: "#fff" }}
            >
              Le goût de l'Afrique,
              <br />
              livré <span style={{ color: "var(--duu-orange)" }}>partout au Maroc</span>
            </h1>

            <p className="mb-4" style={{ fontSize: "1.05rem", maxWidth: 520, color: "rgba(255,255,255,.8)" }}>
              Épicerie, mode et cosmétique subsahariens et africains authentiques.
              DUUMINI connecte producteurs, revendeurs et consommateurs entre le
              Maroc et la Côte d'Ivoire — commandez en ligne, payez à la livraison.
            </p>

            <div className="d-flex flex-wrap gap-3 mb-4">
              <Link to="/catalogue" className="dz-btn" style={{ background: "var(--duu-orange)", color: "#fff" }}>
                Découvrir le catalogue
              </Link>
              <Link
                to="/solutions"
                className="dz-btn"
                style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,.6)", color: "#fff" }}
              >
                Nos solutions
              </Link>
            </div>

            <div className="d-flex flex-wrap gap-4">
              {TRUST_ITEMS.map((t) => (
                <div
                  key={t}
                  className="d-flex align-items-center gap-2"
                  style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,.8)" }}
                >
                  <CheckCircle2 size={17} color="var(--duu-orange)" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div
              style={{
                maxWidth: 460,
                margin: "0 auto",
                background: "#fff",
                padding: 12,
                borderRadius: "var(--dz-radius-xl)",
                boxShadow: "var(--dz-shadow-lg)",
              }}
            >
              <img
                src={HERO_IMAGE}
                alt="Assortiment de produits africains authentiques prêts à être expédiés vers le Maroc"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: "var(--dz-radius-lg)",
                }}
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
