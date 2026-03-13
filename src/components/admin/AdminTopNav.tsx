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
  ShieldCheck,
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

function getInitials(user?: CurrentUser | null) {
  const full =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    String(user?.name || "").trim() ||
    String(user?.role || "A");
  return full
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("");
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

  const subtitle = useMemo(() => {
    return isVendor
      ? "Pilotez vos ventes, produits, promotions et dépenses en un seul endroit."
      : "Supervisez la plateforme, les boutiques, les utilisateurs, les rapports et les dépenses.";
  }, [isVendor]);

  const items = useMemo<NavItem[]>(
    () => [
      {
        to: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        end: true,
      },
      {
        to: "/admin/orders",
        label: "Commandes",
        icon: ShoppingBag,
      },
      {
        to: "/admin/products",
        label: "Produits",
        icon: Boxes,
      },
      {
        to: "/admin/promotions",
        label: "Promotions",
        icon: Percent,
      },
      {
        to: "/admin/expenses",
        label: "Dépenses",
        icon: Wallet,
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
        className="rounded-4 border shadow-sm overflow-hidden"
        style={{
          borderColor: "rgba(0,0,0,0.08)",
          background:
            "linear-gradient(135deg, #111111 0%, #1b1b1b 55%, #252525 100%)",
        }}
      >
        <div className="p-3 p-md-4">
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
            <div className="d-flex align-items-start gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-4 flex-shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  background: "linear-gradient(135deg, #FFD24A 0%, #F4B400 100%)",
                  color: "#111",
                  boxShadow: "0 10px 25px rgba(244,180,0,0.25)",
                }}
              >
                <ShieldCheck size={26} strokeWidth={2.2} />
              </div>

              <div>
                {showTitle && (
                  <div
                    className="fw-bold"
                    style={{
                      color: "#fff",
                      fontSize: "1.15rem",
                      letterSpacing: "0.2px",
                    }}
                  >
                    {computedTitle}
                  </div>
                )}

                <div
                  className="mt-1"
                  style={{
                    color: "rgba(255,255,255,0.74)",
                    fontSize: "0.92rem",
                    maxWidth: 760,
                    lineHeight: 1.45,
                  }}
                >
                  {subtitle}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 align-self-start align-self-lg-center">
              <div
                className="px-3 py-2 rounded-pill border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                {isVendor ? "Mode vendeur" : "Mode administrateur"}
              </div>

              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                style={{
                  width: 42,
                  height: 42,
                  background: "#FFD24A",
                  color: "#111",
                  fontSize: "0.92rem",
                  boxShadow: "0 8px 20px rgba(244,180,0,0.25)",
                }}
                title={String(user?.name || user?.role || "Utilisateur")}
              >
                {getInitials(user) || "A"}
              </div>
            </div>
          </div>
        </div>

        <div
          className="px-2 px-md-3 pb-3"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.00) 100%)",
          }}
        >
          <div className="row g-2">
            {visibleItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.to}
                  className="col-6 col-md-4 col-xl-3"
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        "text-decoration-none d-flex align-items-center gap-3 rounded-4 px-3 py-3 h-100 border transition-all",
                        isActive ? "admin-nav-active" : "admin-nav-idle",
                      ].join(" ")
                    }
                    style={({ isActive }) => ({
                      minHeight: 68,
                      borderColor: isActive
                        ? "rgba(255,210,74,0.35)"
                        : "rgba(255,255,255,0.08)",
                      background: isActive
                        ? "linear-gradient(135deg, rgba(255,210,74,0.18) 0%, rgba(255,210,74,0.08) 100%)"
                        : "rgba(255,255,255,0.04)",
                      color: isActive ? "#FFD24A" : "#ffffff",
                      boxShadow: isActive
                        ? "0 10px 25px rgba(244,180,0,0.14)"
                        : "none",
                      backdropFilter: "blur(6px)",
                    })}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                      style={{
                        width: 42,
                        height: 42,
                        background: isVendor && item.label === "Dépenses"
                          ? "rgba(255,210,74,0.16)"
                          : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Icon size={19} strokeWidth={2.2} />
                    </div>

                    <div className="d-flex flex-column">
                      <span
                        className="fw-semibold"
                        style={{
                          fontSize: "0.95rem",
                          lineHeight: 1.1,
                        }}
                      >
                        {item.label}
                      </span>

                      <span
                        style={{
                          fontSize: "0.76rem",
                          opacity: 0.72,
                          marginTop: 4,
                        }}
                      >
                        {item.label === "Dashboard" && "Vue globale"}
                        {item.label === "Commandes" && "Suivi des ventes"}
                        {item.label === "Produits" && "Catalogue & stock"}
                        {item.label === "Promotions" && "Offres & remises"}
                        {item.label === "Dépenses" && "Charges & suivi"}
                        {item.label === "Rapports" && "Performances"}
                        {item.label === "Contenu IA" && "SEO & contenu"}
                        {item.label === "Utilisateurs" && "Comptes & rôles"}
                        {item.label === "Boutiques" && "Gestion réseau"}
                      </span>
                    </div>
                  </NavLink>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}