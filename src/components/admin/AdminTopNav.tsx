import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  FileBarChart2,
  Sparkles,
  Megaphone,
  Users,
  Store,
  Wallet,
  Menu as MenuIcon,
  X as CloseIcon,
  ChevronDown,
  WarehouseIcon,
  AlertTriangle,
  MapPin,
  Truck,
  CreditCard,
  Building2,
  ClipboardList,
} from "lucide-react";
import { me } from "../../services/auth";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  const computedTitle = useMemo(() => {
    if (title && title !== "Espace admin") return title;
    return isVendor ? "Espace vendeur" : "Espace admin";
  }, [title, isVendor]);

  const groups = useMemo<NavGroup[]>(() => {
    const g: NavGroup[] = [
      {
        label: "Vue d'ensemble",
        items: [
          { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
          ...(!isVendor
            ? [{ to: "/admin/weekly-report", label: "Compte-rendu hebdo", icon: ClipboardList }]
            : []),
        ],
      },
      {
        label: "Ventes",
        items: [
          { to: "/admin/orders", label: "Commandes", icon: ShoppingBag },
          { to: "/admin/products", label: "Produits", icon: Boxes },
        ],
      },
      {
        label: "Finances",
        items: [
          { to: "/admin/expenses", label: "Dépenses", icon: Wallet },
          { to: "/admin/debts", label: "Créances clients", icon: AlertTriangle },
          { to: "/admin/client-zones", label: "Zones clients", icon: MapPin },
          ...(!isVendor
            ? [
                { to: "/admin/reports/sales", label: "Rapports", icon: FileBarChart2 },
                { to: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
                { to: "/admin/operations", label: "Operations", icon: ClipboardList },
              ]
            : []),
        ],
      },
    ];

    if (!isVendor) {
      g.push({
        label: "Réseau",
        items: [
          { to: "/admin/shops", label: "Boutiques", icon: Store },
          { to: "/admin/suppliers", label: "Fournisseurs", icon: Building2 },
          { to: "/admin/vendors", label: "Vendeurs", icon: Store },
          { to: "/admin/users", label: "Utilisateurs", icon: Users },
          { to: "/admin/warehouses", label: "Entrepôts & Stock", icon: WarehouseIcon },
          { to: "/admin/supplier-deliveries", label: "Livraisons fournisseurs", icon: Truck },
        ],
      });
      g.push({
        label: "Outils",
        items: [
          { to: "/admin/content-ai", label: "Contenu IA", icon: Sparkles },
          { to: "/admin/ads/meta", label: "Publicités Meta", icon: Megaphone },
        ],
      });
    }

    return g;
  }, [isVendor]);

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
            max-height: calc(100vh - 2rem);
            overflow-y: auto;
          }
        }
        .admin-sidebar-card{
          background: var(--duu-black);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--dz-radius-lg);
          box-shadow: var(--dz-shadow-sm);
          padding: 1rem;
          font-family: var(--dz-font-body);
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
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          background: none;
          border: none;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: rgba(207,227,216,0.55);
          padding: .3rem .6rem;
          margin-bottom: .2rem;
          cursor: pointer;
        }
        .admin-sidebar-group-label:hover{
          color: rgba(207,227,216,0.85);
        }
        .admin-sidebar-group-chevron{
          transition: transform .15s ease;
          flex-shrink: 0;
        }
        .admin-sidebar-group-chevron.collapsed{
          transform: rotate(-90deg);
        }
        .admin-sidebar-link{
          display: flex;
          align-items: center;
          gap: .6rem;
          padding: .55rem .6rem;
          border-radius: var(--dz-radius-md);
          color: #CFE3D8;
          font-weight: 600;
          font-size: .92rem;
          text-decoration: none;
          margin-bottom: .2rem;
          transition: background .15s ease, color .15s ease;
        }
        .admin-sidebar-link:hover{
          background: rgba(255,255,255,0.08);
          color: #ffffff;
        }
        .admin-sidebar-link.active{
          background: var(--duu-yellow);
          color: var(--duu-black);
        }
      `}</style>

      <div className="admin-sidebar-card">
        {showTitle && (
          <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
            <div>
              <div className="dz-display fw-semibold" style={{ fontSize: "1.1rem", color: "#FFFFFF" }}>
                {computedTitle}
              </div>
              <div style={{ fontSize: ".85rem", color: "rgba(207,227,216,0.7)" }}>
                {isVendor
                  ? "Ventes, produits et dépenses."
                  : "Ventes, boutiques, utilisateurs, affiliés."}
              </div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <span
                  className="rounded-pill px-3 py-1"
                  style={{
                    background: "var(--duu-yellow)",
                    color: "var(--duu-black)",
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
                      background: "rgba(255,255,255,0.08)",
                      color: "#FFFFFF",
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
              className="admin-sidebar-mobile-toggle btn btn-sm"
              style={{ borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label="Basculer le menu admin"
            >
              {mobileOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
            </button>
          </div>
        )}

        <div className={`admin-sidebar-body ${mobileOpen ? "open" : ""}`}>
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label);
            return (
              <div className="admin-sidebar-group" key={group.label}>
                <button
                  type="button"
                  className="admin-sidebar-group-label"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.label)) next.delete(group.label);
                      else next.add(group.label);
                      return next;
                    })
                  }
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={14}
                    className={`admin-sidebar-group-chevron ${isCollapsed ? "collapsed" : ""}`}
                  />
                </button>

                {!isCollapsed &&
                  group.items.map((item) => {
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
            );
          })}
        </div>
      </div>
    </nav>
  );
}
