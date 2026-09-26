// src/pages/home/CategoryHighlightsSection.tsx
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getCaps } from "../../utils/capabilities";

type Tile = {
  key: string;
  title: string;
  href: string;
  image: string;
  objectPosition?: string;
  proOnly?: boolean;
};

const TILES: Tile[] = [
  {
    key: "epicerie",
    title: "Duumini Market",
    href: "/african-market",
    image: "/products/attieke-market.jpg",
  },
  {
    key: "mode",
    title: "Duumini Fashion",
    href: "/fashion",
    image: "/fashion.jpg",
  },
  {
    key: "cuisine",
    title: "Duumini Food",
    href: "/african-food",
    image: "/food.png",
  },
  {
    key: "fournisseurs",
    title: "Nouveaux fournisseurs",
    href: "/vendeur/fournisseurs",
    image: "/fournisseur.jpg",
    proOnly: true,
  },
];

export default function CategoryHighlightsSection() {
  const { user } = useAuth();
  const isProReady = !!user && getCaps(user.role).canAccessPro;
  const isAdmin = !!user && getCaps(user.role).canAccessAdmin;
  const tiles = TILES.filter((t) => !t.proOnly || isProReady || isAdmin);

  return (
    <section className="container-xxl py-4 py-md-5">
      <div className="row g-3">
        {tiles.map((tile) => (
          <div className="col-6 col-md-3" key={tile.key}>
            <Link
              to={tile.href}
              className="dz-card d-block text-decoration-none p-3"
              style={{ color: "var(--dz-ink)" }}
            >
              <div
                style={{
                  height: 130,
                  borderRadius: "var(--dz-radius-lg)",
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <img
                  src={tile.image}
                  alt={tile.title}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: tile.objectPosition || "center",
                  }}
                />
              </div>
              <div className="fw-bold" style={{ fontSize: 14 }}>
                {tile.title}
              </div>
              <div className="small mt-1" style={{ color: "var(--dz-green)", fontWeight: 600 }}>
                Voir plus →
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
