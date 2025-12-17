// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import InstallPWA from "../components/InstallPWA";
import { listProducts, type Product } from "../services/products";
import { API_BASE } from "../services/http";
import PromotionsCarousel from "../components/PromotionsCarousel";

/* ===== Brand & Dates ===== */
const DUUMINI_SLOGAN = "Duumini, les saveurs d’Afrique au Maroc.";
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

/* ===== PAGE LANCEMENT (image annonce + WhatsApp) ===== */
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

        .launch-shell { width: 100%; }
        .launch-card { border-radius: 18px; }
        .launch-hero { padding: 14px 14px 10px; background: #FFD54F; }
        .launch-body { padding: 14px; }
        .launch-countdown { font-variant-numeric: tabular-nums; }
        .launch-note { line-height: 1.25; }

        /* ✅ Animation PRO (recommandée) : halo + léger zoom */
        .announce-pulse-wrap{
          background:#FFD54F;
          position:relative;
          overflow:hidden;
        }
        .announce-pulse-wrap::before{
          content:"";
          position:absolute;
          inset: -20%;
          background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.65), transparent 55%);
          opacity:.0;
          transform: scale(.95);
          animation: announceGlow 1.6s ease-in-out infinite;
          pointer-events:none;
        }
        @keyframes announceGlow{
          0%{ opacity:.05; transform: scale(.97); }
          50%{ opacity:.45; transform: scale(1.02); }
          100%{ opacity:.05; transform: scale(.97); }
        }

        .announce-img{
          display:block;
          width:100%;
          max-height:460px;
          object-fit:contain;
          transform: translateZ(0);
          animation: announceScale 1.6s ease-in-out infinite;
        }
        @keyframes announceScale{
          0%{ transform: scale(1); }
          50%{ transform: scale(1.015); }
          100%{ transform: scale(1); }
        }

        /* ✅ Option “blink” agressive (désactivée par défaut)
           Si tu veux VRAIMENT blink, remplace announce-pulse-wrap par announce-blink-wrap */
        .announce-blink-wrap{
          background:#FFD54F;
          animation: announceBlink .75s infinite;
        }
        @keyframes announceBlink{
          0%{ filter: brightness(1); }
          50%{ filter: brightness(1.25); }
          100%{ filter: brightness(1); }
        }

        @media (max-width: 420px){
          .launch-body { padding: 12px; }
          .launch-hero { padding: 12px; }
          .announce-img{ max-height: 420px; }
        }
      `}</style>

      <OfflineBanner />

      <div className="container launch-shell" style={{ maxWidth: 720 }}>
        <div className="card border-0 shadow-lg overflow-hidden launch-card">
          <div className="launch-hero d-flex justify-content-between align-items-center">
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

          {/* ✅ Image annonce (public/annonce.jpeg) + effet visible */}
          <div className="announce-pulse-wrap">
            <img
              src="/annonce.jpeg"
              alt="Annonce Duumini"
              className="announce-img"
              loading="eager"
            />
          </div>

          <div className="card-body d-flex flex-column gap-3 launch-body">
            <div className="d-flex flex-column gap-1">
              <h1 className="h5 fw-bold m-0">
                Ouverture le 21 décembre 2025{" "}
                <span className="blink-emoji">🎉</span>
              </h1>
              <p className="text-muted m-0 launch-note">
                Offres CAN jusqu’au 22 janvier 2026 🏆
              </p>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-light text-dark p-2 launch-countdown">
                ⏳ {cd.days}j {cd.hours}h {cd.mins}m {cd.secs}s
              </span>
              <span className="small text-muted fw-semibold">
                WhatsApp pour être informé <span className="blink-emoji">👇</span>
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
        <div className="card h-100 shadow-sm border-0 rounded-3 overflow-hidden">
          <div className="bg-light" style={{ height: 130, position: "relative" }}>
            {image ? (
              <img
                src={imgUrl(image)}
                alt={name}
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted small">
                Image indisponible
              </div>
            )}
          </div>
          <div className="card-body p-2">
            <div className="small fw-semibold text-truncate">{name}</div>
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
      <style>{`
        .home-wrap{
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(255,213,79,.18), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(229,57,53,.10), transparent 55%),
            #f8f9fa;
          min-height: 100%;
        }
        .home-title{ line-height: 1.1; }
        .home-slogan{ line-height: 1.2; }
        .home-head{ gap: 10px; }
        .home-seeall{
          white-space: nowrap;
          font-weight: 600;
        }
      `}</style>

      <div className="home-wrap pb-4">
        <OfflineBanner />

        <section className="container pt-3">
          <InstallPWA />
        </section>

        {isPromoActive && <PromotionsCarousel limit={10} toAllLink="/promos" />}

        <section className="container mt-4">
          <div className="d-flex justify-content-between align-items-end mb-2 home-head">
            <div>
              <h2 className="h5 m-0 home-title">La sélection Duumini</h2>
              <div className="small text-muted home-slogan">{DUUMINI_SLOGAN}</div>
            </div>
            <Link
              to="/african-market"
              className="small text-decoration-none home-seeall"
            >
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
    </div>
  );
}
