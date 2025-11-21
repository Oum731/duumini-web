// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Bell } from "lucide-react";
import InstallPWA from "../components/InstallPWA";
import { listProducts, type Product } from "../services/products";
import { API_BASE } from "../services/http";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

/* === Bandeau hors-ligne (écoute online/offline) === */
function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="alert alert-warning rounded-0 m-0 text-center small">
      Vous êtes hors-ligne. Certaines images ou données récentes peuvent ne pas
      s’afficher.
    </div>
  );
}

/* === Carte catégorie avec carrousel auto d’images produits === */
function CategoryCard(props: { to: string; title: string; images: string[] }) {
  const { to, title, images } = props;

  const hasMany = images && images.length > 1;
  const [index, setIndex] = useState(0);

  const currentImg =
    images && images.length > 0 ? images[index] : "/placeholder-category.png";

  // Carrousel auto (toutes les 2,5s)
  useEffect(() => {
    if (!hasMany) return;

    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 2500);

    return () => {
      window.clearInterval(id);
    };
  }, [hasMany, images.length]);

  // Pré-chargement des images pour éviter les flashs
  useEffect(() => {
    images.forEach((src) => {
      if (!src) return;
      const i = new Image();
      i.src = src;
    });
  }, [images]);

  return (
    <div className="col-12 col-md-6">
      <Link
        to={to}
        className="text-decoration-none d-block h-100"
        aria-label={`Aller à ${title}`}
      >
        <div className="card border-0 shadow-sm h-100 overflow-hidden">
          <div className="position-relative ratio ratio-16x9">
            {currentImg && (
              <img
                src={currentImg}
                alt={title}
                width={1280}
                height={720}
                className="w-100 h-100 object-fit-cover"
                loading="lazy"
                decoding="async"
              />
            )}

            {/* Overlay texte centré sur l'image */}
            <div
              className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-center text-white px-3"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.7))",
              }}
            >
              <h3 className="h4 mb-1 fw-semibold">{title}</h3>
              <div className="d-flex align-items-center gap-1 small opacity-75">
                <span>Découvrir la sélection</span>
                <ChevronRight size={16} aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* === CTA Notifications (optionnel, utile en PWA) === */
function NotificationsCTA() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied"
  );
  if (!supported || perm !== "default") return null;

  return (
    <div className="card border-0 shadow-sm mt-3">
      <div className="card-body d-flex flex-column flex-lg-row align-items-lg-center gap-2">
        <div className="flex-grow-1">
          <div className="fw-semibold d-flex align-items-center gap-2">
            <Bell size={18} aria-hidden="true" />
            Activer les notifications
          </div>
          <div className="small text-muted">
            Pour suivre vos commandes et recevoir nos alertes importantes.
          </div>
        </div>
        <button
          className="btn btn-outline-dark"
          onClick={async () => {
            try {
              const res = await Notification.requestPermission();
              setPerm(res);
            } catch {
              // ignore
            }
          }}
        >
          Autoriser
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [foodImages, setFoodImages] = useState<string[]>([]);
  const [marketImages, setMarketImages] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      try {
        setLoadingProducts(true);

        // On récupère une liste de produits (adapter les paramètres si besoin)
        const res = await (listProducts as any)({
          page: 1,
          pageSize: 50,
        });
        const data = (res as any).data ?? res;
        const items: Product[] = data.items ?? data;

        if (!items || !Array.isArray(items)) return;
        if (cancelled) return;

        // On ne garde que les produits actifs (comme dans ProductCard)
        const active = items.filter((p: any) => {
          const isActive =
            (p.is_active ?? p.active ?? 1) &&
            (p.stock === undefined || p.stock !== 0);
          return !!isActive;
        });

        const toImageUrl = (p: Product): string => {
          const raw = p.cover || p.images?.[0]?.url || null;
          return imgUrl(raw);
        };

        const food = active.filter(
          (p) => (p.sub_category || "").toLowerCase() === "food"
        );
        const market = active.filter(
          (p) => (p.sub_category || "").toLowerCase() !== "food"
        );

        const uniq = (arr: string[]) =>
          Array.from(new Set(arr.filter(Boolean)));

        const foodImgs = uniq(food.map(toImageUrl)).slice(0, 20);
        const marketImgs = uniq(market.map(toImageUrl)).slice(0, 20);

        if (!cancelled) {
          setFoodImages(foodImgs);
          setMarketImages(marketImgs);
        }
      } catch (e) {
        console.error("[Home] Erreur chargement produits pour carrousel", e);
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pb-4">
      {/* Bandeau offline */}
      <OfflineBanner />

      {/* Bandeau installation PWA (Android + iOS tips) */}
      <section className="container-xxl pt-3">
        <InstallPWA />
      </section>

      {/* HERO / BANNIÈRE */}
      <section className="container-xxl pt-3">
        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="row g-0 align-items-stretch">
            {/* Image */}
            <div className="col-12 col-lg-6 order-lg-1">
              <div className="h-100 position-relative">
                <div className="ratio ratio-4x3 ratio-lg-1x1">
                  <img
                    src="/accueil.jpeg"
                    alt="Duumini — le marché des produits africains au Maroc"
                    className="w-100 h-100 object-fit-cover"
                    width={1200}
                    height={900}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>

            {/* Texte */}
            <div className="col-12 col-lg-6 order-lg-2">
              <div className="h-100 p-3 p-lg-4 d-flex flex-column justify-content-center">
                <h1 className="h3 mb-2" style={{ color: "var(--duu-black)" }}>
                  Retrouve les saveurs de ton pays, où que tu sois au Maroc.
                </h1>

                <div className="d-flex flex-wrap gap-2">
                  <Link to="/african-food" className="btn btn-dark">
                    Explorer Duumini Food
                  </Link>
                  <Link to="/african-market" className="btn btn-outline-dark">
                    Explorer Duumini Market
                  </Link>
                </div>

                <div className="mt-3 small text-muted">
                  <span className="me-3">✅ Traçabilité & qualité</span>
                  <span className="me-3">✅ Service client réactif</span>
                  <span>✅ Paiement à la livraison</span>
                </div>

                {/* CTA Notifications (utile pour PWA) */}
                <NotificationsCTA />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATÉGORIES avec carrousel d’images produits */}
      <section className="container-xxl mt-4">
        <div className="d-flex align-items-end justify-content-between mb-3">
          <h2 className="h5 m-0">Catégories</h2>
          <span className="small text-muted">
            Choisissez une catégorie
            {loadingProducts ? " — chargement des visuels…" : ""}
          </span>
        </div>

        <div className="row g-3">
          <CategoryCard
            to="/african-food"
            title="Restaurant Afro & Plats Africains"
            images={
              foodImages.length > 0 ? foodImages : ["/food.png"] // fallback si aucun produit
            }
          />
          <CategoryCard
            to="/african-market"
            title="Épicerie Africaine & Produits Afro"
            images={
              marketImages.length > 0 ? marketImages : ["/market.png"] // fallback si aucun produit
            }
          />
        </div>
      </section>
    </div>
  );
}
