// src/pages/Home.tsx
import { Link } from "react-router-dom";
import { ChevronRight, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import InstallPWA from "../components/InstallPWA";

/* === Bandeau hors-ligne (écoute online/offline) === */
function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
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

function CategoryCard(props: { to: string; title: string; img: string }) {
  const { to, title, img } = props;
  return (
    <div className="col-12 col-md-6">
      <Link
        to={to}
        className="text-decoration-none d-block h-100"
        aria-label={`Aller à ${title}`}
        // Pré-chargement léger côté navigateur (pas RR v7)
        onMouseEnter={() => {
          const i = new Image();
          i.src = img;
        }}
      >
        <div className="card border-0 shadow-sm h-100">
          <div className="ratio ratio-16x9">
            <img
              src={img}
              alt={title}
              width={1280}
              height={720}
              className="w-100 h-100 object-fit-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="card-body d-flex align-items-center justify-content-between">
            <div>
              <h3 className="h6 m-0 text-dark">{title}</h3>
              <small className="text-muted">Découvrir la sélection</small>
            </div>
            <ChevronRight
              size={18}
              className="text-dark opacity-75"
              aria-hidden="true"
            />
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
            {/* 🔁 Pour mettre l'image à DROITE sur desktop, remplace "order-lg-1" par "order-lg-2" et inverse le bloc texte */}
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

            <div className="col-12 col-lg-6 order-lg-2">
              <div className="h-100 p-3 p-lg-4 d-flex flex-column justify-content-center">
                <div className="mb-2">
                  <span className="badge text-bg-warning rounded-pill">
                    Paiement à la livraison
                  </span>
                </div>

                <h1 className="h3 mb-2" style={{ color: "var(--duu-black)" }}>
                  Goûtez et découvrez les richesses de l’Afrique subsaharienne,
                  sans bouger de chez vous.
                </h1>

                <ul className="text-muted small mb-4">
                  <li className="mb-1">
                    Produits d’Afrique subsaharienne sélectionnés et contrôlés
                  </li>
                  <li className="mb-1">
                    Transparence sur l’origine, la conservation et les
                    allergènes
                  </li>
                  <li className="mb-1">
                    Livraison Casablanca — simple ou express selon disponibilité
                  </li>
                </ul>

                <div className="d-flex flex-wrap gap-2">
                  <Link to="/african-food" className="btn btn-dark">
                    Explorer Duumini Food
                  </Link>
                  <Link to="/african-market" className="btn btn-outline-dark">
                    Explorer Duumini Market
                  </Link>
                  <a
                    href="https://wa.me/212623677884"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-secondary"
                    aria-label="Contacter le support Duumini sur WhatsApp (nouvelle fenêtre)"
                  >
                    WhatsApp
                  </a>
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

      {/* CATÉGORIES */}
      <section className="container-xxl mt-4">
        <div className="d-flex align-items-end justify-content-between mb-3">
          <h2 className="h5 m-0">Catégories</h2>
          <span className="small text-muted">Choisissez une catégorie</span>
        </div>

        <div className="row g-3">
          <CategoryCard
            to="/african-food"
            title="Duumini Food"
            img="/food.png"
          />
          <CategoryCard
            to="/african-market"
            title="Duumini Market"
            img="/market.png"
          />
        </div>
      </section>
    </div>
  );
}
