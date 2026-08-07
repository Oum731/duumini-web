import React, { useEffect, useState } from "react";
import { Routes, Route, Outlet, useLocation, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import ProfilePage from "./pages/Profile";
import VerifyAndResetPage from "./pages/VerifyAndReset";

import AdminTopNav from "./components/admin/AdminTopNav";
import ProtectedAdmin from "./components/ProtectedAdmin";

const AdminHome = React.lazy(() => import("./pages/AdminHome"));
const OrdersAdminPage = React.lazy(() => import("./pages/admin/OrdersAdminPage"));
const ShopsAdminPage = React.lazy(() => import("./pages/admin/ShopsAdminPage"));
const VendorApplicationsAdminPage = React.lazy(() => import("./pages/admin/VendorApplicationsAdminPage"));
const CourierTripsAdminPage = React.lazy(() => import("./pages/admin/CourierTripsAdminPage"));
const LivreurProfilesAdminPage = React.lazy(() => import("./pages/admin/LivreurProfilesAdminPage"));
const CommercialsAdminPage = React.lazy(() => import("./pages/admin/CommercialsAdminPage"));
const UsersAdminPage = React.lazy(() => import("./pages/admin/UsersAdminPage"));
const ExpensesPage = React.lazy(() => import("./pages/admin/ExpensesPage"));

const ContentAiPage = React.lazy(() => import("./pages/admin/ContentAiPage"));
const AdsMetaPage = React.lazy(() => import("./pages/admin/AdsMetaPage"));

import AfricanFood from "./pages/AfricanFood";
import AfricanMarket from "./pages/AfricanMarket";
import Fashion from "./pages/Fashion";

import CartPage from "./pages/Cart";
import { CartProvider, useCart } from "./store/cart";
import FloatingCartButton from "./components/FloatingCartButton";
import CheckoutPage from "./pages/Checkout";
import OrdersHistoryPage from "./pages/OrdersHistory";
import ContactPage from "./pages/Contact";
import AboutPage from "./pages/About";
import CommentCaMarchePage from "./pages/CommentCaMarchePage";
import SolutionsPage from "./pages/SolutionsPage";
import SolutionDetailPage from "./pages/solutions/SolutionDetailPage";
import CataloguePage from "./pages/CataloguePage";
import CourierBookingPage from "./pages/CourierBookingPage";
import MyCourierTripsPage from "./pages/MyCourierTripsPage";
import CourierTripTrackingPage from "./pages/CourierTripTrackingPage";
import LivreurHome from "./pages/livreur/LivreurHome";
import CommercialHome from "./pages/commercial/CommercialHome";
import PaysPage from "./pages/PaysPage";
import BlogPage from "./pages/BlogPage";
import RejoindrePage from "./pages/RejoindrePage";
import CatalogueB2BPage from "./pages/CatalogueB2BPage";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import ReturnsPolicy from "./pages/legal/ReturnsPolicy";
import Terms from "./pages/legal/Terms";
import Footer from "./components/Footer";
import ScrollTopButton from "./components/ScrollTopButton";

import ProductView from "./pages/ProductView";
import ShopStorefrontPage from "./pages/ShopStorefrontPage";
import { PageLoader } from "./components/ui/Spinner";

import { useAuth } from "./context/AuthContext";
import {
  getPendingProductRating,
  type PendingProductRating,
  rateProduct,
} from "./services/productRatings";

import TopProductsPage from "./pages/TopProductsPage";
import GuestOrderWidget from "./components/GuestOrderWidget";
import LocationGate from "./components/LocationGate";
import NotificationBubble from "./components/NotificationBubble";
import SellIntentGate from "./pages/home/SellIntentGate";
import CookieBanner from "./components/CookieBanner";

import { trackPageView } from "./lib/analytics";
import { trackMetricoolPageView } from "./lib/metricool";
import { setMetaAdvancedMatchingPhone } from "./lib/metaPixel";

import PromotionsPage from "./pages/PromotionsPage";
const PromotionsAdminPage = React.lazy(() => import("./pages/admin/PromotionsAdminPage"));
import CanKickLottie from "./components/CanKickLottie";
const AiCopyPage = React.lazy(() => import("./pages/admin/AiCopyPage"));

const VendorHome = React.lazy(() => import("./pages/vendor/VendorHome"));
const MyShopPage = React.lazy(() => import("./pages/vendor/MyShopPage"));
const SupplierCatalogPage = React.lazy(() => import("./pages/vendor/SupplierCatalogPage"));
const ProductStockLookupPage = React.lazy(() => import("./pages/products/ProductStockLookupPage"));

const ManageProductsPage = React.lazy(() => import("./pages/products/ManageProductsPage"));
const CompaniesPage = React.lazy(() => import("./pages/companies/CompaniesPage"));
import RequireAuth from "./components/RequireCaps";
import { useViewer } from "./hooks/useViewer";
import PublicReceiptPage from "./pages/PublicReceiptPage";
import NotFoundPage from "./pages/NotFoundPage";
const ReportSalesViewPage = React.lazy(() => import("./pages/admin/ReportSalesViewPage"));
const ReportsSalesPage = React.lazy(() => import("./pages/admin/ReportsSalesPage"));
const AffiliatesPage = React.lazy(() => import("./pages/admin/AffiliatesPage"));
const AffiliateDashboardPage = React.lazy(() => import("./pages/admin/AffiliateDashboardPage"));

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

function PageViewTracker() {
  const { pathname, search } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const path = `${pathname}${search || ""}`;

    trackPageView(path);
    trackMetricoolPageView();
  }, [pathname, search]);

  // ✅ Retargeting Meta — améliore l'appariement des audiences dès qu'un
  // utilisateur connecté a un téléphone connu (le site n'a pas d'email
  // fiable). Sans effet si le consentement marketing n'est pas accordé
  // (vérifié dans setMetaAdvancedMatchingPhone lui-même).
  useEffect(() => {
    const phone = (user as any)?.phone;
    if (phone) setMetaAdvancedMatchingPhone(String(phone));
  }, [user]);

  return null;
}

function AdminShell() {
  return (
    <div className="container-xxl py-4">
      <div className="d-flex flex-column flex-lg-row gap-3 gap-lg-4 align-items-start">
        <AdminTopNav />
        <div className="flex-grow-1 w-100" style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function NavbarWithCount() {
  const { totalItems } = useCart();

  return <Navbar cartCount={totalItems} />;
}

function FloatingCartGuard() {
  const { pathname } = useLocation();
  const { loading, isLogged, caps } = useViewer();

  const hideByRoute =
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/vendeur") ||
    pathname.startsWith("/ma-boutique") ||
    pathname.startsWith("/affiliate") ||
    pathname.startsWith("/affilie");

  const hideForPro =
    !loading && isLogged && (caps.canAccessAdmin || caps.canAccessPro);

  if (hideByRoute || hideForPro) return null;

  return <FloatingCartButton />;
}

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
        comment.trim() || undefined,
      );

      setSuccess("Merci pour votre avis !");
      setTimeout(() => onClose(), 800);
    } catch {
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
                Vous avez reçu votre commande contenant :
                <br />
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

  useEffect(() => {
    if (!user) {
      setPendingRating(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await getPendingProductRating();

        if (!cancelled) {
          setPendingRating((res as PendingProductRating | null) ?? null);
        }
      } catch {
        if (!cancelled) {
          setPendingRating(null);
        }
      }
    })();

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
            <React.Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />

                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/verify" element={<VerifyAndResetPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrdersHistoryPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/comment-ca-marche" element={<CommentCaMarchePage />} />
                <Route path="/solutions" element={<SolutionsPage />} />
                <Route path="/solutions/:persona" element={<SolutionDetailPage />} />
                <Route path="/catalogue" element={<CataloguePage />} />
                <Route path="/pays" element={<PaysPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/rejoindre" element={<RejoindrePage />} />
                <Route path="/partenaires/catalogue" element={<CatalogueB2BPage />} />
                <Route path="/boutique/:slug" element={<ShopStorefrontPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* ✅ Publique : réservable sans compte (voir CourierBookingPage,
                    formulaire déjà basé sur un numéro de téléphone, pas sur une
                    session). "Mes courses"/le suivi restent protégées, elles
                    listent les courses d'un compte. */}
                <Route path="/courses/nouvelle" element={<CourierBookingPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="/mes-courses" element={<MyCourierTripsPage />} />
                  <Route path="/courses/:id/suivi" element={<CourierTripTrackingPage />} />
                </Route>

                <Route
                  element={
                    <RequireAuth
                      // ✅ Accès double rôle : basé sur la présence d'un profil
                      // livreur (has_livreur_profile), pas sur le rôle principal
                      // strict — un commercial qui devient aussi livreur y a accès.
                      allow={(v: any) => !!v.user?.has_livreur_profile}
                      redirectTo="/"
                    />
                  }
                >
                  <Route path="/livreur" element={<LivreurHome />} />
                </Route>

                <Route
                  element={
                    <RequireAuth
                      allow={(v: any) => !!v.user?.has_commercial_profile}
                      redirectTo="/"
                    />
                  }
                >
                  <Route path="/commercial" element={<CommercialHome />} />
                </Route>

                <Route path="/affiliate" element={<AffiliateDashboardPage />} />
                <Route path="/affilie" element={<AffiliateDashboardPage />} />
                <Route
                  path="/affiliate/dashboard"
                  element={<AffiliateDashboardPage />}
                />
                <Route
                  path="/affilie/dashboard"
                  element={<AffiliateDashboardPage />}
                />

                <Route path="/african-food" element={<AfricanFood />} />
                <Route
                  path="/african-food/:categorySlug"
                  element={<AfricanFood />}
                />
                <Route
                  path="/african-food/:categorySlug/:subCategorySlug"
                  element={<AfricanFood />}
                />

                <Route path="/african-market" element={<AfricanMarket />} />
                <Route
                  path="/african-market/:categorySlug"
                  element={<AfricanMarket />}
                />
                <Route
                  path="/african-market/:categorySlug/:subCategorySlug"
                  element={<AfricanMarket />}
                />

                <Route path="/fashion" element={<Fashion />} />
                <Route path="/fashion/:categorySlug" element={<Fashion />} />
                <Route
                  path="/fashion/:categorySlug/:subCategorySlug"
                  element={<Fashion />}
                />

                <Route
                  path="/share/product/:idOrSlug"
                  element={<ProductView />}
                />
                <Route path="/products/:idOrSlug" element={<ProductView />} />

                <Route path="/top-products" element={<TopProductsPage />} />
                <Route path="/promos" element={<PromotionsPage />} />
                <Route path="/test-can" element={<CanKickLottie />} />

                <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/terms" element={<Terms />} />
                <Route path="/legal/returns" element={<ReturnsPolicy />} />
                <Route path="/verify/:token" element={<PublicReceiptPage />} />
                <Route path="/r/:token" element={<PublicReceiptPage />} />

                <Route path="/admin" element={<ProtectedAdmin />}>
                  <Route element={<AdminShell />}>
                    <Route index element={<AdminHome />} />
                    <Route path="orders" element={<OrdersAdminPage />} />
                    <Route
                      path="products"
                      element={<ManageProductsPage scope="admin" />}
                    />
                    <Route path="shops" element={<ShopsAdminPage />} />
                    <Route
                      path="candidatures"
                      element={<VendorApplicationsAdminPage />}
                    />
                    <Route path="courses" element={<CourierTripsAdminPage />} />
                    <Route path="livreurs" element={<LivreurProfilesAdminPage />} />
                    <Route path="commerciaux" element={<CommercialsAdminPage />} />
                    <Route path="users" element={<UsersAdminPage />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                    <Route
                      path="promotions"
                      element={<PromotionsAdminPage />}
                    />
                    <Route path="ai/copy" element={<AiCopyPage />} />
                    <Route path="copy" element={<AiCopyPage />} />
                    <Route path="content-ai" element={<ContentAiPage />} />
                    <Route path="ads/meta" element={<AdsMetaPage />} />
                    <Route
                      path="reports/sales"
                      element={<ReportsSalesPage />}
                    />
                    <Route
                      path="reports/sales/:id"
                      element={<ReportSalesViewPage />}
                    />
                    <Route path="affiliates" element={<AffiliatesPage />} />
                    <Route
                      path="produits"
                      element={<Navigate to="/admin/products" replace />}
                    />
                    <Route
                      path="commandes"
                      element={<Navigate to="/admin/orders" replace />}
                    />
                    <Route
                      path="boutiques"
                      element={<Navigate to="/admin/shops" replace />}
                    />
                    <Route
                      path="utilisateurs"
                      element={<Navigate to="/admin/users" replace />}
                    />
                    <Route
                      path="promos"
                      element={<Navigate to="/admin/promotions" replace />}
                    />
                    <Route
                      path="depenses"
                      element={<Navigate to="/admin/expenses" replace />}
                    />
                  </Route>
                </Route>

                <Route
                  element={
                    <RequireAuth
                      allow={(v: any) =>
                        v.caps.canAccessPro || v.caps.canAccessAdmin
                      }
                      redirectTo="/"
                    />
                  }
                >
                  <Route
                    path="/vendeur"
                    element={<Navigate to="/ma-boutique" replace />}
                  />

                  <Route path="/ma-boutique" element={<Outlet />}>
                    <Route index element={<VendorHome />} />
                    <Route path="infos" element={<MyShopPage />} />
                  </Route>

                  <Route
                    path="/vendeur/produits"
                    element={<ManageProductsPage scope="vendor" />}
                  />
                  <Route
                    path="/vendeur/commandes"
                    element={<OrdersAdminPage />}
                  />
                  <Route
                    path="/vendeur/promotions"
                    element={<PromotionsAdminPage />}
                  />
                  <Route
                    path="/vendeur/fournisseurs"
                    element={<SupplierCatalogPage />}
                  />
                  <Route
                    path="/gestion/produit/:id"
                    element={<ProductStockLookupPage />}
                  />

                  <Route path="/entreprise" element={<CompaniesPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </React.Suspense>
          </main>

          <GuestOrderWidget />
          <ScrollTopButton threshold={380} offsetBottom={84} offsetRight={16} />
          <FloatingCartGuard />
          <Footer />
          <NotificationBubble />
          <CookieBanner />
          <SellIntentGate />

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