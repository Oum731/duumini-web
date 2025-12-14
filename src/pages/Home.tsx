// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Bell } from "lucide-react";
import InstallPWA from "../components/InstallPWA";
import { listProducts, type Product } from "../services/products";
import { API_BASE } from "../services/http";
import PromotionsCarousel from "../components/PromotionsCarousel";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  const v = Number(n || 0);
  return `${v.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} MAD`;
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

/* === Carte produit “teaser” pour la Home (vignettes plus petites) === */
function HomeProductCard(props: { product: Product; to: string }) {
  const { product, to } = props;

  const imageSrc = (() => {
    const raw =
      (product as any).cover ||
      (product as any).image ||
      (product as any).images?.[0]?.url ||
      null;
    return imgUrl(raw);
  })();

  const name = (product as any).name ?? (product as any).title ?? "Produit";
  const price =
    (product as any).price_client ??
    (product as any).price ??
    (product as any).client_price ??
    0;

  return (
    <div className="col-6 col-sm-4 col-md-3 col-lg-2">
      <Link to={to} className="text-decoration-none text-reset d-block h-100">
        <div
          className="card border-0 shadow-sm h-100"
          style={{
            borderRadius: "1rem",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            className="position-relative bg-light d-flex align-items-center justify-content-center"
            style={{ height: 130 }}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={name}
                className="img-fluid"
                loading="lazy"
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div className="w-100 h-100 d-flex align-items-center justify-content-center small text-muted">
                Image à venir
              </div>
            )}
          </div>

          <div className="card-body p-2">
            <div
              className="small fw-semibold mb-1"
              title={name}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "2.4em",
              }}
            >
              {name}
            </div>
            <div className="small fw-semibold" style={{ color: "#111" }}>
              {moneyMAD(price as number)}
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
  const [featured, setFeatured] = useState<Product[]>([]);
  const [marketProducts, setMarketProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      try {
        setLoadingProducts(true);

        const res = await (listProducts as any)({
          page: 1,
          pageSize: 60,
        });
        const data = (res as any).data ?? res;
        const items: Product[] = data.items ?? data;

        if (!items || !Array.isArray(items) || cancelled) return;

        // ✅ On garde uniquement les produits actifs + en stock
        const active = items.filter((p: any) => {
          const isActive =
            (p.is_active ?? p.active ?? 1) &&
            (p.stock === undefined || p.stock !== 0);
          return !!isActive;
        });

        // ✅ SANS FOOD : on filtre tout ce qui est sub_category = food
        const marketOnly = active.filter(
          (p: any) => String(p.sub_category || "").toLowerCase() !== "food"
        );

        // ✅ Sélections pour la Home (uniquement market)
        const featuredSelection = marketOnly.slice(0, 8);
        const marketSelection = marketOnly.slice(0, 12);

        if (!cancelled) {
          setFeatured(featuredSelection);
          setMarketProducts(marketSelection);
        }
      } catch (e) {
        console.error("[Home] Erreur chargement produits Home", e);
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
    <div className="pb-4" style={{ background: "#fafafa" }}>
      {/* Bandeau offline */}
      <OfflineBanner />

      {/* Bandeau installation PWA (Android + iOS tips) */}
      <section className="container-xxl pt-3">
        <InstallPWA />
        <NotificationsCTA />
      </section>
      <PromotionsCarousel limit={10} toAllLink="/promos" />

      {/* SECTION 1 : Sélection Duumini (sans food) */}
      <section className="container-xxl mt-4">
        <div className="d-flex align-items-end justify-content-between mb-2">
          <div>
            <h2 className="h5 m-0">La sélection Duumini</h2>
            <div className="small text-muted">
              Un aperçu des produits disponibles près de chez vous.
            </div>
          </div>
          <Link
            to="/african-market"
            className="small text-decoration-none d-flex align-items-center gap-1"
          >
            Voir tous les produits
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="bg-white rounded-4 shadow-sm p-3">
          {loadingProducts && featured.length === 0 ? (
            <div className="small text-muted">Chargement des produits…</div>
          ) : featured.length === 0 ? (
            <div className="small text-muted">
              Les produits seront bientôt disponibles.
            </div>
          ) : (
            <div className="row g-3">
              {featured.map((p) => (
                <HomeProductCard
                  key={(p as any).id ?? (p as any).slug}
                  product={p}
                  to="/african-market"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2 : Duumini Market (uniquement) */}
      <section className="container-xxl mt-4">
        <div className="d-flex align-items-end justify-content-between mb-2">
          <div>
            <h2 className="h5 m-0">Épicerie africaine</h2>
            <div className="small text-muted">
              Épices, céréales, produits frais & plus encore.
            </div>
          </div>
          <Link
            to="/african-market"
            className="small text-decoration-none d-flex align-items-center gap-1"
          >
            Voir toute l&apos;épicerie
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="bg-white rounded-4 shadow-sm p-3">
          {marketProducts.length === 0 && !loadingProducts ? (
            <div className="small text-muted">
              Les produits d&apos;épicerie seront bientôt disponibles.
            </div>
          ) : (
            <div className="row g-3">
              {marketProducts.map((p) => (
                <HomeProductCard
                  key={(p as any).id ?? (p as any).slug}
                  product={p}
                  to="/african-market"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3 : Bandeau “Pourquoi Duumini ?” */}
      <section className="container-xxl mt-4">
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body d-flex flex-column flex-md-row gap-3">
            <div className="flex-fill">
              <div className="fw-semibold">Pourquoi choisir Duumini ?</div>
              <div className="small text-muted">
                La plateforme dédiée aux produits africains au Maroc.
              </div>
            </div>
            <div className="d-flex flex-wrap gap-3 small">
              <div>🚚 Livraison rapide Casablanca & Marrakech</div>
              <div>✅ Produits authentiques d&apos;Afrique subsaharienne</div>
              <div>💳 Paiement à la livraison</div>
              <div>📞 Service client WhatsApp réactif</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
