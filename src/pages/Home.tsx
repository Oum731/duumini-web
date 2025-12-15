// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import InstallPWA from "../components/InstallPWA";
import { listProducts, type Product } from "../services/products";
import { API_BASE } from "../services/http";
import PromotionsCarousel from "../components/PromotionsCarousel";

/* ===== Brand & Dates ===== */
const DUUMINI_SLOGAN = "Les goûts de ton pays, partout où tu te trouves";
const DUUMINI_OPEN_ISO = "2025-12-21T00:00:00+01:00";
const PROMO_END_ISO = "2026-01-22T23:59:59+01:00";

/* 📞 WhatsApp infos */
const DUUMINI_WHATSAPP = "+212623677884";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} MAD`;
}

function isDateReached(iso: string) {
  return Date.now() >= new Date(iso).getTime();
}

/* ===== Countdown Hook ===== */
function useCountdown(targetIso: string) {
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}

/* === Offline Banner === */
function OfflineBanner() {
  const [online, setOnline] = useState(
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
    <div className="alert alert-warning rounded-0 text-center small m-0">
      Vous êtes hors-ligne.
    </div>
  );
}

/* ===== PAGE LANCEMENT (emoji clignotant + WhatsApp) ===== */
function LaunchOnlyPage() {
  const cd = useCountdown(DUUMINI_OPEN_ISO);

  const wa = DUUMINI_WHATSAPP.replace(/\D/g, "");
  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(
    "Bonjour Duumini 👋 Je souhaite plus d’informations sur le lancement et les offres CAN."
  )}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(900px 420px at 15% 0%, rgba(255,213,79,.35), transparent 60%), radial-gradient(900px 320px at 90% 10%, rgba(229,57,53,.16), transparent 55%), #fafafa",
      }}
      className="d-flex align-items-start justify-content-center pt-4 pb-4"
    >
      <style>{`
        .blink-emoji{
          animation: blinkEmoji .8s infinite;
          display:inline-block;
        }
        @keyframes blinkEmoji{
          0%{ opacity:1; transform:scale(1); }
          50%{ opacity:.25; transform:scale(.8); }
          100%{ opacity:1; transform:scale(1); }
        }
      `}</style>

      <OfflineBanner />

      <div className="container" style={{ maxWidth: 720 }}>
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
          <div
            className="p-3 d-flex justify-content-between align-items-center"
            style={{ background: "#FFD54F" }}
          >
            <div className="d-flex align-items-center gap-2 fw-bold">
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#111",
                  color: "#fff",
                }}
                className="d-flex align-items-center justify-content-center"
              >
                D
              </div>
              DUUMINI
            </div>
            <span className="badge bg-dark">
              <span className="blink-emoji">🔥</span> LANCEMENT
            </span>
          </div>

          <div className="card-body d-flex flex-column gap-3">
            <h1 className="h5 fw-bold m-0">
              Ouverture le 21 décembre{" "}
              <span className="blink-emoji">🎉</span>
            </h1>

            <p className="text-muted m-0">
              Offres spéciales CAN jusqu’au 22 janvier 2026 🏆 — prix promo &
              livraison.
            </p>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-light text-dark p-2">
                ⏳ {cd.days}j {cd.hours}h {cd.mins}m {cd.secs}s
              </span>
              <span className="small text-muted fw-semibold">
                Écris-nous sur WhatsApp pour être informé{" "}
                <span className="blink-emoji">👇</span>
              </span>
            </div>

            <div className="small fw-semibold text-muted">
              🚚 Casablanca & Marrakech • 💳 Paiement à la livraison
            </div>

            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-success fw-bold"
            >
              💬 WhatsApp – plus d’infos
            </a>

            <InstallPWA />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Product Card ===== */
function HomeProductCard({ product }: { product: Product }) {
  const image =
    (product as any).cover ||
    (product as any).image ||
    (product as any).images?.[0]?.url;

  const name = (product as any).name ?? "Produit";
  const price = (product as any).price_client ?? 0;

  return (
    <div className="col-6 col-md-3 col-lg-2">
      <Link to="/african-market" className="text-reset text-decoration-none">
        <div className="card h-100 shadow-sm border-0 rounded-3">
          <div style={{ height: 130 }} className="bg-light">
            {image && (
              <img
                src={imgUrl(image)}
                alt={name}
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <div className="card-body p-2">
            <div className="small fw-semibold">{name}</div>
            <div className="small">{moneyMAD(price)}</div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ===== HOME ===== */
export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);

  const isOpen = isDateReached(DUUMINI_OPEN_ISO);
  const isPromoActive = isOpen && !isDateReached(PROMO_END_ISO);

  useEffect(() => {
    if (!isOpen) return;
    listProducts({ page: 1, pageSize: 12 }).then((r: any) => {
      const items = r?.data?.items ?? r;
      setProducts(items || []);
    });
  }, [isOpen]);

  if (!isOpen) return <LaunchOnlyPage />;

  return (
    <div className="pb-4 bg-light">
      <OfflineBanner />

      <section className="container pt-3">
        <InstallPWA />
      </section>

      {isPromoActive && (
        <PromotionsCarousel limit={10} toAllLink="/promos" />
      )}

      <section className="container mt-4">
        <div className="d-flex justify-content-between align-items-end mb-2">
          <div>
            <h2 className="h5 m-0">La sélection Duumini</h2>
            <div className="small text-muted">{DUUMINI_SLOGAN}</div>
          </div>
          <Link to="/african-market" className="small text-decoration-none">
            Voir tout <ChevronRight size={14} />
          </Link>
        </div>

        <div className="row g-3">
          {products.map((p) => (
            <HomeProductCard key={(p as any).id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
