// src/pages/home/FinalCtaSection.tsx
import { Link } from "react-router-dom";
import { btnClass } from "../../components/ui/dzClass";

export default function FinalCtaSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div
        className="text-center p-4 p-md-5"
        style={{
          borderRadius: "var(--dz-radius-xl)",
          background: "var(--dz-green-dark)",
        }}
      >
        <h2 className="dz-display fw-semibold mb-2" style={{ color: "#fff" }}>
          Rejoignez DUUMINI
        </h2>
        <p className="mb-4" style={{ color: "rgba(255,255,255,.75)" }}>
          Fournisseur, revendeur, client ou partenaire : votre profil, votre
          parcours.
        </p>
        <Link
          to="/rejoindre"
          className={btnClass("outline")}
          style={{ borderColor: "#fff", color: "#fff" }}
        >
          Rejoindre DUUMINI
        </Link>
      </div>
    </section>
  );
}
