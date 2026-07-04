// src/components/Navbar.tsx
import React, { useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  UserRound,
  Shield,
  Store,
  Home,
  Info,
  Mail,
  Package,
  ChevronDown,
  ArrowLeft,
  Settings,
  BadgePercent,
  Workflow,
  Briefcase,
  Globe2,
  BookOpen,
  UserPlus,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DUUMINI_SLOGAN } from "../lib/brand";

type Role =
  | "MEMBER"
  | "VENDEUR"
  | "FOURNISSEUR"
  | "RESTAURANT"
  | "LIVREUR"
  | "ADMIN";

type Props = {
  cartCount?: number;
};

type NavLinkDef = {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
};

// ✅ Liens publics de la vitrine, visibles pour tout le monde (voir isPro
// plus bas pour le dropdown "Espace pro" ajouté en plus pour les comptes
// admin/vendeur/fournisseur/restaurant).
const PUBLIC_NAV_LINKS: NavLinkDef[] = [
  { to: "/comment-ca-marche", label: "Comment ça marche", Icon: Workflow },
  { to: "/solutions", label: "Solutions", Icon: Briefcase },
  { to: "/pays", label: "Pays", Icon: Globe2 },
  { to: "/about", label: "À propos", Icon: Info },
  { to: "/blog", label: "Blog", Icon: BookOpen },
  { to: "/contact", label: "Contact", Icon: Mail },
];

const SHOP_LINKS: NavLinkDef[] = [
  { to: "/african-market", label: "Duumini Market", Icon: Store },
  { to: "/african-food", label: "Duumini Food", Icon: Store },
  { to: "/fashion", label: "Duumini Fashion", Icon: Store },
];

export default function Navbar({ cartCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { isLoggedIn, isAdmin, isVendor, isSupplier, isRestaurantRole, isPro } =
    useMemo(() => {
      const role = (user?.role ? String(user.role) : "")
        .trim()
        .toUpperCase() as Role | "";
      const isAdmin = role === "ADMIN";
      const isVendor = role === "VENDEUR";
      const isSupplier = role === "FOURNISSEUR";
      const isRestaurantRole = role === "RESTAURANT";
      return {
        isLoggedIn: !!user,
        isAdmin,
        isVendor,
        isSupplier,
        isRestaurantRole,
        isPro: isAdmin || isVendor || isSupplier || isRestaurantRole,
      };
    }, [user]);

  // ✅ vendeur -> /ma-boutique (VendorHome), admin -> /admin
  const proDashboardPath = isAdmin ? "/admin" : "/ma-boutique";

  const closeMenus = () => {
    setOpen(false);
    setProOpen(false);
    setShopOpen(false);
  };

  const navItem = (
    to: string,
    label: string,
    Icon?: React.ComponentType<any>,
    opts?: { end?: boolean; onClick?: () => void }
  ) => (
    <li className="nav-item" key={to}>
      <NavLink
        to={to}
        end={opts?.end}
        className={({ isActive }) =>
          `nav-link d-flex align-items-center gap-2 ${isActive ? "active" : ""}`
        }
        onClick={() => {
          closeMenus();
          opts?.onClick?.();
        }}
        aria-label={label}
      >
        {Icon ? <Icon size={18} /> : null}
        <span>{label}</span>
      </NavLink>
    </li>
  );

  return (
    <nav
      className="navbar navbar-expand-lg navbar-light sticky-top"
      style={{ backgroundColor: "#fff" }}
      role="navigation"
      aria-label="Navigation principale"
    >
      <style>{`
        /* ✅ Navbar B2B : hover/actif/focus recolorés en orange, scopé à cette
           navbar uniquement (le .nav-link/.active::after global de theme.css
           reste rouge pour AdminTopNav et les autres usages). */
        .navbar .nav-link:hover{ color: var(--duu-orange) !important; }
        .navbar .nav-link.active::after,
        .navbar .nav-link:focus-visible::after{
          background: var(--duu-orange) !important;
        }
        .navbar .nav-link:focus-visible{
          box-shadow: 0 0 0 .2rem rgba(var(--duu-orange-rgb), .35) !important;
        }
        .navbar .navbar-toggler:focus{
          box-shadow: 0 0 0 .2rem rgba(var(--duu-orange-rgb), .35) !important;
        }
        .duu-brand-wrap{ min-width: 0; }
        .duu-brand-slogan{
          font-weight: 800;
          color: rgba(0,0,0,.70);
          font-size: .78rem;
          line-height: 1.05;
          margin-top: -2px;
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 420px){
          .duu-brand-slogan{ max-width: 180px; }
        }
        .pro-dd{ position: relative; }
        .pro-menu{
          position: absolute;
          right: 0;
          top: calc(100% + .5rem);
          width: min(280px, 92vw);
          background: #fff;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,.12);
          padding: .5rem;
          z-index: 1030;
        }
        .pro-menu a, .pro-menu button{
          display: flex;
          align-items: center;
          gap: .5rem;
          padding: .5rem .6rem;
          border-radius: 10px;
          color: #111;
          text-decoration: none;
          width: 100%;
          background: transparent;
          border: 0;
          text-align: left;
        }
        .pro-menu a:hover, .pro-menu button:hover{ background: rgba(0,0,0,.05); }
        .pro-sep{ height: 1px; background: rgba(0,0,0,.08); margin: .35rem 0; }
        .pro-mini{
          font-size: .78rem;
          color: rgba(0,0,0,.55);
          padding: .25rem .6rem .15rem;
        }
        /* ✅ CTA "Acheter" : chemin client final, mis en avant en orange pour
           se distinguer des liens B2B informatifs de PUBLIC_NAV_LINKS. */
        .shop-cta{
          color: var(--duu-orange) !important;
          font-weight: 700;
        }
        .shop-cta:hover{ color: var(--duu-orange) !important; }
      `}</style>

      <div className="container-xxl">
        <Link
          to="/"
          className="navbar-brand d-flex align-items-center gap-2"
          onClick={closeMenus}
        >
          <img src="/logo.jpeg" alt="Duumini" height={32} className="rounded" />

          <div className="duu-brand-wrap">

            <div className="duu-brand-slogan" title={DUUMINI_SLOGAN}>
              {DUUMINI_SLOGAN}
            </div>
          </div>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          aria-expanded={open}
          aria-label="Basculer la navigation"
          onClick={() => {
            setOpen((v) => !v);
            setProOpen(false);
          }}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div
          className={`collapse navbar-collapse justify-content-end ${
            open ? "show" : ""
          }`}
        >
          <ul className="navbar-nav mb-2 mb-lg-0 me-lg-3">
            {navItem("/", "Accueil", Home, { end: true })}

            {/* ✅ Point d'entrée client final : acheter sur Market/Food/Fashion,
                mis en avant car absent des liens B2B ci-dessous. */}
            <li className="nav-item pro-dd">
              <button
                type="button"
                className="nav-link d-flex align-items-center gap-2 shop-cta"
                onClick={() => setShopOpen((v) => !v)}
                aria-expanded={shopOpen}
                aria-label="Acheter"
              >
                <ShoppingCart size={18} />
                <span>Acheter</span>
                <ChevronDown size={16} />
              </button>

              {shopOpen && (
                <div className="pro-menu" role="menu">
                  {SHOP_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} onClick={closeMenus}>
                      <l.Icon size={18} />
                      <span>{l.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </li>

            {/* ✅ Liens vitrine publics — toujours visibles, y compris pour
                les comptes pro (admin/vendeur/fournisseur/restaurant) */}
            {PUBLIC_NAV_LINKS.map((l) =>
              navItem(l.to, l.label, l.Icon, { end: l.end })
            )}

            {isLoggedIn && navItem("/orders", "Mes commandes", Package)}

            {/* ✅ Espace pro dropdown */}
            {isPro && (
              <li className="nav-item pro-dd">
                <button
                  type="button"
                  className="nav-link d-flex align-items-center gap-2"
                  onClick={() => setProOpen((v) => !v)}
                  aria-expanded={proOpen}
                  aria-label="Espace pro"
                >
                  {isAdmin ? <Shield size={18} /> : <Store size={18} />}
                  <span>Espace pro</span>
                  <ChevronDown size={16} />
                </button>

                {proOpen && (
                  <div className="pro-menu" role="menu">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus();
                        navigate(-1);
                      }}
                      aria-label="Retour"
                      title="Retour"
                    >
                      <ArrowLeft size={18} />
                      <span>Retour</span>
                    </button>

                    <div className="pro-sep" />

                    <Link
                      to={proDashboardPath}
                      onClick={closeMenus}
                      aria-label={isAdmin ? "Dashboard admin" : "Ma boutique"}
                    >
                      {isAdmin ? <Shield size={18} /> : <Store size={18} />}
                      <span>{isAdmin ? "Dashboard admin" : "Ma boutique"}</span>
                    </Link>

                    {isAdmin && (
                      <>
                        <div className="pro-sep" />
                        <div className="pro-mini">Raccourcis admin</div>

                        <Link to="/admin/orders" onClick={closeMenus}>
                          <Package size={18} />
                          <span>Commandes</span>
                        </Link>

                        <Link to="/admin/products" onClick={closeMenus}>
                          <Store size={18} />
                          <span>Produits</span>
                        </Link>

                        <Link to="/admin/promotions" onClick={closeMenus}>
                          <BadgePercent size={18} />
                          <span>Promotions</span>
                        </Link>

                        <Link to="/admin/candidatures" onClick={closeMenus}>
                          <UserPlus size={18} />
                          <span>Candidatures</span>
                        </Link>
                      </>
                    )}

                    {(isVendor || isSupplier || isRestaurantRole) && !isAdmin && (
                      <>
                        <div className="pro-sep" />
                        <div className="pro-mini">Outils vendeur</div>

                        <Link to="/ma-boutique/infos" onClick={closeMenus}>
                          <Settings size={18} />
                          <span>Infos boutique</span>
                        </Link>

                        <Link to="/vendeur/commandes" onClick={closeMenus}>
                          <Package size={18} />
                          <span>Mes commandes</span>
                        </Link>

                        <Link to="/vendeur/produits" onClick={closeMenus}>
                          <Store size={18} />
                          <span>Mes produits</span>
                        </Link>

                        <Link to="/vendeur/promotions" onClick={closeMenus}>
                          <BadgePercent size={18} />
                          <span>Promotions</span>
                        </Link>

                        <Link to="/vendeur/fournisseurs" onClick={closeMenus}>
                          <Truck size={18} />
                          <span>Catalogue fournisseurs</span>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </li>
            )}

            {navItem("/profile", isLoggedIn ? "Profil" : "Se connecter", UserRound)}
          </ul>

          <ul className="navbar-nav align-items-lg-center gap-lg-2">
            {!isPro && (
              <li className="nav-item">
                <Link
                  to="/rejoindre"
                  className="btn btn-duu-green"
                  onClick={closeMenus}
                >
                  Rejoindre DUUMINI
                </Link>
              </li>
            )}

            <li className="nav-item">
              <NavLink
                to="/cart"
                aria-label="Ouvrir le panier"
                className={({ isActive }) =>
                  `btn d-flex align-items-center gap-2 position-relative ${
                    isActive ? "btn-dark border-0" : "btn-outline-dark"
                  }`
                }
                onClick={closeMenus}
              >
                <ShoppingCart size={18} />
                <span className="d-none d-sm-inline">Panier</span>

                {cartCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                    style={{ background: "var(--duu-red)", fontSize: 11 }}
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                    <span className="visually-hidden">articles</span>
                  </span>
                )}
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}