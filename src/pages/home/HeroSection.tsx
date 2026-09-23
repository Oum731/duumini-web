// src/pages/home/HeroSection.tsx
import { Link } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { btnClass } from "../../components/ui/dzClass";

const TRUST_ITEMS = [
  "Paiement à la livraison",
  "Produits authentiques",
  "Vendeurs vérifiés",
];

export default function HeroSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
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
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.1rem)", lineHeight: 1.1, color: "var(--dz-ink)" }}
          >
            Le goût de l'Afrique,
            <br />
            livré <span style={{ color: "var(--dz-green)" }}>partout au Maroc</span>
          </h1>

          <p className="mb-4" style={{ fontSize: "1.05rem", maxWidth: 520, color: "var(--dz-ink-muted)" }}>
            Épicerie, mode et cosmétique subsahariens et africains authentiques.
            DUUMINI connecte producteurs, revendeurs et consommateurs entre le
            Maroc et la Côte d'Ivoire — commandez en ligne, payez à la livraison.
          </p>

          <div className="d-flex flex-wrap gap-3 mb-4">
            <Link to="/catalogue" className={btnClass("primary")}>
              Découvrir le catalogue
            </Link>
            <Link to="/solutions" className={btnClass("outline")}>
              Nos solutions
            </Link>
          </div>

          <div className="d-flex flex-wrap gap-4">
            {TRUST_ITEMS.map((t) => (
              <div
                key={t}
                className="d-flex align-items-center gap-2"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--dz-ink-muted)" }}
              >
                <CheckCircle2 size={17} color="var(--dz-green)" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            <img
              src="/market.png"
              alt="Assortiment de produits africains authentiques : riz, banane plantain, poisson fumé, arachides, mil, cubes d'assaisonnement"
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: "var(--dz-radius-xl)",
                boxShadow: "var(--dz-shadow-lg)",
              }}
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
