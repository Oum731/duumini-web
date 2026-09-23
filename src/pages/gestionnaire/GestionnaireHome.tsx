// src/pages/gestionnaire/GestionnaireHome.tsx
//
// Espace dédié d'un gestionnaire de stock — même principe que /commercial :
// un utilisateur affecté par l'admin (warehouse_managers,
// voir la page admin Entrepôts & Stock) obtient ici un tableau de bord
// limité à son/ses entrepôt(s), sans accès au reste de l'admin.
import { useEffect, useMemo, useState } from "react";
import { Warehouse as WarehouseIcon, Boxes, History } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader } from "../../components/admin/adminUI";
import { listWarehouses, warehouseErrorMessage, type Warehouse } from "../../services/warehouses";
import { StockTab, MovementsTab } from "../admin/WarehousesAdminPage";

type Tab = "stock" | "movements";

export default function GestionnaireHome() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("stock");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listWarehouses()
      .then((res) => {
        if (!mounted) return;
        setWarehouses(res.items);
        if (res.items.length) setSelectedId(res.items[0].id);
      })
      .catch((e: any) => mounted && setError(warehouseErrorMessage(e, "Impossible de charger tes entrepôts.")))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedId) || null,
    [warehouses, selectedId]
  );

  return (
    <main className="container-xxl py-4">
      <PageHeader
        title="Mon espace gestionnaire"
        subtitle="Suivi du stock et des mouvements de ton/tes entrepôt(s)."
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <LoadingState label="Chargement..." />
      ) : warehouses.length === 0 ? (
        <div className="text-muted">
          Aucun entrepôt ne t'est encore affecté. Contacte un administrateur.
        </div>
      ) : (
        <>
          {warehouses.length > 1 ? (
            <div className="d-flex gap-2 flex-wrap mb-3">
              {warehouses.map((w) => (
                <button
                  key={w.id}
                  className={`btn btn-sm ${selectedId === w.id ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setSelectedId(w.id)}
                >
                  <WarehouseIcon size={14} className="me-1" />
                  {w.name}
                </button>
              ))}
            </div>
          ) : null}

          {selectedWarehouse ? (
            <>
              <div className="mb-3 text-muted small">
                <strong>{selectedWarehouse.name}</strong>
                {selectedWarehouse.address ? ` — ${selectedWarehouse.address}` : ""}
                {selectedWarehouse.city ? ` (${selectedWarehouse.city})` : ""}
              </div>

              <div className="d-flex gap-2 mb-3">
                <button
                  className={`btn btn-sm ${tab === "stock" ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setTab("stock")}
                >
                  <Boxes size={14} className="me-1" /> Stock
                </button>
                <button
                  className={`btn btn-sm ${tab === "movements" ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setTab("movements")}
                >
                  <History size={14} className="me-1" /> Mouvements
                </button>
              </div>

              {tab === "stock" ? <StockTab warehouseId={selectedWarehouse.id} /> : null}
              {tab === "movements" ? <MovementsTab warehouseId={selectedWarehouse.id} /> : null}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
