// src/pages/home/HowItWorksSection.tsx
import { HOW_IT_WORKS_STEPS } from "./data";

const EMPHASIS_COLOR: Record<string, string> = {
  orange: "var(--duu-orange)",
  green: "var(--duu-green)",
};
const EMPHASIS_BG: Record<string, string> = {
  orange: "rgba(var(--duu-orange-rgb), .14)",
  green: "rgba(var(--duu-green-rgb), .14)",
};

export default function HowItWorksSection() {
  return (
    <section className="container-xxl py-5">
      <h2 className="fw-bold mb-4">Comment ça fonctionne ?</h2>

      <div className="row g-4 g-lg-0 align-items-start">
        {HOW_IT_WORKS_STEPS.map((step, i) => {
          const Icon = step.icon;
          const circleBg = step.emphasis ? EMPHASIS_BG[step.emphasis] : "rgba(17,17,17,.06)";
          const iconColor = step.emphasis ? EMPHASIS_COLOR[step.emphasis] : "var(--duu-black)";
          const titleColor = step.emphasis ? EMPHASIS_COLOR[step.emphasis] : "var(--duu-black)";

          return (
            <div className="col-12 col-lg-3 position-relative" key={step.title}>
              {i < HOW_IT_WORKS_STEPS.length - 1 && (
                <div
                  className="d-none d-lg-block position-absolute"
                  style={{
                    top: 30,
                    left: "calc(50% + 40px)",
                    right: "calc(-50% + 40px)",
                    borderTop: "2px dashed rgba(0,0,0,.2)",
                  }}
                  aria-hidden="true"
                />
              )}

              <div className="d-flex flex-column align-items-center text-center px-2">
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: circleBg,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <Icon size={26} color={iconColor} />
                </div>
                <div className="fw-bold mb-1" style={{ color: titleColor }}>
                  {step.title}
                </div>
                <div className="text-muted small">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
