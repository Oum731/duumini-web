// src/pages/admin/ClientZonesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPin, Users } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import { listClientsByZone, type ClientZoneRow } from "../../services/reports";

export default function ClientZonesPage() {
  const [items, setItems] = useState<ClientZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listClientsByZone()
      .then((res) => mounted && setItems(res.items))
      .catch((e: any) => {
        if (!mounted) return;
        setError(e?.payload?.error || e?.data?.error || e?.message || "Impossible de charger les zones clients.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const totalClients = useMemo(() => items.reduce((acc, r) => acc + r.clients_count, 0), [items]);
  const maxClients = useMemo(() => Math.max(1, ...items.map((r) => r.clients_count)), [items]);

  return (
    <div>
      <PageHeader
        title="Zones clients"
        subtitle="Où sont nos clients ? Répartition des commandes et du chiffre d'affaires par ville."
      />

      {error ? (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}

      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard icon={MapPin} label="Villes actives" value={items.length} accent="blue" />
        </div>
        <div className="col-sm-4">
          <KpiCard icon={Users} label="Clients (toutes zones)" value={totalClients} accent="orange" />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Chargement des zones..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Ville</th>
                <th></th>
                <th className="text-end">Clients</th>
                <th className="text-end">Commandes</th>
                <th className="text-end">Chiffre d'affaires</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.city}>
                  <td className="fw-semibold">{r.city}</td>
                  <td style={{ minWidth: 120 }}>
                    <div className="progress" style={{ height: 6 }}>
                      <div
                        className="progress-bar bg-dark"
                        style={{ width: `${(r.clients_count / maxClients) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="text-end">{r.clients_count}</td>
                  <td className="text-end">{r.orders_count}</td>
                  <td className="text-end">{moneyMAD(r.total_amount)}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Aucune commande pour l'instant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
