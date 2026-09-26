// src/pages/home/CategoryHighlightsSection.tsx
import { Link } from "react-router-dom";

type Tile = {
  key: string;
  title: string;
  href: string;
  image: string;
  objectPosition?: string;
};

const TILES: Tile[] = [
  {
    key: "epicerie",
    title: "Épicerie africaine",
    href: "/african-market",
    image: "/market.png",
  },
  {
    key: "mode",
    title: "Mode & beauté",
    href: "/fashion",
    image:
      "https://images.unsplash.com/photo-1752070182361-9fa562ed7f97?w=480&h=480&fit=crop&q=80&auto=format",
  },
  {
    key: "cuisine",
    title: "Cuisine & ingrédients",
    href: "/african-food",
    image: "/food.png",
  },
  {
    key: "fournisseurs",
    title: "Nouveaux fournisseurs",
    href: "/vendeur/fournisseurs",
    image:
      "https://images.unsplash.com/photo-1741874299706-2b8e16839aaa?w=480&h=480&fit=crop&q=80&auto=format",
  },
];

export default function CategoryHighlightsSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div className="row g-3">
        {TILES.map((tile) => (
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
