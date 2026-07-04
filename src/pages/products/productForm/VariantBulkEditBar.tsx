// src/pages/products/productForm/VariantBulkEditBar.tsx
import { useState } from "react";
import type { VariantDraft } from "./types";
import { vKey } from "./helpers";

export default function VariantBulkEditBar({
  selectedKeys,
  onClearSelection,
  mutateVariants,
}: {
  selectedKeys: Set<string>;
  onClearSelection: () => void;
  mutateVariants: (updater: (prev: VariantDraft[]) => VariantDraft[]) => void;
}) {
  const [bulkStock, setBulkStock] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");

  if (selectedKeys.size === 0) return null;

  function inSelection(v: VariantDraft) {
    return selectedKeys.has(vKey(v.size, v.color));
  }

  function applyStock() {
    const n = Number(bulkStock);
    if (!Number.isFinite(n) || n < 0) return;
    mutateVariants((prev) => prev.map((v) => (inSelection(v) ? { ...v, stock: Math.floor(n) } : v)));
  }

  function applyPrice() {
    const n = bulkPrice === "" ? null : Number(bulkPrice);
    if (n != null && (!Number.isFinite(n) || n < 0)) return;
    mutateVariants((prev) => prev.map((v) => (inSelection(v) ? { ...v, price_override: n } : v)));
  }

  function setActive(active: 0 | 1) {
    mutateVariants((prev) => prev.map((v) => (inSelection(v) ? { ...v, is_active: active } : v)));
  }

  function removeSelected() {
    if (!confirm(`Supprimer les ${selectedKeys.size} variante(s) sélectionnée(s) ?`)) return;
    mutateVariants((prev) => prev.filter((v) => !inSelection(v)));
    onClearSelection();
  }

  return (
    <div
      className="d-flex align-items-center gap-2 flex-wrap p-2 mt-3 rounded"
      style={{ background: "rgba(229,57,53,.06)", border: "1px solid rgba(229,57,53,.25)" }}
    >
      <span className="fw-semibold">{selectedKeys.size} sélectionnée(s)</span>

      <div className="input-group input-group-sm" style={{ maxWidth: 180 }}>
        <input
          type="number"
          min={0}
          className="form-control"
          placeholder="Stock"
          value={bulkStock}
          onChange={(e) => setBulkStock(e.target.value)}
        />
        <button type="button" className="btn btn-outline-dark" onClick={applyStock} disabled={bulkStock === ""}>
          Appliquer
        </button>
      </div>

      <div className="input-group input-group-sm" style={{ maxWidth: 180 }}>
        <input
          type="number"
          step="0.01"
          min={0}
          className="form-control"
          placeholder="Prix var."
          value={bulkPrice}
          onChange={(e) => setBulkPrice(e.target.value)}
        />
        <button type="button" className="btn btn-outline-dark" onClick={applyPrice}>
          Appliquer
        </button>
      </div>

      <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setActive(1)}>
        Activer
      </button>
      <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setActive(0)}>
        Désactiver
      </button>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeSelected}>
        Supprimer sélection
      </button>
      <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={onClearSelection}>
        Annuler la sélection
      </button>
    </div>
  );
}
