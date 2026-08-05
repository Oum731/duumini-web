// src/pages/home/CourierCtaSection.tsx
// Bannière distincte de la persona "Livreur" (data.ts, qui cible les
// candidats voulant devenir livreur) — celle-ci cible les visiteurs qui
// veulent commander une course, sans compte requis (voir App.tsx :
// /courses/nouvelle est public, CourierBookingPage.tsx gère le cas invité).
import { Link } from "react-router-dom";
import { Bike } from "lucide-react";

export default function CourierCtaSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div
        className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 p-4 p-md-5"
        style={{
          borderRadius: "var(--duu-radius-xl)",
          background: "var(--duu-green)",
        }}
      >
        <div className="text-center text-md-start">
          <div className="d-flex align-items-center justify-content-center justify-content-md-start gap-2 mb-2">
            <Bike size={28} color="#fff" />
            <h2 className="fw-bold m-0" style={{ color: "#fff" }}>
              Besoin d'un livreur ?
            </h2>
          </div>
          <p className="mb-0" style={{ color: "#fff", opacity: 0.9 }}>
            Un colis à récupérer ou à envoyer ? Commandez une course DUUMINI —
            aucun compte requis, juste votre numéro de téléphone.
          </p>
        </div>
        <Link to="/courses/nouvelle" className="btn btn-duu btn-lg flex-shrink-0">
          Commander une course
        </Link>
      </div>
    </section>
  );
}
