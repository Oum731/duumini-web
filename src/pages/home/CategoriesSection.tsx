// src/pages/home/CategoriesSection.tsx
import { Link } from "react-router-dom";
import { Wheat, CupSoda, Flame, Sparkles, Palette, Shirt, type LucideIcon } from "lucide-react";

type Category = { icon: LucideIcon; label: string; to: string };

const CATEGORIES: Category[] = [
  { icon: Wheat, label: "Alimentation", to: "/african-food" },
  { icon: CupSoda, label: "Boissons", to: "/african-food" },
  { icon: Flame, label: "Épices", to: "/african-food" },
  { icon: Sparkles, label: "Cosmétique", to: "/african-market" },
  { icon: Palette, label: "Artisanat", to: "/african-market" },
  { icon: Shirt, label: "Mode", to: "/fashion" },
];

export default function CategoriesSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <h2 className="fw-bold mb-4">Nos catégories</h2>

      <div className="row g-3">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <div className="col-4 col-md-2" key={c.label}>
              <Link
                to={c.to}
                className="d-flex flex-column align-items-center text-center text-decoration-none p-3"
                style={{
                  borderRadius: "var(--duu-radius-lg)",
                  background: "#fff",
                  boxShadow: "var(--duu-shadow-sm)",
                  color: "var(--duu-black)",
                }}
              >
                <div
                  className="d-flex align-items-center justify-content-center mb-2"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(var(--duu-green-rgb), .12)",
                  }}
                >
                  <Icon size={22} color="var(--duu-green)" />
                </div>
                <div className="small fw-semibold">{c.label}</div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
