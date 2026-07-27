// src/pages/home/MissionSection.tsx
import { Factory, Route, ShoppingCart, ShoppingBag } from "lucide-react";

const STEPS = [
  { icon: Factory, label: "Les fournisseurs rejoignent DUUMINI" },
  { icon: Route, label: "DUUMINI facilite l'accès au marché" },
  { icon: ShoppingCart, label: "Les revendeurs s'approvisionnent" },
  { icon: ShoppingBag, label: "Les consommateurs achètent" },
];

export default function MissionSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div className="row">
        <div className="col-12 col-lg-8">
          <h2 className="fw-bold mb-3">Notre mission</h2>
          <p className="text-muted mb-4" style={{ maxWidth: 680 }}>
            DUUMINI construit l'infrastructure commerciale qui manque entre
            les marchés africains et leurs diasporas : un réseau où
            producteurs, revendeurs, partenaires et consommateurs
            s'approvisionnent et échangent en confiance, au-delà des
            frontières.
          </p>
        </div>
      </div>

      <div className="row g-3 g-lg-0 mt-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="col-6 col-lg-3 position-relative" key={s.label}>
              {i < STEPS.length - 1 && (
                <div
                  className="d-none d-lg-block position-absolute"
                  style={{
                    top: 26,
                    left: "calc(50% + 34px)",
                    right: "calc(-50% + 34px)",
                    borderTop: "2px dashed rgba(0,0,0,.2)",
                  }}
                  aria-hidden="true"
                />
              )}
              <div className="d-flex flex-column align-items-center text-center px-2">
                <div
                  className="d-flex align-items-center justify-content-center mb-2"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(var(--duu-orange-rgb), .14)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <Icon size={22} color="var(--duu-orange)" />
                </div>
                <div className="small fw-semibold">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
