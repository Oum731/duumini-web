// src/pages/home/WhyDuuminiSection.tsx
import {
  Building2,
  Users,
  Truck as TruckIcon,
  HeartHandshake,
  MapPinned,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";

type Reason = { icon: LucideIcon; label: string; description: string };

const REASONS: Reason[] = [
  {
    icon: Building2,
    label: "Infrastructure commerciale",
    description: "Pas une simple marketplace : un réseau qui facilite l'accès au marché et la distribution.",
  },
  {
    icon: Users,
    label: "Réseau de partenaires",
    description: "Producteurs, revendeurs et institutions vérifiés, connectés sur tout le corridor.",
  },
  {
    icon: MapPinned,
    label: "Distribution",
    description: "Une chaîne de distribution pensée pour circuler entre pays africains, pas à sens unique.",
  },
  {
    icon: HeartHandshake,
    label: "Accompagnement",
    description: "Chaque profil est accompagné, de la mise en relation jusqu'au suivi de commande.",
  },
  {
    icon: TruckIcon,
    label: "Logistique",
    description: "Transport et préparation des commandes centralisés et sécurisés par DUUMINI.",
  },
  {
    icon: BadgeCheck,
    label: "Qualité",
    description: "Des produits authentiques, sourcés auprès de fournisseurs et producteurs vérifiés.",
  },
];

const STATS = [
  { value: "+1 000", label: "Produits authentiques disponibles" },
  { value: "+500", label: "Vendeurs et producteurs partenaires" },
  { value: "+10 000", label: "Clients satisfaits à travers le Maroc" },
];

export default function WhyDuuminiSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <h2 className="fw-bold mb-4">Pourquoi DUUMINI</h2>

      <div className="row g-3 mb-5">
        {REASONS.map((r) => {
          const Icon = r.icon;
          return (
            <div className="col-12 col-md-6 col-lg-4" key={r.label}>
              <div
                className="h-100 p-3 p-md-4"
                style={{
                  borderRadius: "var(--duu-radius-lg)",
                  background: "#fff",
                  boxShadow: "var(--duu-shadow-sm)",
                }}
              >
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(var(--duu-orange-rgb), .14)",
                  }}
                >
                  <Icon size={22} color="var(--duu-orange)" />
                </div>
                <div className="fw-bold mb-1">{r.label}</div>
                <div className="text-muted small">{r.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="row g-3 g-md-4 text-center p-4 p-md-5"
        style={{
          borderRadius: "var(--duu-radius-xl)",
          background: "var(--duu-black)",
        }}
      >
        {STATS.map((s) => (
          <div className="col-12 col-md-4" key={s.label}>
            <div
              className="fw-bold"
              style={{ fontSize: "2rem", color: "var(--duu-yellow)" }}
            >
              {s.value}
            </div>
            <div className="small" style={{ color: "rgba(255,255,255,.75)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
