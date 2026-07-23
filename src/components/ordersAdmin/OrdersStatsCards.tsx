// src/components/ordersAdmin/OrdersStatsCards.tsx
import { Wallet, Truck, BadgePercent } from "lucide-react";
import { mad } from "./orderUtils";
import { KpiSparkCard } from "../admin/adminUI";

export default function OrdersStatsCards(props: {
  caNet: number;       // ✅ CA produits (hors livraison)
  caDelivery: number;  // ✅ livraison/expédition
  caDuumini: number;   // ✅ commission duumini (DONE seulement)
}) {
  const { caNet, caDelivery, caDuumini } = props;

  return (
    <div className="row g-2 g-sm-3 mb-3">
      <div className="col-12 col-md-4">
        <KpiSparkCard
          icon={Wallet}
          accent="orange"
          label="CA (page) — Produits, hors livraison"
          value={mad(caNet)}
        />
      </div>

      <div className="col-12 col-md-4">
        <KpiSparkCard
          icon={Truck}
          accent="blue"
          label="Livraison / Expédition (page)"
          value={mad(caDelivery)}
        />
      </div>

      <div className="col-12 col-md-4">
        <KpiSparkCard
          icon={BadgePercent}
          accent="green"
          label="CA Duumini (page, commandes DONE)"
          value={mad(caDuumini)}
        />
      </div>
    </div>
  );
}
