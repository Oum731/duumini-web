// src/components/Navbar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  LayoutGrid,
  Bike,
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
  | "COMMERCIAL"
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

// ✅ Liens publics de la vitrine, toujours visibles au premier niveau
// (voir isPro plus bas pour le dropdown "Espace pro" ajouté en plus pour
// les comptes admin/vendeur/fournisseur/restaurant).
const PUBLIC_NAV_LINKS: NavLinkDef[] = [
  { to: "/solutions", label: "Solutions", Icon: Briefcase },
  { to: "/contact", label: "Contact", Icon: Mail },
];

// ✅ Liens secondaires/informatifs regroupés sous "Découvrir" pour éviter
// de surcharger la barre — sinon 12 items+ à plat débordent dès ~1440px.
const DISCOVER_LINKS: NavLinkDef[] = [
  { to: "/comment-ca-marche", label: "Comment ça marche", Icon: Workflow },
  { to: "/pays", label: "Pays", Icon: Globe2 },
  { to: "/about", label: "Notre vision", Icon: Info },
  { to: "/blog", label: "Ressources", Icon: BookOpen },
];

const SHOP_LINKS: NavLinkDef[] = [
  { to: "/catalogue", label: "Catalogue", Icon: LayoutGrid },
  { to: "/african-market", label: "Duumini Market", Icon: Store },
  { to: "/african-food", label: "Duumini Food", Icon: Store },
  { to: "/fashion", label: "Duumini Fashion", Icon: Store },
  { to: "/courses/nouvelle", label: "Commander un livreur", Icon: Bike },
];

export default function Navbar({ cartCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);

  const {
    isLoggedIn,
    isAdmin,
    isVendor,
    isSupplier,
    isRestaurantRole,
    hasLivreurAccess,
    hasCommercialAccess,
    isPro,
  } = useMemo(() => {
      const role = (user?.role ? String(user.role) : "")
        .trim()
        .toUpperCase() as Role | "";
      const isAdmin = role === "ADMIN";
      const isVendor = role === "VENDEUR";
      const isSupplier = role === "FOURNISSEUR";
      const isRestaurantRole = role === "RESTAURANT";
      const isLivreurRole = role === "LIVREUR";
      const isCommercialRole = role === "COMMERCIAL";
      // ✅ Accès double rôle (ex. livreur devenu aussi commercial) : basé sur
      // la présence d'un profil dédié, pas seulement sur le rôle principal
      // (voir has_livreur_profile/has_commercial_profile côté API).
      const hasLivreurAccess = isLivreurRole || !!user?.has_livreur_profile;
      const hasCommercialAccess = isCommercialRole || !!user?.has_commercial_profile;
      return {
        isLoggedIn: !!user,
        isAdmin,
        isVendor,
        isSupplier,
        isRestaurantRole,
        hasLivreurAccess,
        hasCommercialAccess,
        isPro:
          isAdmin ||
          isVendor ||
          isSupplier ||
          isRestaurantRole ||
          hasLivreurAccess ||
          hasCommercialAccess,
      };
    }, [user]);

  // ✅ Espace pro : un utilisateur peut cumuler plusieurs accès (ex. livreur
  // + commercial) — on liste toutes les entrées applicables plutôt que d'en
  // choisir une seule par priorité. Admin reste seul (pas de cumul prévu).
  const proDashboardLinks: { to: string; label: string; Icon: LucideIcon }[] = isAdmin
    ? [{ to: "/admin", label: "Dashboard admin", Icon: Shield }]
    : [
        ...(hasLivreurAccess
          ? [{ to: "/livreur", label: "Espace livreur", Icon: Bike }]
          : []),
        ...(hasCommercialAccess
          ? [{ to: "/commercial", label: "Espace commercial", Icon: Briefcase }]
          : []),
        ...(isVendor || isSupplier || isRestaurantRole
          ? [{ to: "/ma-boutique", label: "Ma boutique", Icon: Store }]
          : []),
      ];

  const closeMenus = () => {
    setOpen(false);
    setProOpen(false);
    setShopOpen(false);
    setDiscoverOpen(false);
  };

  const anyMenuOpen = open || proOpen || shopOpen || discoverOpen;

  // ✅ Clic n'importe où en dehors de la navbar (ou touche Échap) ferme le
  // menu mobile et les dropdowns ouverts — jusqu'ici seul un clic sur un
  // lien à l'intérieur les fermait.
  useEffect(() => {
    if (!anyMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        closeMenus();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenus();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anyMenuOpen]);

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
      ref={navRef}
      className="navbar navbar-expand-xl navbar-light sticky-top"
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
        /* ✅ Barre horizontale compacte au-delà de 1200px (= navbar-expand-xl,
           le seuil réel où la nav passe en ligne) : icônes des liens de
           premier niveau masquées (gardées en menu mobile empilé où la
           place ne manque pas) + padding resserré, pour éviter tout
           débordement horizontal avec ~7 liens + logo + boutons. */
        @media (min-width: 1200px){
          .navbar-nav > .nav-item > .nav-link{
            padding-left: .6rem;
            padding-right: .6rem;
          }
          .navbar-nav > .nav-item > .nav-link svg:first-child{
            display: none;
          }
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
          <ul className="navbar-nav mb-2 mb-xl-0 me-xl-3">
            {navItem("/", "Accueil", Home, { end: true })}

            {/* ✅ Point d'entrée client final : acheter sur Market/Food/Fashion,
                mis en avant car absent des liens B2B ci-dessous. */}
            <li className="nav-item pro-dd">
              <button
                type="button"
                className="nav-link d-flex align-items-center gap-2 shop-cta"
                onClick={() => {
                  setProOpen(false);
                  setDiscoverOpen(false);
                  setShopOpen((v) => !v);
                }}
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

            {/* ✅ Liens secondaires regroupés pour ne pas surcharger la barre */}
            <li className="nav-item pro-dd">
              <button
                type="button"
                className="nav-link d-flex align-items-center gap-2"
                onClick={() => {
                  setShopOpen(false);
                  setProOpen(false);
                  setDiscoverOpen((v) => !v);
                }}
                aria-expanded={discoverOpen}
                aria-label="Découvrir"
              >
                <span>Découvrir</span>
                <ChevronDown size={16} />
              </button>

              {discoverOpen && (
                <div className="pro-menu" role="menu">
                  {DISCOVER_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} onClick={closeMenus}>
                      <l.Icon size={18} />
                      <span>{l.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </li>

            {isLoggedIn && navItem("/orders", "Mes commandes", Package)}

            {/* ✅ Espace pro dropdown */}
            {isPro && (
              <li className="nav-item pro-dd">
                <button
                  type="button"
                  className="nav-link d-flex align-items-center gap-2"
                  onClick={() => {
                    setShopOpen(false);
                    setDiscoverOpen(false);
                    setProOpen((v) => !v);
                  }}
                  aria-expanded={proOpen}
                  aria-label="Espace pro"
                >
                  {isAdmin ? (
                    <Shield size={18} />
                  ) : hasLivreurAccess ? (
                    <Bike size={18} />
                  ) : hasCommercialAccess ? (
                    <Briefcase size={18} />
                  ) : (
                    <Store size={18} />
                  )}
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

                    {proDashboardLinks.map(({ to, label, Icon }) => (
                      <Link key={to} to={to} onClick={closeMenus} aria-label={label}>
                        <Icon size={18} />
                        <span>{label}</span>
                      </Link>
                    ))}

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

            {navItem("/profile", isLoggedIn ? "Mon espace" : "Se connecter", UserRound)}
          </ul>

          <ul className="navbar-nav align-items-xl-center gap-xl-2">
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