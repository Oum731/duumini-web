// src/App.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Outlet, useLocation, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import ProfilePage from "./pages/Profile";
import VerifyAndResetPage from "./pages/VerifyAndReset";

import AdminTopNav from "./components/admin/AdminTopNav";
import ProtectedAdmin from "./components/ProtectedAdmin";

import AdminHome from "./pages/AdminHome";
import OrdersAdminPage from "./pages/admin/OrdersAdminPage";
import ProductsAdminPage from "./pages/admin/ProductsAdminPage";
import ShopsAdminPage from "./pages/admin/ShopsAdminPage";
import UsersAdminPage from "./pages/admin/UsersAdminPage";

// ✅ Nouvelle page IA (Admin)
import AiToolsAdminPage from "./pages/admin/AiToolsAdminPage";

// ✅ Vitrine
import AfricanFood from "./pages/AfricanFood";
import AfricanMarket from "./pages/AfricanMarket";

// ✅ Panier
import CartPage from "./pages/Cart";
import { CartProvider, useCart } from "./store/cart";
import FloatingCartButton from "./components/FloatingCartButton";
import CheckoutPage from "./pages/Checkout";
import OrdersHistoryPage from "./pages/OrdersHistory";
import ContactPage from "./pages/Contact";
import AboutPage from "./pages/About";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import ReturnsPolicy from "./pages/legal/ReturnsPolicy";
import Terms from "./pages/legal/Terms";
import Footer from "./components/Footer";
import ScrollTopButton from "./components/ScrollTopButton";

import { getCurrentUser } from "./services/auth";
import ProductView from "./pages/ProductView";

import { useAuth } from "./context/AuthContext";
import {
  getPendingProductRating,
  type PendingProductRating,
  rateProduct,
} from "./services/productRatings";
import TopProductsPage from "./pages/TopProductsPage";
import GuestOrderWidget from "./components/GuestOrderWidget";

// ✅ Localisation (Casablanca / Marrakech)
import LocationGate from "./components/LocationGate";

// 🔔 Bulle de notification temps réel (socket/SSE)
import NotificationBubble from "./components/NotificationBubble";

// ✅ Analytics (Meta Pixel via GTM / dataLayer)
import { trackPageView } from "./lib/analytics";
import PromotionsPage from "./pages/PromotionsPage";
import PromotionsAdminPage from "./pages/admin/PromotionsAdminPage";
import CanKickLottie from "./components/CanKickLottie";

function Page({ title }: { title: string }) {
  return (
    <div className="container-xxl py-4">
      <h1 className="h4 mb-3">{title}</h1>
      <p className="text-muted">Contenu en cours…</p>
    </div>
  );
}

/** 🔝 Remonte en haut à chaque navigation */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);
  return null;
}

/** 📊 Envoie un event page_view à chaque changement de route (SPA) */
function PageViewTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const path = `${pathname}${search || ""}`;
    trackPageView(path);
  }, [pathname, search]);

  return null;
}

/** 🧭 Page d’atterrissage publique */
function LandingRedirect() {
  return <Home />;
}

// Layout admin
function AdminShell() {
  return (
    <div className="container-xxl py-4">
      <div className="mb-3">
        <AdminTopNav />
      </div>
      <Outlet />
    </div>
  );
}

// ✅ Garde vendeur locale
function ProtectedVendor() {
  const u = getCurrentUser();
  if (!u) return <Navigate to="/profile?tab=login" replace />;
  if ((u.role || "").toString().trim().toUpperCase() !== "VENDEUR") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

// Navbar branchée au panier
function NavbarWithCount() {
  const { totalItems } = useCart();
  return <Navbar cartCount={totalItems} />;
}

// ✅ Masque le bouton flottant sur /cart et /checkout
function FloatingCartGuard() {
  const { pathname } = useLocation();
  const hide = pathname.startsWith("/cart") || pathname.startsWith("/checkout");
  if (hide) return null;
  return <FloatingCartButton />;
}

/**
 * Modal global qui s'affiche 24h après la livraison
 * pour demander une note sur un produit d'une commande.
 */
function GlobalRatingModal(props: {
  pending: PendingProductRating;
  onClose: () => void;
}) {
  const { pending, onClose } = props;
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function renderStar(idx: number) {
    const activeValue = hover ?? rating ?? 0;
    const isActive = idx <= activeValue;

    return (
      <button
        key={idx}
        type="button"
        className="btn btn-link p-0 border-0 text-decoration-none"
        onClick={() => setRating(idx)}
        onMouseEnter={() => setHover(idx)}
        onMouseLeave={() => setHover(null)}
        aria-label={`${idx} étoile${idx > 1 ? "s" : ""}`}
        disabled={saving}
        style={{ padding: 0, margin: 0 }}
      >
        <span
          style={{
            fontSize: "1.4rem",
            lineHeight: 1,
            cursor: "pointer",
            transition: "transform 0.15s ease, color 0.15s ease",
            color: isActive ? "var(--duu-yellow)" : "#E0E0E0",
          }}
        >
          ★
        </span>
      </button>
    );
  }

  async function handleSubmit() {
    if (!rating) {
      alert("Choisissez d'abord le nombre d'étoiles.");
      return;
    }
    if (saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await rateProduct(
        pending.product_id,
        rating,
        comment.trim() || undefined
      );
      setSuccess("Merci pour votre avis !");
      setTimeout(() => onClose(), 800);
    } catch (e) {
      console.error("Erreur enregistrement avis commande:", e);
      setError("Impossible d'enregistrer votre avis.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Donnez votre avis</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fermer"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <p className="small text-muted mb-2">
                Vous avez reçu votre commande contenant :<br />
                <strong>{pending.product_name}</strong>
              </p>

              <div className="mb-3">
                <span className="small d-block mb-1 fw-semibold">
                  Votre note :
                </span>
                <div className="d-flex align-items-center gap-2">
                  {[1, 2, 3, 4, 5].map((i) => renderStar(i))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small">
                  Votre avis (optionnel)
                </label>
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  placeholder="Partagez votre expérience avec ce produit…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={saving}
                />
              </div>

              {error && (
                <div className="alert alert-danger py-1 small">{error}</div>
              )}
              {success && (
                <div className="alert alert-success py-1 small">{success}</div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onClose}
                disabled={saving}
              >
                Plus tard
              </button>
              <button
                type="button"
                className="btn btn-sm btn-duu"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Envoi…" : "Envoyer mon avis"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const { user } = useAuth();
  const [pendingRating, setPendingRating] =
    useState<PendingProductRating | null>(null);

  // ✅ Avec ton http.ts : getPendingProductRating() renvoie directement l’objet JSON (pas axios {data})
  useEffect(() => {
    if (!user) {
      setPendingRating(null);
      return;
    }

    let cancelled = false;

    async function checkPending() {
      try {
        const res = await getPendingProductRating();

        if (cancelled) return;

        // res est soit PendingProductRating soit null
        setPendingRating((res as PendingProductRating | null) ?? null);
      } catch (e) {
        console.error("Erreur pending rating:", e);
        if (!cancelled) setPendingRating(null);
      }
    }

    checkPending();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <CartProvider>
      <LocationGate>
        <div className="min-vh-100 d-flex flex-column">
          <ScrollToTop />
          <PageViewTracker />
          <NavbarWithCount />

          <main className="flex-fill">
            <React.Suspense
              fallback={
                <div className="container-xxl py-5 text-muted">Chargement…</div>
              }
            >
              <Routes>
                <Route path="/" element={<LandingRedirect />} />

                {/* Public */}
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/verify" element={<VerifyAndResetPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrdersHistoryPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* ✅ Vitrine */}
                <Route path="/african-food" element={<AfricanFood />} />
                <Route path="/african-market" element={<AfricanMarket />} />
                <Route path="/products/:idOrSlug" element={<ProductView />} />
                <Route path="/top-products" element={<TopProductsPage />} />
                <Route path="/promos" element={<PromotionsPage />} />
                <Route path="/test-can" element={<CanKickLottie />} />

                {/* ✅ Pages légales */}
                <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/terms" element={<Terms />} />
                <Route path="/legal/returns" element={<ReturnsPolicy />} />

                <Route path="/admin" element={<ProtectedAdmin />}>
                  <Route element={<AdminShell />}>
                    <Route index element={<AdminHome />} />
                    <Route path="orders" element={<OrdersAdminPage />} />
                    <Route path="products" element={<ProductsAdminPage />} />
                    <Route path="shops" element={<ShopsAdminPage />} />
                    <Route path="users" element={<UsersAdminPage />} />

                    {/* ✅ Promotions */}
                    <Route
                      path="promotions"
                      element={<PromotionsAdminPage />}
                    />

                    {/* ✅ IA */}
                    <Route path="ai" element={<AiToolsAdminPage />} />
                  </Route>
                </Route>

                {/* ✅ Vendeur protégé : ma boutique */}
                <Route path="/ma-boutique" element={<ProtectedVendor />}>
                  <Route index element={<ShopsAdminPage />} />
                </Route>

                {/* Divers */}
                <Route path="*" element={<Page title="Page introuvable" />} />
              </Routes>
            </React.Suspense>
          </main>

          <GuestOrderWidget />
          <ScrollTopButton threshold={380} offsetBottom={84} offsetRight={16} />
          <FloatingCartGuard />
          <Footer />

          <NotificationBubble />

          {pendingRating && (
            <GlobalRatingModal
              pending={pendingRating}
              onClose={() => setPendingRating(null)}
            />
          )}
        </div>
      </LocationGate>
    </CartProvider>
  );
}
