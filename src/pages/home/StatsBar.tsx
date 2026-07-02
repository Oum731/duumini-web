// src/pages/home/StatsBar.tsx
import { STATS } from "./data";

const TINT_BG: Record<string, string> = {
  orange: "rgba(var(--duu-orange-rgb), .12)",
  green: "rgba(var(--duu-green-rgb), .12)",
  tan: "rgba(17,17,17, .06)",
};

const TINT_COLOR: Record<string, string> = {
  orange: "var(--duu-orange)",
  green: "var(--duu-green)",
  tan: "var(--duu-black)",
};

export default function StatsBar() {
  return (
    <div className="container-xxl" style={{ marginTop: -48, position: "relative", zIndex: 2 }}>
      <div
        className="bg-white row g-4 g-md-3 py-4 px-3 px-md-4 mx-0"
        style={{
          borderRadius: "var(--duu-radius-lg)",
          boxShadow: "var(--duu-shadow-lg)",
        }}
      >
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div className="col-12 col-md-4 d-flex align-items-center gap-3" key={s.label}>
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: TINT_BG[s.tint],
                }}
              >
                <Icon size={24} color={TINT_COLOR[s.tint]} />
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: "1.35rem" }}>
                  {s.value}
                </div>
                <div className="text-muted small">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
