import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Percent,
  FileBarChart2,
  Sparkles,
  Users,
  Store,
  Wallet,
  BadgePercent,
  UserPlus,
  Menu as MenuIcon,
  X as CloseIcon,
} from "lucide-react";
import { me } from "../../services/auth";
import { getMyAffiliate } from "../../services/affiliates";

type AnyObj = Record<string, any>;

type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
  first_name?: string;
  last_name?: string;
  name?: string;
} & AnyObj;

function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return (
    r === "VENDEUR" ||
    r === "VENDOR" ||
    r === "SELLER" ||
    r === "SHOP" ||
    r === "BOUTIQUE" ||
    r === "RESTAURANT" ||
    r === "FOURNISSEUR"
  );
}

function getDisplayName(user?: CurrentUser | null) {
  const full = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  if (full) return full;
  if (user?.name) return String(user.name);
  return "";
}

type NavItem = {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export default function AdminTopNav({
  showTitle = true,
  title = "Espace admin",
}: {
  showTitle?: boolean;
  title?: string;
}) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (!mounted) return;
        setUser((u as any) || null);
      } catch {
        if (!mounted) return;
        setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ L'affiliation est une permission à part entière (indépendante du
  // rôle du compte) : on ne montre "Mon espace affilié" que si l'utilisateur
  // a effectivement un profil affilié actif.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getMyAffiliate();
        if (mounted) setIsAffiliate(!!res?.is_affiliate);
      } catch {
        if (mounted) setIsAffiliate(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  const computedTitle = useMemo(() => {
    if (title && title !== "Espace admin") return title;
    return isVendor ? "Espace vendeur" : "Espace admin";
  }, [title, isVendor]);

  const groups = useMemo<NavGroup[]>(() => {
    const g: NavGroup[] = [
      {
        label: "Vue d'ensemble",
        items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }],
      },
      {
        label: "Ventes",
        items: [
          { to: "/admin/orders", label: "Commandes", icon: ShoppingBag },
          { to: "/admin/products", label: "Produits", icon: Boxes },
          { to: "/admin/promotions", label: "Promotions", icon: Percent },
        ],
      },
      {
        label: "Finances",
        items: [
          { to: "/admin/expenses", label: "Dépenses", icon: Wallet },
          ...(isAffiliate
            ? [{ to: "/affiliate", label: "Mon espace affilié", icon: BadgePercent }]
            : []),
          ...(!isVendor
            ? [
                { to: "/admin/reports/sales", label: "Rapports", icon: FileBarChart2 },
                { to: "/admin/affiliates", label: "Affiliés", icon: BadgePercent },
              ]
            : []),
        ],
      },
    ];

    if (!isVendor) {
      g.push({
        label: "Réseau",
        items: [
          { to: "/admin/candidatures", label: "Candidatures", icon: UserPlus },
          { to: "/admin/shops", label: "Boutiques", icon: Store },
          { to: "/admin/users", label: "Utilisateurs", icon: Users },
        ],
      });
      g.push({
        label: "Outils",
        items: [{ to: "/admin/content-ai", label: "Contenu IA", icon: Sparkles }],
      });
    }

    return g;
  }, [isVendor, isAffiliate]);

  return (
    <nav aria-label="Menu admin" className="admin-sidebar">
      <style>{`
        .admin-sidebar{
          width: 100%;
        }
        @media (min-width: 992px){
          .admin-sidebar{
            width: 264px;
            flex-shrink: 0;
            position: sticky;
            top: 1rem;
          }
        }
        .admin-sidebar-card{
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: var(--duu-radius-lg);
          box-shadow: var(--duu-shadow-sm);
          padding: 1rem;
        }
        .admin-sidebar-mobile-toggle{
          display: flex;
        }
        @media (min-width: 992px){
          .admin-sidebar-mobile-toggle{ display: none; }
        }
        .admin-sidebar-body{
          display: none;
        }
        .admin-sidebar-body.open{
          display: block;
        }
        @media (min-width: 992px){
          .admin-sidebar-body{ display: block; }
        }
        .admin-sidebar-group{ margin-bottom: 1rem; }
        .admin-sidebar-group:last-child{ margin-bottom: 0; }
        .admin-sidebar-group-label{
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: rgba(17,17,17,0.45);
          padding: 0 .6rem;
          margin-bottom: .4rem;
        }
        .admin-sidebar-link{
          display: flex;
          align-items: center;
          gap: .6rem;
          padding: .55rem .6rem;
          border-radius: var(--duu-radius-md);
          color: #222222;
          font-weight: 600;
          font-size: .92rem;
          text-decoration: none;
          margin-bottom: .2rem;
          transition: background .15s ease, color .15s ease;
        }
        .admin-sidebar-link:hover{
          background: rgba(var(--duu-orange-rgb), .08);
          color: #111111;
        }
        .admin-sidebar-link.active{
          background: var(--duu-orange);
          color: #ffffff;
        }
      `}</style>

      <div className="admin-sidebar-card">
        {showTitle && (
          <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
            <div>
              <div className="fw-bold" style={{ fontSize: "1.1rem", color: "#111111" }}>
                {computedTitle}
              </div>
              <div style={{ fontSize: ".85rem", color: "rgba(17,17,17,0.65)" }}>
                {isVendor
                  ? "Ventes, produits, promotions et dépenses."
                  : "Ventes, boutiques, utilisateurs, affiliés."}
              </div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <span
                  className="rounded-pill px-3 py-1"
                  style={{
                    background: "rgba(var(--duu-orange-rgb), .14)",
                    color: "var(--duu-orange)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  {isVendor ? "Vendeur" : "Administrateur"}
                </span>
                {getDisplayName(user) ? (
                  <span
                    className="rounded-pill px-3 py-1 text-truncate"
                    style={{
                      background: "#F5F5F5",
                      color: "#222",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      maxWidth: 160,
                    }}
                  >
                    {getDisplayName(user)}
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              className="admin-sidebar-mobile-toggle btn btn-sm btn-outline-secondary"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label="Basculer le menu admin"
            >
              {mobileOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
            </button>
          </div>
        )}

        <div className={`admin-sidebar-body ${mobileOpen ? "open" : ""}`}>
          {groups.map((group) => (
            <div className="admin-sidebar-group" key={group.label}>
              <div className="admin-sidebar-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `admin-sidebar-link ${isActive ? "active" : ""}`
                    }
                  >
                    <Icon size={17} strokeWidth={2.1} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
