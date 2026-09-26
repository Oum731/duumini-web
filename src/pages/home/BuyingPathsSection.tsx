// src/pages/home/BuyingPathsSection.tsx
import { Link } from "react-router-dom";
import { ShoppingBag, ShoppingCart, Warehouse, type LucideIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getCaps } from "../../utils/capabilities";

type BuyingPath = {
  key: string;
  icon: LucideIcon;
  tint: "orange" | "green";
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export default function BuyingPathsSection() {
  const { user } = useAuth();
  const isProReady = !!user && getCaps(user.role).canAccessPro;

  const paths: BuyingPath[] = [
    {
      key: "particulier",
      icon: ShoppingBag,
      tint: "orange",
      title: "Vous êtes un particulier",
      description:
        "Achetez directement nos produits africains authentiques — épicerie, mode, cosmétiques — livrés au Maroc.",
      ctaLabel: "Découvrir le catalogue",
      ctaHref: "/african-market",
    },
    {
      key: "revendeur",
      icon: ShoppingCart,
      tint: "green",
      title: "Vous êtes revendeur",
      description:
        "Épicerie, restaurant, boutique : approvisionnez-vous en gros auprès de nos fournisseurs vérifiés pour réapprovisionner votre stock.",
      ctaLabel: isProReady ? "Accéder au catalogue fournisseurs" : "Devenir revendeur",
      ctaHref: isProReady ? "/vendeur/fournisseurs" : "/rejoindre?type=revendeur",
    },
    {
      key: "grossiste",
      icon: Warehouse,
      tint: "orange",
      title: "Vous achetez en gros ou à l'export",
      description:
        "Grossistes, importateurs, distributeurs : accédez à notre catalogue professionnel à tarifs négociés, sur invitation.",
      ctaLabel: "Accéder au catalogue B2B",
      ctaHref: "/partenaires/catalogue",
    },
  ];

  return (
    <section className="container-xxl py-4 py-md-5">
      <h2 className="dz-display fw-semibold mb-1" style={{ color: "var(--dz-ink)" }}>
        Trois façons d'acheter sur DUUMINI
      </h2>
      <p className="mb-4" style={{ maxWidth: 620, color: "var(--dz-ink-muted)" }}>
        Particulier, revendeur ou grossiste : DUUMINI vous oriente vers le parcours
        d'achat qui correspond à votre besoin.
      </p>

      <div className="row g-3">
        {paths.map((path) => {
          const Icon = path.icon;
          const iconBg =
            path.tint === "orange"
              ? "rgba(var(--duu-orange-rgb), .14)"
              : "rgba(var(--duu-green-rgb), .14)";
          const iconColor = path.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)";

          return (
            <div className="col-12 col-md-4" key={path.key}>
              <div className="dz-card h-100 d-flex flex-column p-3 p-md-4">
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: iconBg,
                  }}
                  aria-hidden="true"
                >
                  <Icon size={26} color={iconColor} />
                </div>

                <div className="fw-bold mb-1" style={{ color: "var(--duu-black)" }}>
                  {path.title}
                </div>
                <div className="text-muted small flex-grow-1 mb-3">{path.description}</div>

                <Link
                  to={path.ctaHref}
                  className="dz-btn align-self-start"
                  style={{ background: "var(--duu-orange)", color: "#fff" }}
                >
                  {path.ctaLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
