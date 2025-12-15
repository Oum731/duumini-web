// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Bell } from "lucide-react";
import InstallPWA from "../components/InstallPWA";
import { listProducts, type Product } from "../services/products";
import { API_BASE } from "../services/http";
import PromotionsCarousel from "../components/PromotionsCarousel";

/* ===== Brand (slogan + dates) ===== */
const DUUMINI_SLOGAN = "Les goûts de ton pays, partout où tu te trouves";

// 📅 Date d'ouverture officielle
const DUUMINI_OPEN_ISO = "2025-12-21T00:00:00+01:00";

// 📅 Fin de la promo (cache la box promo après cette date)
const PROMO_END_ISO = "2026-01-22T23:59:59+01:00";

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

function isDateReached(iso: string) {
  return Date.now() >= new Date(iso).getTime();
}

/* ===== Countdown Hook ===== */
function useCountdown(targetIso: string) {
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const diff = target - now;
  const isOver = diff <= 0;
  const safe = Math.max(0, diff);

  const days = Math.floor(safe / (1000 * 60 * 60 * 24));
  const hours = Math.floor((safe / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((safe / (1000 * 60)) % 60);
  const secs = Math.floor((safe / 1000) % 60);

  return { diff, days, hours, mins, secs, isOver };
}

/* ===== Bannière ouverture (visible seulement AVANT ouverture) ===== */
function DuuminiOpeningBanner() {
  const cd = useCountdown(DUUMINI_OPEN_ISO);

  const timeStr = `${String(cd.hours).padStart(2, "0")}:${String(cd.mins).padStart(
    2,
    "0"
  )}:${String(cd.secs).padStart(2, "0")}`;

  return (
    <section className="container-xxl pt-3">
      <style>{`
        .duu-open-card{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 18px;
          overflow:hidden;
          background:
            radial-gradient(900px 320px at 12% 0%, rgba(255,213,79,.42), transparent 60%),
            radial-gradient(900px 280px at 92% 10%, rgba(229,57,53,.18), transparent 55%),
            linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.60));
          box-shadow: 0 .9rem 2.2rem rgba(0,0,0,.10);
        }
        .duu-open-top{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding: 10px 12px;
          background: var(--duu-yellow, #FFD54F);
          border-bottom: 1px solid rgba(0,0,0,.10);
        }
        .duu-open-title{
          font-weight: 990;
          letter-spacing:.2px;
          color: rgba(0,0,0,.92);
          white-space: nowrap;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .duu-open-chip{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,.86);
          color:#fff;
          font-weight: 980;
          border: 1px solid rgba(255,255,255,.18);
          white-space: nowrap;
        }
        .duu-open-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,1);
          box-shadow: 0 0 0 3px rgba(229,57,53,.18);
          animation: duuBlink .7s infinite;
        }
        @keyframes duuBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .20; transform: scale(.78); }
          100%{ opacity: 1; transform: scale(1); }
        }
        .duu-open-body{
          padding: 12px;
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .duu-open-slogan{
          font-weight: 950;
          color: rgba(0,0,0,.82);
          line-height: 1.15;
        }
        .duu-open-meta{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
        }
        .duu-open-count{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,.88);
          border: 1px solid rgba(0,0,0,.10);
          font-weight: 980;
          color:#111;
          box-shadow: 0 .6rem 1.3rem rgba(0,0,0,.08);
          white-space: nowrap;
        }
        .duu-open-hint{
          font-weight: 800;
          color: rgba(0,0,0,.62);
        }
      `}</style>

      <div className="duu-open-card">
        <div className="duu-open-top">
          <div className="duu-open-title">Duumini ouvre le 21 décembre 🎉🎊</div>
          <div className="duu-open-chip" aria-hidden="true">
            <span className="duu-open-dot" />
            OUVERTURE
          </div>
        </div>

        <div className="duu-open-body">

          <div className="duu-open-meta">
            <span className="duu-open-count">
              ⏳ {cd.isOver ? "C’est ouvert ✅" : `${cd.days}j ${timeStr}`}
            </span>
            <span className="duu-open-hint small">
              {cd.isOver ? "Bienvenue sur Duumini." : "Restez prêts : lancement très proche."}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
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
      Vous êtes hors-ligne. Certaines images ou données récentes peuvent ne pas s’afficher.
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
          style={{ borderRadius: "1rem", overflow: "hidden", background: "#fff" }}
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
            } catch {}
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

  // ✅ Re-render automatique toutes les 1s pour cacher/afficher à la bonne date
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // ⏱️ Conditions dates
  const isOpen = isDateReached(DUUMINI_OPEN_ISO);
  const isPromoActive = isOpen && !isDateReached(PROMO_END_ISO);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      try {
        setLoadingProducts(true);

        const res = await (listProducts as any)({ page: 1, pageSize: 60 });
        const data = (res as any).data ?? res;
        const items: Product[] = data.items ?? data;

        if (!items || !Array.isArray(items) || cancelled) return;

        const active = items.filter((p: any) => {
          const isActive =
            (p.is_active ?? p.active ?? 1) &&
            (p.stock === undefined || p.stock !== 0);
          return !!isActive;
        });

        const marketOnly = active.filter(
          (p: any) => String(p.sub_category || "").toLowerCase() !== "food"
        );

        const featuredSelection = marketOnly.slice(0, 8);
        const marketSelection = marketOnly.slice(0, 12);

        if (!cancelled) {
          setFeatured(featuredSelection);
          setMarketProducts(marketSelection);
        }
      } catch (e) {
        console.error("[Home] Erreur chargement produits Home", e);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pb-4" style={{ background: "#fafafa" }}>
      <OfflineBanner />

      {/* ✅ Bannière ouverture : seulement AVANT ouverture */}
      {!isOpen && <DuuminiOpeningBanner />}

      {/* Bandeau installation PWA + CTA notifications */}
      <section className="container-xxl pt-3">
        <InstallPWA />
        <NotificationsCTA />
      </section>

      {/* ✅ Promotions : seulement APRES ouverture et AVANT fin promo */}
      {isPromoActive && <PromotionsCarousel limit={10} toAllLink="/promos" />}

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
            <div className="small text-muted">Les produits seront bientôt disponibles.</div>
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
            <div className="small text-muted">Épices, céréales, produits frais & plus encore.</div>
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
            <div className="small text-muted">Les produits d&apos;épicerie seront bientôt disponibles.</div>
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
              <div className="small text-muted">{DUUMINI_SLOGAN}</div>
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
