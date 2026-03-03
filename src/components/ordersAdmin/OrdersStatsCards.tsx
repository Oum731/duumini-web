// src/components/ordersAdmin/OrdersStatsCards.tsx
import { mad } from "./orderUtils";

export default function OrdersStatsCards(props: {
  caNet: number;       // ✅ CA produits (hors livraison)
  caDelivery: number;  // ✅ livraison/expédition
  caDuumini: number;   // ✅ commission duumini (DONE seulement)
}) {
  const { caNet, caDelivery, caDuumini } = props;

  return (
    <div className="row g-2 mb-3">
      <div className="col-12 col-md-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted small mb-1">CA (page) — Produits (hors livraison)</div>
            <div className="h6 m-0">{mad(caNet)}</div>
          </div>
        </div>
      </div>

      <div className="col-12 col-md-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted small mb-1">Livraison / Expédition (page)</div>
            <div className="h6 m-0">{mad(caDelivery)}</div>
          </div>
        </div>
      </div>

      <div className="col-12 col-md-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted small mb-1">
              CA Duumini (page) <span className="text-muted">(DONE seulement)</span>
            </div>
            <div className="h6 m-0">{mad(caDuumini)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}