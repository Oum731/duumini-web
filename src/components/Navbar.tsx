// src/components/Navbar.tsx
import { Link, NavLink } from "react-router-dom";
import { useState, useMemo } from "react";
import {
  ShoppingCart,
  UserRound,
  Shield,
  Store,
  Home,
  Info,
  Mail,
  Package,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Role = "MEMBER" | "VENDEUR" | "LIVREUR" | "ADMIN";

type Props = {
  cartCount?: number;
};

export default function Navbar({ cartCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const { isLoggedIn, isAdmin, isVendor } = useMemo(() => {
    const role = (user?.role ? String(user.role) : "").trim().toUpperCase() as Role | "";
    return {
      isLoggedIn: !!user,
      isAdmin: role === "ADMIN",
      isVendor: role === "VENDEUR",
    };
  }, [user]);

  const navItem = (
    to: string,
    label: string,
    Icon?: React.ComponentType<any>,
    opts?: { end?: boolean; onClick?: () => void }
  ) => (
    <li className="nav-item">
      <NavLink
        to={to}
        end={opts?.end}
        className={({ isActive }) =>
          `nav-link d-flex align-items-center gap-2 ${isActive ? "active" : ""}`
        }
        onClick={() => {
          setOpen(false);
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
      style={{ backgroundColor: "var(--duu-yellow)" }}
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="container-xxl">
        <Link to="/" className="navbar-brand d-flex align-items-center gap-2" onClick={() => setOpen(false)}>
          <img src="/logo.jpeg" alt="Duumini" height={32} className="rounded" />
          <span className="fw-bold" style={{ color: "var(--duu-black)" }}>Duumini</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          aria-expanded={open}
          aria-label="Basculer la navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse justify-content-end ${open ? "show" : ""}`}>
          <ul className="navbar-nav mb-2 mb-lg-0 me-lg-3">
            {navItem("/", "Accueil", Home, { end: true })}
            {navItem("/contact", "Contact", Mail)}
            {navItem("/about", "À propos", Info)}

            {isLoggedIn && navItem("/orders", "Mes commandes", Package)}

            {/* Affichage conditionnel selon rôle (venant du contexte → DB) */}
            {isAdmin && navItem("/admin", "Dashboard", Shield)}
            {isVendor && navItem("/ma-boutique", "Ma boutique", Store)}

            {navItem("/profile", isLoggedIn ? "Profil" : "Se connecter", UserRound)}
          </ul>

          <ul className="navbar-nav align-items-lg-center">
            <li className="nav-item">
              <NavLink
                to="/cart"
                aria-label="Ouvrir le panier"
                className={({ isActive }) =>
                  `btn d-flex align-items-center gap-2 position-relative ${
                    isActive ? "btn-dark border-0" : "btn-outline-dark"
                  }`
                }
                onClick={() => setOpen(false)}
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
