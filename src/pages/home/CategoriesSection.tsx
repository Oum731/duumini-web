// src/pages/home/CategoriesSection.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, type LucideIcon } from "lucide-react";
import { listCategories, type Category, type Vertical } from "../../services/categories";

const VERTICAL_PATH: Record<Vertical, string> = {
  FOOD: "/african-food",
  MARKET: "/african-market",
  FASHION: "/fashion",
};

function categoryHref(c: Category) {
  const base = VERTICAL_PATH[c.vertical || "MARKET"];
  return `${base}/${c.slug}`;
}

function FallbackIcon({ icon: Icon = ShoppingBag }: { icon?: LucideIcon }) {
  return <Icon size={22} color="var(--duu-green)" />;
}

/** Tire une photo au hasard dans le pool de la catégorie (mode aléatoire),
 * sinon retombe sur l'image fixe, sinon aucune (icône de repli). */
function pickDisplayImage(c: Category): string | null {
  const pool = (c.image_urls || []).filter(Boolean);
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return c.image_url || null;
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  // Tirage figé au chargement de la page (pas remixé à chaque re-render).
  const [displayImages, setDisplayImages] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listCategories({ pageSize: 50 });
        if (cancelled) return;
        const populated = (res.items || []).filter((c) => Number(c.product_count || 0) > 0);
        setCategories(populated);
        setDisplayImages(
          Object.fromEntries(populated.map((c) => [c.id, pickDisplayImage(c)]))
        );
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && categories.length === 0) return null;

  return (
    <section className="container-xxl py-4 py-md-5">
      <h2 className="fw-bold mb-4">Nos catégories</h2>

      <div className="row g-3">
        {(loading ? Array.from({ length: 3 }) : categories).map((c, i) => {
          const cat = c as Category | undefined;
          return (
            <div className="col-4 col-md-2" key={cat?.id ?? i}>
              <Link
                to={cat ? categoryHref(cat) : "#"}
                className="d-flex flex-column align-items-center text-center text-decoration-none p-3"
                style={{
                  borderRadius: "var(--duu-radius-lg)",
                  background: "#fff",
                  boxShadow: "var(--duu-shadow-sm)",
                  color: "var(--duu-black)",
                  visibility: loading ? "hidden" : "visible",
                }}
              >
                <div
                  className="d-flex align-items-center justify-content-center mb-2 overflow-hidden"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(var(--duu-green-rgb), .12)",
                  }}
                >
                  {cat && displayImages[cat.id] ? (
                    <img
                      src={displayImages[cat.id] as string}
                      alt={cat.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                  ) : (
                    <FallbackIcon />
                  )}
                </div>
                <div className="small fw-semibold">{cat?.name || ""}</div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
