// src/components/ordersAdmin/OrderEditModal.tsx
//
// Édition d'une commande existante (client + produits/quantités) sans
// passer par annulation + recréation — voir PUT /api/orders/:id/edit.
// Réservé à ADMIN/COMMERCIAL côté backend ; le bouton qui ouvre ce modal
// (OrderViewModal) applique la même restriction côté front.
import { useState } from "react";
import type { AnyObj } from "./orderUtils";
import { editOrder } from "../../services/orders";
import { listProducts, type Product } from "../../services/products";

type DraftLine = {
  key: number;
  product_id: number | null;
  product_name: string;
  qty: string;
};

function extractContact(detail: AnyObj) {
  const c = detail?.contact || detail?.user || {};
  return {
    first_name: c?.first_name || "",
    last_name: c?.last_name || "",
    phone: c?.phone || c?.user_phone || "",
    city: c?.city || "",
    address_line: c?.address_line || "",
  };
}

function extractLines(detail: AnyObj): DraftLine[] {
  const items: AnyObj[] = Array.isArray(detail?.items) ? detail.items : [];
  if (!items.length) return [{ key: 1, product_id: null, product_name: "", qty: "1" }];

  return items.map((it, i) => ({
    key: i + 1,
    product_id: it?.product_id ?? null,
    product_name: it?.product_name || it?.name || `Produit #${it?.product_id ?? ""}`,
    qty: String(it?.qty ?? 1),
  }));
}

export default function OrderEditModal({
  orderId,
  detail,
  onClose,
  onSaved,
}: {
  orderId: number;
  detail: AnyObj;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contact, setContact] = useState(extractContact(detail));
  const [lines, setLines] = useState<DraftLine[]>(extractLines(detail));
  const [productQuery, setProductQuery] = useState<Record<number, string>>({});
  const [productResults, setProductResults] = useState<Record<number, Product[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchProducts(key: number, q: string) {
    setProductQuery((s) => ({ ...s, [key]: q }));
    if (!q.trim()) {
      setProductResults((s) => ({ ...s, [key]: [] }));
      return;
    }
    try {
      const res = await listProducts({ q: q.trim(), pageSize: 6 });
      setProductResults((s) => ({ ...s, [key]: res.items }));
    } catch {
      setProductResults((s) => ({ ...s, [key]: [] }));
    }
  }

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { key: Date.now(), product_id: null, product_name: "", qty: "1" }]);
  }

  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  async function handleSave() {
    setError(null);

    const cleanItems: Array<{ product_id: number; qty: number }> = [];
    for (const l of lines) {
      if (!l.product_id) continue;
      const qty = Number(l.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        return setError(`Quantité invalide pour ${l.product_name}.`);
      }
      cleanItems.push({ product_id: l.product_id, qty });
    }
    if (!cleanItems.length) return setError("Au moins un produit est requis.");

    setSaving(true);
    try {
      await editOrder(orderId, {
        contact: {
          first_name: contact.first_name.trim() || undefined,
          last_name: contact.last_name.trim() || undefined,
          phone: contact.phone.trim() || undefined,
          city: contact.city.trim() || undefined,
          address_line: contact.address_line.trim() || undefined,
        },
        items: cleanItems,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg =
        e?.payload?.message || e?.payload?.error || e?.data?.error || e?.message || "Impossible d'enregistrer.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Modifier la commande</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error ? <div className="alert alert-danger">{error}</div> : null}

            <h6 className="mb-2">Client</h6>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Prénom"
                  value={contact.first_name}
                  onChange={(e) => setContact((c) => ({ ...c, first_name: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Nom"
                  value={contact.last_name}
                  onChange={(e) => setContact((c) => ({ ...c, last_name: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Téléphone"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Ville"
                  value={contact.city}
                  onChange={(e) => setContact((c) => ({ ...c, city: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <input
                  className="form-control"
                  placeholder="Adresse"
                  value={contact.address_line}
                  onChange={(e) => setContact((c) => ({ ...c, address_line: e.target.value }))}
                />
              </div>
            </div>

            <h6 className="mb-2">Produits</h6>
            <div className="alert alert-warning small py-2">
              Changer les quantités ou produits ajuste le stock automatiquement (l'ancien assortiment est
              restitué, le nouveau est déduit) et recalcule le montant total et la commission.
            </div>

            {lines.map((l) => (
              <div key={l.key} className="row g-2 mb-2 align-items-center">
                <div className="col-md-7 position-relative">
                  {l.product_id ? (
                    <div className="form-control d-flex justify-content-between align-items-center">
                      <span>{l.product_name}</span>
                      <button
                        className="btn btn-sm btn-link p-0"
                        onClick={() => updateLine(l.key, { product_id: null, product_name: "" })}
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
                                updateLine(l.key, { product_id: p.id, product_name: p.name });
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
                <div className="col-md-3">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Quantité"
                    value={l.qty}
                    onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <button className="btn btn-outline-danger btn-sm" onClick={() => removeLine(l.key)}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}

            <button className="btn btn-outline-secondary btn-sm" onClick={addLine}>
              + Ajouter un produit
            </button>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
              {saving ? "..." : "Enregistrer les modifications"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
