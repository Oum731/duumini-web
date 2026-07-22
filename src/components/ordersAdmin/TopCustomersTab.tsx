// src/components/ordersAdmin/TopCustomersTab.tsx
import { useEffect, useMemo, useState } from "react";
import { Crown, Repeat, Users } from "lucide-react";
import { getTopCustomers, type TopCustomer } from "../../services/orders";
import { moneyMAD } from "../../utils/money";
import { formatPhoneDisplay } from "../../utils/phone";
import { LoadingState } from "../ui/Spinner";
import { SectionCard, KpiCard, EmptyState } from "../admin/adminUI";

type SortKey = "revenue" | "orders_count";

export default function TopCustomersTab({ shopId }: { shopId?: number }) {
  const [items, setItems] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTopCustomers(shopId ? { shop_id: shopId } : {});
        if (mounted) setItems(res.items || []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Impossible de charger le classement clients.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [shopId]);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => (sortKey === "revenue" ? b.revenue - a.revenue : b.orders_count - a.orders_count));
    return arr;
  }, [items, sortKey]);

  const topRevenue = useMemo(
    () => [...items].sort((a, b) => b.revenue - a.revenue)[0] || null,
    [items],
  );
  const topOrders = useMemo(
    () => [...items].sort((a, b) => b.orders_count - a.orders_count)[0] || null,
    [items],
  );

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <KpiCard
            icon={Users}
            label="Clients actifs"
            value={items.length}
            accent="neutral"
          />
        </div>
        <div className="col-12 col-md-4">
          <KpiCard
            icon={Crown}
            label="Meilleur client (CA)"
            value={topRevenue ? moneyMAD(topRevenue.revenue) : "—"}
            sublabel={topRevenue?.name}
            accent="orange"
          />
        </div>
        <div className="col-12 col-md-4">
          <KpiCard
            icon={Repeat}
            label="Client le plus actif"
            value={topOrders ? `${topOrders.orders_count} commande(s)` : "—"}
            sublabel={topOrders?.name}
            accent="green"
          />
        </div>
      </div>

      <SectionCard
        title="Classement clients"
        subtitle="Commandes finalisées (DONE)"
        right={
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${sortKey === "revenue" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setSortKey("revenue")}
            >
              Par chiffre d'affaires
            </button>
            <button
              type="button"
              className={`btn ${sortKey === "orders_count" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setSortKey("orders_count")}
            >
              Par nombre de commandes
            </button>
          </div>
        }
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="alert alert-danger mb-0">{error}</div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun client pour l'instant"
            description="Le classement apparaîtra dès que des commandes seront finalisées."
          />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th className="text-end">Nb commandes</th>
                  <th className="text-end">CA total</th>
                  <th>Dernière commande</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr key={c.customer_key}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="fw-semibold">{c.name}</td>
                    <td>{formatPhoneDisplay(c.phone) || "—"}</td>
                    <td className="text-end">{c.orders_count}</td>
                    <td className="text-end">{moneyMAD(c.revenue)}</td>
                    <td className="text-muted small">
                      {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
