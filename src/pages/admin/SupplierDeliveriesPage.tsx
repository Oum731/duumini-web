// src/pages/admin/SupplierDeliveriesPage.tsx
import { useEffect, useState } from "react";
import { PackagePlus, Truck } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import {
  listSupplierDeliveries,
  createSupplierDelivery,
  supplierDeliveryErrorMessage,
  type SupplierDelivery,
} from "../../services/supplierDeliveries";
import { listWarehouses, type Warehouse } from "../../services/warehouses";
import { listShopsAdmin } from "../../services/shops";
import { listProducts, type Product } from "../../services/products";

type DraftLine = {
  key: number;
  product: Product | null;
  qty: string;
  unit_cost: string;
  unit: "PIECE" | "CARTON";
};

export default function SupplierDeliveriesPage() {
  const [items, setItems] = useState<SupplierDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);

  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);

  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 1, product: null, qty: "", unit_cost: "", unit: "PIECE" },
  ]);
  const [productQuery, setProductQuery] = useState<Record<number, string>>({});
  const [productResults, setProductResults] = useState<Record<number, Product[]>>({});
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listSupplierDeliveries({ pageSize: 50 });
      setItems(res.items);
    } catch (e: any) {
      setError(supplierDeliveryErrorMessage(e, "Impossible de charger les livraisons."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    listWarehouses()
      .then((res) => {
        setWarehouses(res.items);
        if (res.items.length) setWarehouseId(res.items[0].id);
      })
      .catch(() => setWarehouses([]));
    // ✅ Toute boutique existante (vendeur, fournisseur, restaurant...) peut
    // être la source d'une livraison — pas seulement celles typées
    // "fournisseur", beaucoup de boutiques actuelles jouent ce rôle sans
    // avoir ce type précis en base.
    listShopsAdmin({ pageSize: 100 })
      .then((res: any) => setShops((res.items || []).map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => setShops([]));
  }, []);

  async function searchProducts(lineKey: number, q: string) {
    setProductQuery((s) => ({ ...s, [lineKey]: q }));
    if (!q.trim()) {
      setProductResults((s) => ({ ...s, [lineKey]: [] }));
      return;
    }
    try {
      const res = await listProducts({ q: q.trim(), pageSize: 6 });
      setProductResults((s) => ({ ...s, [lineKey]: res.items }));
    } catch {
      setProductResults((s) => ({ ...s, [lineKey]: [] }));
    }
  }

  function addLine() {
    setLines((ls) => [...ls, { key: Date.now(), product: null, qty: "", unit_cost: "", unit: "PIECE" }]);
  }

  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit() {
    setError(null);

    if (!warehouseId) return setError("Choisis un entrepôt.");
    if (!supplierId) return setError("Choisis un fournisseur.");

    const cleanItems: Array<{ product_id: number; qty: number; unit_cost: number; unit: "PIECE" | "CARTON" }> = [];
    for (const l of lines) {
      if (!l.product) continue;
      const qty = Number(l.qty);
      const unitCost = Number(l.unit_cost);
      if (!Number.isFinite(qty) || qty <= 0) return setError(`Quantité invalide pour ${l.product.name}.`);
      if (!Number.isFinite(unitCost) || unitCost < 0) return setError(`Coût invalide pour ${l.product.name}.`);
      cleanItems.push({ product_id: l.product.id, qty, unit_cost: unitCost, unit: l.unit });
    }

    if (!cleanItems.length) return setError("Ajoute au moins un produit.");

    setSaving(true);
    try {
      await createSupplierDelivery({
        supplier_shop_id: supplierId,
        warehouse_id: warehouseId,
        reference: reference.trim() || undefined,
        items: cleanItems,
      });
      setShowForm(false);
      setReference("");
      setLines([{ key: 1, product: null, qty: "", unit_cost: "", unit: "PIECE" }]);
      setSupplierId(null);
      await refresh();
    } catch (e: any) {
      setError(supplierDeliveryErrorMessage(e, "Impossible d'enregistrer la livraison."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Livraisons fournisseurs"
        subtitle="Trace chaque réception de marchandise : fournisseur, entrepôt, quantités, coûts d'achat."
        right={
          <button className="btn btn-duu btn-sm d-flex align-items-center gap-1" onClick={() => setShowForm((v) => !v)}>
            <PackagePlus size={16} /> Nouvelle livraison
          </button>
        }
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {showForm ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <label className="form-label small">Entrepôt</label>
                <select
                  className="form-select"
                  value={warehouseId ?? ""}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">Fournisseur</label>
                <select
                  className="form-select"
                  value={supplierId ?? ""}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- Choisir une boutique --</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">Référence (optionnel)</label>
                <input
                  className="form-control"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="ex: BL-2026-014"
                />
              </div>
            </div>

            <label className="form-label small">Produits reçus</label>
            {lines.map((l) => (
              <div key={l.key} className="row g-2 mb-2 align-items-center">
                <div className="col-md-5 position-relative">
                  {l.product ? (
                    <div className="form-control d-flex justify-content-between align-items-center">
                      <span>{l.product.name}</span>
                      <button
                        className="btn btn-sm btn-link p-0"
                        onClick={() => updateLine(l.key, { product: null })}
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        className="form-control"
                        placeholder="Rechercher un produit..."
                        value={productQuery[l.key] || ""}
                        onChange={(e) => searchProducts(l.key, e.target.value)}
                      />
                      {(productResults[l.key] || []).length > 0 ? (
                        <div className="list-group position-absolute w-100" style={{ zIndex: 10 }}>
                          {(productResults[l.key] || []).map((p) => (
                            <button
                              key={p.id}
                              className="list-group-item list-group-item-action"
                              onClick={() => {
                                updateLine(l.key, { product: p });
                                setProductResults((s) => ({ ...s, [l.key]: [] }));
                              }}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="col-md-2">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Quantité"
                    value={l.qty}
                    onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select"
                    value={l.unit}
                    onChange={(e) => updateLine(l.key, { unit: e.target.value as "PIECE" | "CARTON" })}
                  >
                    <option value="PIECE">Pièce(s)</option>
                    <option value="CARTON">Carton(s)</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <input
                    type="number"
                    className="form-control"
                    placeholder={l.unit === "CARTON" ? "Coût / carton (MAD)" : "Coût / pièce (MAD)"}
                    value={l.unit_cost}
                    onChange={(e) => updateLine(l.key, { unit_cost: e.target.value })}
                  />
                </div>
                <div className="col-md-1">
                  <button className="btn btn-outline-danger btn-sm" onClick={() => removeLine(l.key)}>
                    ×
                  </button>
                </div>
                {l.unit === "CARTON" && l.product?.units_per_carton ? (
                  <div className="col-12">
                    <span className="text-muted small">
                      {l.product.units_per_carton} pièce(s)/carton — soit{" "}
                      {(Number(l.qty) || 0) * l.product.units_per_carton} pièce(s) au total pour cette ligne.
                    </span>
                  </div>
                ) : null}
                {l.unit === "CARTON" && l.product && !l.product.units_per_carton ? (
                  <div className="col-12">
                    <span className="text-warning small">
                      Ce produit n'a pas de nombre de pièces/carton défini — renseigne-le sur sa fiche produit
                      pour une conversion automatique en pièces.
                    </span>
                  </div>
                ) : null}
              </div>
            ))}

            <button className="btn btn-outline-secondary btn-sm mb-3" onClick={addLine}>
              + Ajouter une ligne
            </button>

            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button className="btn btn-dark" disabled={saving} onClick={handleSubmit}>
                {saving ? "..." : "Enregistrer la réception"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Chargement des livraisons..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Entrepôt</th>
                <th>Référence</th>
                <th className="text-end">Quantité</th>
                <th className="text-end">Coût total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="small text-nowrap">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>{d.supplier_name || `#${d.supplier_shop_id}`}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <Truck size={14} /> {d.warehouse_name || `#${d.warehouse_id}`}
                    </span>
                  </td>
                  <td className="small text-muted">{d.reference || "—"}</td>
                  <td className="text-end">{d.total_qty ?? 0}</td>
                  <td className="text-end">{moneyMAD(d.total_cost ?? 0)}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Aucune livraison enregistrée.
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
