// src/components/admin/AdminTopNav.tsx
import { NavLink } from "react-router-dom";

export default function AdminTopNav({
  showTitle = true,
  title = "Espace admin",
}: {
  showTitle?: boolean;
  title?: string;
}) {
  const cls = ({ isActive }: { isActive: boolean }) =>
    "btn btn-sm w-100 w-sm-auto text-start " +
    (isActive ? "btn-dark" : "btn-outline-dark");

  return (
    <nav aria-label="Menu admin" className="mb-3">
      {showTitle && (
        <div className="text-muted fw-semibold small mb-2">{title}</div>
      )}

      {/* 2 colonnes sur mobile, inline en ≥sm */}
      <div className="row row-cols-2 row-cols-sm-auto g-2">
        <div className="col">
          <NavLink to="/admin" end className={cls}>
            Tableau de bord
          </NavLink>
        </div>

        <div className="col">
          <NavLink to="/admin/orders" className={cls}>
            Commandes
          </NavLink>
        </div>

        <div className="col">
          <NavLink to="/admin/products" className={cls}>
            Produits
          </NavLink>
        </div>

        <div className="col">
          <NavLink to="/admin/promotions" className={cls}>
            Promotions
          </NavLink>
        </div>
{/*
        <div className="col">
          <NavLink to="/admin/copy" className={cls}>
            Copy du site
          </NavLink>
        </div>

         ✅ NOUVEL ONGLET AGENT IA 
        <div className="col">
          <NavLink to="/admin/ai" className={cls}>
            Agent IA
          </NavLink>
        </div>*/}

        <div className="col">
          <NavLink to="/admin/users" className={cls}>
            Utilisateurs
          </NavLink>
        </div>

        <div className="col">
          <NavLink to="/admin/shops" className={cls}>
            Boutiques
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
