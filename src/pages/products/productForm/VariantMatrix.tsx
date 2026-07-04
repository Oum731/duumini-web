// src/pages/products/productForm/VariantMatrix.tsx
import { useMemo, useState } from "react";
import { moneyMAD } from "../../../utils/money";
import type { VariantDraft } from "./types";
import { buildSkuAuto, normStock, toUpperSku, uniq, vKey } from "./helpers";

const SIZES_PRESET = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];
const COLORS_PRESET = ["Noir", "Blanc", "Rouge", "Bleu", "Vert", "Jaune", "Beige", "Gris", "Marron", "Rose"];

export default function VariantMatrix({
  variants,
  mutateVariants,
  variantsLoading,
  variantsErr,
  variantsOk,
  setVariantsErr,
  setVariantsOk,
  isEdit,
  productName,
  basePrice,
  onCleanAll,
  selectedKeys,
  onToggleKey,
}: {
  variants: VariantDraft[];
  mutateVariants: (updater: (prev: VariantDraft[]) => VariantDraft[]) => void;
  variantsLoading: boolean;
  variantsErr: string | null;
  variantsOk: string | null;
  setVariantsErr: (s: string | null) => void;
  setVariantsOk: (s: string | null) => void;
  isEdit: boolean;
  productName: string;
  basePrice: number;
  onCleanAll: () => void;
  selectedKeys: Set<string>;
  onToggleKey: (key: string) => void;
}) {
  const [customSizesUI, setCustomSizesUI] = useState<string[]>([]);
  const [customColorsUI, setCustomColorsUI] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  function hasVariant(size: string, color: string) {
    const k = vKey(size, color);
    return (variants || []).some((v) => vKey(v.size, v.color) === k);
  }

  const allSizesUI = useMemo(
    () => uniq([...SIZES_PRESET, ...customSizesUI, ...variants.map((v) => String(v.size || ""))]),
    [customSizesUI, variants]
  );
  const allColorsUI = useMemo(
    () => uniq([...COLORS_PRESET, ...customColorsUI, ...variants.map((v) => String(v.color || ""))]),
    [customColorsUI, variants]
  );

  const sortedVariants = useMemo(() => {
    const arr = [...(variants || [])].filter((v) => v.size && v.color);
    arr.sort((a, b) => {
      const s = String(a.size || "").localeCompare(String(b.size || ""), "fr", { sensitivity: "base" });
      if (s !== 0) return s;
      return String(a.color || "").localeCompare(String(b.color || ""), "fr", { sensitivity: "base" });
    });
    return arr;
  }, [variants]);

  function toggleSize(s: string) {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function toggleColor(c: string) {
    setSelectedColors((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function generateMatrix() {
    if (!selectedSizes.size || !selectedColors.size) {
      setVariantsErr("Coche au moins une taille et une couleur avant de générer.");
      return;
    }
    setVariantsErr(null);

    const toAdd: VariantDraft[] = [];
    for (const s of selectedSizes) {
      for (const c of selectedColors) {
        const k = vKey(s, c);
        if (!hasVariant(s, c) && !toAdd.some((v) => vKey(v.size, v.color) === k)) {
          toAdd.push({ size: s, color: c, sku: null, stock: 0, price_override: null, is_active: 1 });
        }
      }
    }

    if (!toAdd.length) {
      setVariantsOk("Toutes ces combinaisons existent déjà.");
      window.setTimeout(() => setVariantsOk(null), 1600);
      return;
    }

    mutateVariants((prev) => [...prev, ...toAdd]);
    setVariantsOk(`${toAdd.length} variante(s) créée(s).`);
    window.setTimeout(() => setVariantsOk(null), 1600);
  }

  function patchVariantByKey(size: string, color: string, patch: Partial<VariantDraft>) {
    const k = vKey(size, color);
    mutateVariants((prev) => prev.map((v) => (vKey(v.size, v.color) === k ? { ...v, ...patch } : v)));
  }

  function removeVariant(size: string, color: string) {
    const k = vKey(size, color);
    mutateVariants((prev) => prev.filter((v) => vKey(v.size, v.color) !== k));
  }

  const allRowKeys = sortedVariants.map((v) => vKey(v.size, v.color));
  const allSelected = allRowKeys.length > 0 && allRowKeys.every((k) => selectedKeys.has(k));

  return (
    <div className="duu-admin-soft mt-3 p-3">
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="fw-semibold">Variantes (Fashion)</div>
            <span className="duu-pill">
              <small>Total</small> {variants.length}
            </span>
            <span className="duu-pill">
              <small>Actives</small> {variants.filter((v) => (v.is_active ?? 1) === 1).length}
            </span>
          </div>
          <div className="small text-muted mt-1">
            Coche des <b>tailles</b> et des <b>couleurs</b>, puis génère toutes les combinaisons en un clic.
          </div>
          <div className="small duu-muted mt-1">
            Prix produit: <b>{basePrice > 0 ? moneyMAD(basePrice) : "—"}</b> • Prix variante (optionnel)
            remplace le prix produit.
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-outline-dark"
            onClick={() => {
              mutateVariants((prev) =>
                prev.map((v) => ({
                  ...v,
                  sku: v.sku && String(v.sku).trim() ? toUpperSku(v.sku) : v.sku,
                }))
              );
              setVariantsOk("SKU normalisés.");
              window.setTimeout(() => setVariantsOk(null), 1400);
            }}
            disabled={variantsLoading || !variants.length}
            title="Met en MAJ et remplace espaces par -"
          >
            Nettoyer SKU
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              if (!productName.trim()) {
                setVariantsErr("Renseigne le nom du produit avant de générer des SKU.");
                return;
              }
              setVariantsErr(null);
              mutateVariants((prev) =>
                prev.map((v) => ({
                  ...v,
                  sku:
                    v.sku && String(v.sku).trim()
                      ? toUpperSku(v.sku)
                      : buildSkuAuto(productName, v.size ?? null, v.color ?? null),
                }))
              );
              setVariantsOk("SKU générés.");
              window.setTimeout(() => setVariantsOk(null), 1400);
            }}
            disabled={variantsLoading || !variants.length}
          >
            Générer SKU
          </button>

          {isEdit ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={onCleanAll}
              disabled={variantsLoading}
            >
              Supprimer tout
            </button>
          ) : null}
        </div>
      </div>

      {variantsLoading ? <div className="text-muted small mt-2">Chargement variantes…</div> : null}
      {variantsOk ? <div className="alert alert-success py-2 mt-2 mb-0">{variantsOk}</div> : null}
      {variantsErr ? <div className="alert alert-danger py-2 mt-2 mb-0">{variantsErr}</div> : null}

      <div className="row g-3 mt-1">
        <div className="col-12 col-md-6">
          <div className="fw-semibold mb-2">1) Tailles</div>
          <div className="d-flex flex-wrap gap-2">
            {allSizesUI.map((s) => {
              const checked = selectedSizes.has(s);
              return (
                <label
                  key={s}
                  className="duu-chip"
                  style={{
                    borderColor: checked ? "rgba(229,57,53,.35)" : "rgba(0,0,0,.10)",
                    boxShadow: checked ? "0 0 0 .18rem rgba(253,220,0,.28)" : "none",
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleSize(s)} style={{ marginRight: 6 }} />
                  {s}
                </label>
              );
            })}
          </div>
          <div className="mt-2 d-flex gap-2 flex-wrap">
            <input
              className="form-control duu-focus"
              style={{ maxWidth: 220 }}
              placeholder="Ajouter une taille (ex: 46)"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() => {
                const s = String(customSize || "").trim();
                if (!s) return;
                setCustomSizesUI((prev) => uniq([...prev, s]));
                setSelectedSizes((prev) => new Set(prev).add(s));
                setCustomSize("");
              }}
            >
              Ajouter
            </button>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="fw-semibold mb-2">2) Couleurs</div>
          <div className="d-flex flex-wrap gap-2">
            {allColorsUI.map((c) => {
              const checked = selectedColors.has(c);
              return (
                <label
                  key={c}
                  className="duu-chip"
                  style={{
                    borderColor: checked ? "rgba(229,57,53,.35)" : "rgba(0,0,0,.10)",
                    boxShadow: checked ? "0 0 0 .18rem rgba(253,220,0,.28)" : "none",
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleColor(c)} style={{ marginRight: 6 }} />
                  {c}
                </label>
              );
            })}
          </div>
          <div className="mt-2 d-flex gap-2 flex-wrap">
            <input
              className="form-control duu-focus"
              style={{ maxWidth: 220 }}
              placeholder="Ajouter une couleur (ex: Orange)"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() => {
                const c = String(customColor || "").trim();
                if (!c) return;
                setCustomColorsUI((prev) => uniq([...prev, c]));
                setSelectedColors((prev) => new Set(prev).add(c));
                setCustomColor("");
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="btn btn-dark"
          onClick={generateMatrix}
          disabled={!selectedSizes.size || !selectedColors.size}
        >
          Générer la matrice ({Math.max(0, selectedSizes.size * selectedColors.size)} combinaison(s))
        </button>
      </div>

      <div className="mt-4">
        <div className="fw-semibold mb-2">Variantes ({sortedVariants.length})</div>

        {sortedVariants.length === 0 ? (
          <div className="text-muted small">
            Aucune variante. Coche des tailles et des couleurs, puis clique sur "Générer la matrice".
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        for (const k of allRowKeys) {
                          const already = selectedKeys.has(k);
                          if (allSelected && already) onToggleKey(k);
                          if (!allSelected && !already) onToggleKey(k);
                        }
                      }}
                    />
                  </th>
                  <th>Taille</th>
                  <th>Couleur</th>
                  <th style={{ width: 100 }}>Stock</th>
                  <th style={{ width: 130 }}>Prix var.</th>
                  <th style={{ width: 220 }}>SKU</th>
                  <th style={{ width: 90 }}>Statut</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedVariants.map((v) => {
                  const size = String(v.size || "");
                  const color = String(v.color || "");
                  const k = vKey(size, color);
                  const isOn = (v.is_active ?? 1) === 1;
                  const stock = normStock(v.stock ?? 0);

                  return (
                    <tr key={k}>
                      <td>
                        <input type="checkbox" checked={selectedKeys.has(k)} onChange={() => onToggleKey(k)} />
                      </td>
                      <td>
                        <span className="badge text-bg-dark">{size}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{color}</span>
                        {!isOn ? (
                          <span className="ms-2 badge bg-secondary">Off</span>
                        ) : stock <= 0 ? (
                          <span className="ms-2 badge bg-danger">Rupture</span>
                        ) : null}
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm duu-focus"
                          value={stock}
                          min={0}
                          onChange={(e) => patchVariantByKey(size, color, { stock: Number(e.target.value || 0) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control form-control-sm duu-focus"
                          value={v.price_override ?? ""}
                          placeholder="= produit"
                          onChange={(e) =>
                            patchVariantByKey(size, color, {
                              price_override: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <div className="input-group input-group-sm">
                          <input
                            className="form-control duu-focus"
                            value={v.sku ?? ""}
                            onChange={(e) => patchVariantByKey(size, color, { sku: e.target.value })}
                            placeholder="Optionnel"
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => patchVariantByKey(size, color, { sku: buildSkuAuto(productName, size, color) })}
                            title="Auto"
                          >
                            Auto
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm w-100 ${isOn ? "btn-outline-dark" : "btn-dark"}`}
                          onClick={() => patchVariantByKey(size, color, { is_active: isOn ? 0 : 1 })}
                        >
                          {isOn ? "On" : "Off"}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeVariant(size, color)}
                          title="Supprimer cette variante"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="small text-muted mt-2">
          Important : à l'enregistrement, seules les variantes avec <strong>taille + couleur</strong> seront envoyées à l'API.
        </div>
      </div>
    </div>
  );
}
