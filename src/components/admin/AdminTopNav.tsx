// src/components/admin/AdminTopNav.tsx
import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { me } from "../../services/auth";

type AnyObj = Record<string, any>;

type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
} & AnyObj;

function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  // ✅ on couvre tes rôles possibles (tu utilises souvent "VENDEUR")
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

  const cls = ({ isActive }: { isActive: boolean }) =>
    "btn btn-sm w-100 w-sm-auto text-start " +
    (isActive ? "btn-dark" : "btn-outline-dark");

  const computedTitle = useMemo(() => {
    if (title && title !== "Espace admin") return title;
    return isVendor ? "Espace vendeur" : "Espace admin";
  }, [title, isVendor]);

  return (
    <nav aria-label="Menu admin" className="mb-3">
      {showTitle && (
        <div className="text-muted fw-semibold small mb-2">{computedTitle}</div>
      )}

      <div className="row row-cols-2 row-cols-sm-auto g-2">
        {/* Dashboard: admin + vendeur */}
        <div className="col">
          <NavLink to="/admin" end className={cls}>
            Tableau de bord
          </NavLink>
        </div>

        {/* Commandes: admin + vendeur */}
        <div className="col">
          <NavLink to="/admin/orders" className={cls}>
            Commandes
          </NavLink>
        </div>

        {/* Produits: admin + vendeur */}
        <div className="col">
          <NavLink to="/admin/products" className={cls}>
            Produits
          </NavLink>
        </div>

        {/* Promotions: admin + vendeur */}
        <div className="col">
          <NavLink to="/admin/promotions" className={cls}>
            Promotions
          </NavLink>
        </div>

        {/* ✅ Rapports: ADMIN uniquement */}
        {!isVendor && (
          <div className="col">
            <NavLink to="/admin/reports/sales" className={cls}>
              Rapports
            </NavLink>
          </div>
        )}

        {/* Contenu IA: ADMIN uniquement */}
        {!isVendor && (
          <div className="col">
            <NavLink to="/admin/content-ai" className={cls}>
              Contenu IA
            </NavLink>
          </div>
        )}

        {/* Users: ADMIN uniquement */}
        {!isVendor && (
          <div className="col">
            <NavLink to="/admin/users" className={cls}>
              Utilisateurs
            </NavLink>
          </div>
        )}

        {/* Shops: ADMIN uniquement */}
        {!isVendor && (
          <div className="col">
            <NavLink to="/admin/shops" className={cls}>
              Boutiques
            </NavLink>
          </div>
        )}
      </div>
    </nav>
  );
}