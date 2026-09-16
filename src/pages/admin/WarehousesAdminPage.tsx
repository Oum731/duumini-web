// src/pages/admin/WarehousesAdminPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Warehouse as WarehouseIcon, Boxes, History, Users, PlusCircle, AlertTriangle } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard, SectionCard } from "../../components/admin/adminUI";
import {
  listWarehouses,
  createWarehouse,
  getWarehouseStock,
  adjustWarehouseStock,
  getWarehouseMovements,
  getWarehouseManagers,
  assignWarehouseManager,
  removeWarehouseManager,
  warehouseErrorMessage,
  type Warehouse,
  type WarehouseStockRow,
  type StockMovement,
  type WarehouseManager,
} from "../../services/warehouses";
import { listAdminUsers, type AdminUser } from "../../services/adminUsers";
import { getExpensesByCategory, type ExpensesByCategoryItem } from "../../services/expenses";
import { moneyMAD } from "../../utils/money";

type Tab = "stock" | "movements" | "managers" | "expenses";

function movementLabel(type: StockMovement["type"]) {
  switch (type) {
    case "IN_PURCHASE":
      return "Réception fournisseur";
    case "IN_RETURN_CANCEL":
      return "Retour (annulation)";
    case "IN_ADJUSTMENT":
      return "Correction (+)";
    case "OUT_SALE":
      return "Vente";
    case "OUT_ADJUSTMENT":
      return "Correction (-)";
    case "TRANSFER_IN":
      return "Transfert entrant";
    case "TRANSFER_OUT":
      return "Transfert sortant";
    default:
      return type;
  }
}

export default function WarehousesAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("stock");

  const assignUserIdParam = searchParams.get("assignUserId");
  const pendingAssign = assignUserIdParam
    ? { id: Number(assignUserIdParam), name: searchParams.get("assignUserName") || `#${assignUserIdParam}` }
    : null;

  useEffect(() => {
    if (pendingAssign) setTab("managers");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignUserIdParam]);

  function clearPendingAssign() {
    const next = new URLSearchParams(searchParams);
    next.delete("assignUserId");
    next.delete("assignUserName");
    setSearchParams(next, { replace: true });
  }

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCity, setNewCity] = useState("");
  const [creating, setCreating] = useState(false);

  async function refreshWarehouses() {
    setLoading(true);
    setError(null);
    try {
      const res = await listWarehouses();
      setWarehouses(res.items);
      if (!selectedId && res.items.length) setSelectedId(res.items[0].id);
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible de charger les entrepôts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedId) || null,
    [warehouses, selectedId]
  );

  async function handleCreateWarehouse() {
    if (!newName.trim() || !newCode.trim()) {
      setError("Nom et code sont requis.");
      return;
    }
    setCreating(true);
    try {
      const w = await createWarehouse({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        city: newCity.trim() || undefined,
      });
      setShowCreate(false);
      setNewName("");
      setNewCode("");
      setNewCity("");
      await refreshWarehouses();
      setSelectedId(w.id);
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible de créer l'entrepôt."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Entrepôts & Stock"
        subtitle="Suivi du stock par entrepôt, mouvements tracés, gestionnaires affectés."
        right={
          <button className="btn btn-duu btn-sm d-flex align-items-center gap-1" onClick={() => setShowCreate((v) => !v)}>
            <PlusCircle size={16} /> Nouvel entrepôt
          </button>
        }
      />

      {error ? (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}

      {showCreate ? (
        <SectionCard title="Créer un entrepôt" accent="blue" className="mb-3">
          <div className="row g-2">
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Nom (ex: Entrepôt Ain Sebaa)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="Code (ex: AIN-SEBAA)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="Ville"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-dark w-100" disabled={creating} onClick={handleCreateWarehouse}>
                {creating ? "..." : "Créer"}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {loading ? (
        <LoadingState label="Chargement des entrepôts..." />
      ) : warehouses.length === 0 ? (
        <div className="text-muted">Aucun entrepôt. Crée le premier ci-dessus.</div>
      ) : (
        <>
          <div className="d-flex gap-2 flex-wrap mb-3">
            {warehouses.map((w) => (
              <button
                key={w.id}
                className={`btn btn-sm ${selectedId === w.id ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setSelectedId(w.id)}
              >
                <WarehouseIcon size={14} className="me-1" />
                {w.name}
                {!w.is_active ? " (inactif)" : ""}
              </button>
            ))}
          </div>

          {selectedWarehouse ? (
            <>
              <div className="mb-3 text-muted small">
                {selectedWarehouse.address ? `${selectedWarehouse.address} — ` : ""}
                {selectedWarehouse.city || ""} ({selectedWarehouse.country_code})
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
                <button
                  className={`btn btn-sm ${tab === "managers" ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setTab("managers")}
                >
                  <Users size={14} className="me-1" /> Gestionnaires
                </button>
                <button
                  className={`btn btn-sm ${tab === "expenses" ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setTab("expenses")}
                >
                  Dépenses
                </button>
              </div>

              {tab === "stock" ? <StockTab warehouseId={selectedWarehouse.id} /> : null}
              {tab === "movements" ? <MovementsTab warehouseId={selectedWarehouse.id} /> : null}
              {tab === "managers" ? (
                <ManagersTab
                  warehouseId={selectedWarehouse.id}
                  pendingAssign={pendingAssign}
                  onConsumePendingAssign={clearPendingAssign}
                />
              ) : null}
              {tab === "expenses" ? <ExpensesTab warehouseId={selectedWarehouse.id} /> : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export function StockTab({ warehouseId }: { warehouseId: number }) {
  const [items, setItems] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [adjustRow, setAdjustRow] = useState<WarehouseStockRow | null>(null);
  const [deltaQty, setDeltaQty] = useState("");
  const [deltaUnit, setDeltaUnit] = useState<"PIECE" | "CARTON">("PIECE");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWarehouseStock(warehouseId, { q: q || undefined, lowOnly, pageSize: 100 });
      setItems(res.items);
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible de charger le stock."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, lowOnly]);

  const lowCount = useMemo(() => items.filter((it) => it.quantity <= it.min_threshold).length, [items]);

  async function submitAdjust() {
    if (!adjustRow) return;
    const delta = Number(deltaQty);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Quantité invalide.");
      return;
    }
    if (!reason.trim()) {
      setError("Le motif est requis.");
      return;
    }
    setSaving(true);
    try {
      await adjustWarehouseStock(warehouseId, {
        product_id: adjustRow.product_id,
        variant_id: adjustRow.variant_id,
        delta_qty: delta,
        unit: deltaUnit,
        reason: reason.trim(),
      });
      setAdjustRow(null);
      setDeltaQty("");
      setDeltaUnit("PIECE");
      setReason("");
      await refresh();
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible d'ajuster le stock."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard icon={Boxes} label="Références en stock" value={items.length} accent="blue" />
        </div>
        <div className="col-sm-4">
          <KpiCard icon={AlertTriangle} label="Sous le seuil d'alerte" value={lowCount} accent="orange" />
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input
          className="form-control"
          style={{ maxWidth: 280 }}
          placeholder="Rechercher un produit..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
        />
        <button className="btn btn-outline-secondary btn-sm" onClick={refresh}>
          Rechercher
        </button>
        <label className="form-check d-flex align-items-center gap-2 ms-2">
          <input
            type="checkbox"
            className="form-check-input"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />
          <span className="form-check-label small">Stock bas uniquement</span>
        </label>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <LoadingState label="Chargement du stock..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Variante</th>
                <th className="text-end">Quantité</th>
                <th className="text-end">Seuil alerte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={it.quantity <= it.min_threshold ? "table-warning" : ""}>
                  <td>
                    {it.product_name}
                    {it.product_brand ? <span className="text-muted small ms-1">({it.product_brand})</span> : null}
                  </td>
                  <td className="small text-muted">
                    {[it.variant_size, it.variant_color, it.variant_sku].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="text-end fw-semibold">{it.quantity}</td>
                  <td className="text-end text-muted">{it.min_threshold}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-outline-dark btn-sm"
                      onClick={() => {
                        setAdjustRow(it);
                        setDeltaQty("");
                        setDeltaUnit("PIECE");
                        setReason("");
                      }}
                    >
                      Ajuster
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Aucun produit.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {adjustRow ? (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setAdjustRow(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Ajuster le stock — {adjustRow.product_name}</h5>
                <button className="btn-close" onClick={() => setAdjustRow(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-2 text-muted small">Quantité actuelle (pièces) : {adjustRow.quantity}</div>
                <label className="form-label small">Quantité à ajouter (négatif pour retirer)</label>
                <div className="d-flex gap-2 mb-2">
                  <input
                    type="number"
                    className="form-control"
                    value={deltaQty}
                    onChange={(e) => setDeltaQty(e.target.value)}
                    placeholder="ex: 10 ou -5"
                  />
                  <select
                    className="form-select"
                    style={{ maxWidth: 130 }}
                    value={deltaUnit}
                    onChange={(e) => setDeltaUnit(e.target.value as "PIECE" | "CARTON")}
                  >
                    <option value="PIECE">Pièce(s)</option>
                    <option value="CARTON">Carton(s)</option>
                  </select>
                </div>
                <label className="form-label small">Motif (obligatoire)</label>
                <input
                  className="form-control"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ex: Inventaire, casse, erreur de saisie..."
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setAdjustRow(null)}>
                  Annuler
                </button>
                <button className="btn btn-dark" disabled={saving} onClick={submitAdjust}>
                  {saving ? "..." : "Valider"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MovementsTab({ warehouseId }: { warehouseId: number }) {
  const [items, setItems] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getWarehouseMovements(warehouseId, { pageSize: 100 })
      .then((res) => mounted && setItems(res.items))
      .catch((e) => mounted && setError(warehouseErrorMessage(e, "Impossible de charger les mouvements.")))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [warehouseId]);

  if (loading) return <LoadingState label="Chargement des mouvements..." />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Produit</th>
            <th className="text-end">Qté</th>
            <th>Référence</th>
            <th>Par</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td className="text-nowrap small">{new Date(m.created_at).toLocaleString("fr-FR")}</td>
              <td>
                <span className={`badge ${m.type.startsWith("IN") ? "bg-success" : "bg-secondary"}`}>
                  {movementLabel(m.type)}
                </span>
              </td>
              <td>{m.product_name || `#${m.product_id}`}</td>
              <td className="text-end">{m.qty}</td>
              <td className="small text-muted">
                {m.reference_type}
                {m.reference_id ? ` #${m.reference_id}` : ""}
              </td>
              <td className="small">
                {m.performed_by_first_name || m.performed_by_last_name
                  ? `${m.performed_by_first_name || ""} ${m.performed_by_last_name || ""}`.trim()
                  : "—"}
              </td>
              <td className="small text-muted">{m.note || "—"}</td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center text-muted py-4">
                Aucun mouvement enregistré.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ManagersTab({
  warehouseId,
  pendingAssign,
  onConsumePendingAssign,
}: {
  warehouseId: number;
  pendingAssign?: { id: number; name: string } | null;
  onConsumePendingAssign?: () => void;
}) {
  const [items, setItems] = useState<WarehouseManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigningPending, setAssigningPending] = useState(false);

  const alreadyManager = !!pendingAssign && items.some((m) => m.user_id === pendingAssign.id);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWarehouseManagers(warehouseId);
      setItems(res.items);
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible de charger les gestionnaires."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function handleSearch() {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await listAdminUsers({ q: q.trim(), pageSize: 8 });
      setResults(res.items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleAssign(userId: number) {
    try {
      await assignWarehouseManager(warehouseId, userId);
      setQ("");
      setResults([]);
      await refresh();
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible d'affecter ce gestionnaire."));
    }
  }

  async function handleRemove(userId: number) {
    try {
      await removeWarehouseManager(warehouseId, userId);
      await refresh();
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible de retirer ce gestionnaire."));
    }
  }

  async function handleAssignPending() {
    if (!pendingAssign) return;
    setAssigningPending(true);
    try {
      await assignWarehouseManager(warehouseId, pendingAssign.id);
      await refresh();
      onConsumePendingAssign?.();
    } catch (e: any) {
      setError(warehouseErrorMessage(e, "Impossible d'affecter cet utilisateur."));
    } finally {
      setAssigningPending(false);
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-danger">{error}</div> : null}

      {pendingAssign && !alreadyManager ? (
        <div className="alert alert-info d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span>
            Affecter <strong>{pendingAssign.name}</strong> comme gestionnaire de cet entrepôt ?
          </span>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-dark" disabled={assigningPending} onClick={handleAssignPending}>
              {assigningPending ? "..." : "Affecter"}
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={onConsumePendingAssign}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
      {pendingAssign && alreadyManager ? (
        <div className="alert alert-success d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span>
            <strong>{pendingAssign.name}</strong> est déjà gestionnaire de cet entrepôt.
          </span>
          <button className="btn btn-sm btn-outline-secondary" onClick={onConsumePendingAssign}>
            Fermer
          </button>
        </div>
      ) : null}

      <div className="d-flex gap-2 mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Chercher un utilisateur (nom, téléphone)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className="btn btn-outline-secondary btn-sm" onClick={handleSearch} disabled={searching}>
          Chercher
        </button>
      </div>

      {results.length > 0 ? (
        <div className="list-group mb-3" style={{ maxWidth: 480 }}>
          {results.map((u) => (
            <button
              key={u.id}
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
              onClick={() => handleAssign(u.id)}
            >
              <span>
                {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.phone}
                <span className="text-muted small ms-2">{u.role}</span>
              </span>
              <span className="badge bg-dark">Affecter</span>
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Chargement..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Gestionnaire</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                <th>Affecté le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{`${m.first_name || ""} ${m.last_name || ""}`.trim() || "—"}</td>
                  <td>{m.phone || "—"}</td>
                  <td className="text-muted small">{m.role}</td>
                  <td className="small text-muted">{new Date(m.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="text-end">
                    <button className="btn btn-outline-danger btn-sm" onClick={() => handleRemove(m.user_id)}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Aucun gestionnaire affecté pour cet entrepôt.
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

function ExpensesTab({ warehouseId }: { warehouseId: number }) {
  const [items, setItems] = useState<ExpensesByCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getExpensesByCategory({ warehouse_id: warehouseId })
      .then((res) => mounted && setItems(res.items))
      .catch((e: any) => {
        if (!mounted) return;
        setError(
          e?.payload?.error ||
            e?.data?.error ||
            e?.message ||
            "Impossible de charger les dépenses de cet entrepôt."
        );
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [warehouseId]);

  const total = items.reduce((acc, it) => acc + it.total, 0);

  if (loading) return <LoadingState label="Chargement des dépenses..." />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="mb-3">
        <KpiCard label="Total dépenses (cet entrepôt)" value={moneyMAD(total)} accent="orange" />
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>Catégorie</th>
              <th className="text-end">Nombre</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.category_id ?? it.category_name}>
                <td>{it.category_name}</td>
                <td className="text-end">{it.count_items}</td>
                <td className="text-end">{moneyMAD(it.total)}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted py-4">
                  Aucune dépense enregistrée pour cet entrepôt.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
