// src/App.tsx
import React, { useEffect } from "react";
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

/** 🧭 Page d’atterrissage :
 * - si user connecté → Home
 * - sinon → /profile?tab=login
 */
function LandingRedirect() {
  const u = getCurrentUser();
  return u ? <Home /> : <Navigate to="/profile?tab=login" replace />;
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

export default function App() {
  return (
    <CartProvider>
      <div className="min-vh-100 d-flex flex-column">
        <ScrollToTop />
        <NavbarWithCount />
        <main className="flex-fill">
          <React.Suspense
            fallback={
              <div className="container-xxl py-5 text-muted">Chargement…</div>
            }
          >
            <Routes>
              {/* 👇 ICI : route racine pilotée */}
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

              {/* ✅ Pages légales */}
              <Route path="/legal/privacy" element={<PrivacyPolicy />} />
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/legal/returns" element={<ReturnsPolicy />} />

              {/* Admin protégé */}
              <Route path="/admin" element={<ProtectedAdmin />}>
                <Route element={<AdminShell />}>
                  <Route index element={<AdminHome />} />
                  <Route path="orders" element={<OrdersAdminPage />} />
                  <Route path="products" element={<ProductsAdminPage />} />
                  <Route path="shops" element={<ShopsAdminPage />} />
                  <Route path="users" element={<UsersAdminPage />} />
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

        <ScrollTopButton threshold={380} offsetBottom={84} offsetRight={16} />
        <FloatingCartGuard />
        <Footer />
      </div>
    </CartProvider>
  );
}
