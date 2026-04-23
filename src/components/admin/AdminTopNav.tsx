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
  adminOnly?: boolean;
};

export default function AdminTopNav({
  showTitle = true,
  title = "Espace admin",
}: {
  showTitle?: boolean;
  title?: string;
}) {
  const [user, setUser] = useState<CurrentUser | null>(null);

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

  const items = useMemo<NavItem[]>(
    () => [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/orders", label: "Commandes", icon: ShoppingBag },
      { to: "/admin/products", label: "Produits", icon: Boxes },
      { to: "/admin/promotions", label: "Promotions", icon: Percent },
      { to: "/admin/expenses", label: "Dépenses", icon: Wallet },
      {
        to: "/admin/affiliates",
        label: "Affiliés",
        icon: BadgePercent,
        adminOnly: true,
      },
      {
        to: "/admin/reports/sales",
        label: "Rapports",
        icon: FileBarChart2,
        adminOnly: true,
      },
      {
        to: "/admin/content-ai",
        label: "Contenu IA",
        icon: Sparkles,
        adminOnly: true,
      },
      {
        to: "/admin/users",
        label: "Utilisateurs",
        icon: Users,
        adminOnly: true,
      },
      {
        to: "/admin/shops",
        label: "Boutiques",
        icon: Store,
        adminOnly: true,
      },
    ],
    []
  );

  const visibleItems = useMemo(() => {
    return items.filter((item) => !(item.adminOnly && isVendor));
  }, [items, isVendor]);

  return (
    <nav aria-label="Menu admin" className="mb-4">
      <div
        className="rounded-4 border shadow-sm p-3 p-md-4"
        style={{
          background: "#ffffff",
          borderColor: "rgba(0,0,0,0.08)",
        }}
      >
        {showTitle && (
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-3">
            <div>
              <div
                className="fw-bold"
                style={{
                  fontSize: "1.15rem",
                  color: "#111111",
                }}
              >
                {computedTitle}
              </div>
              <div
                style={{
                  fontSize: "0.92rem",
                  color: "rgba(17,17,17,0.65)",
                }}
              >
                {isVendor
                  ? "Gérez facilement vos ventes, produits, promotions et dépenses."
                  : "Pilotez votre administration, vos boutiques, utilisateurs, affiliés et performances."}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span
                className="rounded-pill px-3 py-2"
                style={{
                  background: "#FFF6D8",
                  color: "#9A6B00",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                {isVendor ? "Vendeur" : "Administrateur"}
              </span>

              {getDisplayName(user) ? (
                <span
                  className="rounded-pill px-3 py-2"
                  style={{
                    background: "#F5F5F5",
                    color: "#222",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                  }}
                >
                  {getDisplayName(user)}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="d-flex flex-wrap gap-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="text-decoration-none"
                style={{ minWidth: "fit-content" }}
              >
                {({ isActive }) => (
                  <div
                    className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                    style={{
                      background: isActive ? "#111111" : "#F7F7F7",
                      color: isActive ? "#FFD24A" : "#222222",
                      border: isActive
                        ? "1px solid #111111"
                        : "1px solid rgba(0,0,0,0.06)",
                      transition: "all 0.2s ease",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                    }}
                  >
                    <Icon size={16} strokeWidth={2.1} />
                    <span>{item.label}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}