// src/pages/products/ProductForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Category } from "../../services/categories";
import type { ProductVariant } from "../../services/products";
import { listProductVariants, removeProductVariant } from "../../services/products";
import { moneyMAD } from "../../utils/money";
import { imgUrl } from "../../utils/media";

import type {
  Draft,
  FullProduct,
  ProductImage,
  ProductStyle,
  PromoDiscountType,
  Shop,
  SubCategory,
  Vertical,
  VariantDraft,
} from "./productForm/types";
import {
  basePriceForAdmin,
  cleanVariantsForApi,
  computePromoPrice,
  hasRealPromo,
  inferStyleFromProduct,
  isActive,
  normalizeVertical,
  promoLabel,
  promoPriceForAdmin,
  splitNames,
  styleToVertical,
} from "./productForm/helpers";
import ImagePicker from "./productForm/ImagePicker";
import VariantMatrix from "./productForm/VariantMatrix";
import VariantBulkEditBar from "./productForm/VariantBulkEditBar";

export type {
  Draft,
  FullProduct,
  ProductImage,
  ProductStyle,
  PromoDiscountType,
  Shop,
  SubCategory,
  Vertical,
  VariantDraft,
};
export {
  basePriceForAdmin,
  cleanVariantsForApi,
  hasRealPromo,
  isActive,
  promoLabel,
  promoPriceForAdmin,
};

/* ================= Component ================= */

export default function ProductForm({
  initial,
  categories,
  subCategories,
  shops,
  isVendor,
  onCreateCategory,
  onCreateSubCategory,
  onSubmit,
  onCancel,
}: {
  initial?: (Partial<FullProduct> & { images?: ProductImage[] }) | undefined;
  categories: Category[];
  subCategories: SubCategory[];
  shops: Shop[];
  isVendor: boolean;

  // ✅ IMPORTANT: vertical obligatoire pour éviter 400 backend
  onCreateCategory: (name: string, vertical: Vertical) => Promise<Category>;
  onCreateSubCategory: (categoryId: number, name: string, vertical: Vertical) => Promise<SubCategory>;

  onSubmit: (
    draft: Draft,
    files: File[],
    replaceImages: boolean,
    variants: VariantDraft[]
  ) => Promise<void> | void;
  onCancel: () => void;
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeSubCategories = Array.isArray(subCategories) ? subCategories : [];
  const safeShops = Array.isArray(shops) ? shops : [];

  const [draft, setDraft] = useState<Draft>(() => {
    const anyInit: any = initial || {};
    const initStyle = inferStyleFromProduct(anyInit);
    const initVertical = normalizeVertical(anyInit?.vertical) ?? styleToVertical(initStyle);

    return {
      style: initStyle || "",
      vertical: initVertical ?? null,

      name: anyInit?.name || "",
      price: anyInit?.price ?? null,
      description: anyInit?.description || "",
      stock: anyInit?.stock ?? null,
      currency: anyInit?.currency || "MAD",

      is_featured: anyInit?.is_featured != null ? (Number(anyInit.is_featured) as 0 | 1) : 0,
      promo_eligible: anyInit?.promo_eligible != null ? (Number(anyInit.promo_eligible) as 0 | 1) : 0,

      category_id:
        anyInit?.category_id != null && anyInit?.category_id !== ""
          ? Number(anyInit.category_id)
          : null,
      sub_category_id:
        anyInit?.sub_category_id != null && anyInit?.sub_category_id !== ""
          ? Number(anyInit.sub_category_id)
          : null,

      shop_id: anyInit?.shop_id != null ? Number(anyInit.shop_id) : null,

      promo_discount_type: anyInit?.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT",
      promo_discount_value:
        typeof anyInit?.promo_discount_value === "number" ? anyInit.promo_discount_value : null,

      promo_free_delivery:
        anyInit?.promo_free_delivery != null ? (Number(anyInit.promo_free_delivery) as 0 | 1) : 0,

      is_active:
        anyInit?.is_active != null
          ? (Number(anyInit.is_active) as 0 | 1)
          : anyInit?.active != null
          ? (Number(anyInit.active) as 0 | 1)
          : 1,
    };
  });

  // ✅ Sync from initial
  useEffect(() => {
    if (!initial) return;
    setDraft((d) => {
      const style = d.style || inferStyleFromProduct(initial as any);
      const vertical = normalizeVertical((initial as any)?.vertical) ?? styleToVertical(style);
      return { ...d, style, vertical: vertical ?? null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // ✅ Keep vertical aligned with style
  useEffect(() => {
    if (!draft.style) return;
    const v = styleToVertical(draft.style);
    setDraft((d) => (d.vertical === v ? d : { ...d, vertical: v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.style]);

  // vendeur: si une seule boutique, pré-sélection auto
  useEffect(() => {
    if (!isVendor) return;
    if (draft.shop_id) return;
    if (safeShops.length === 1) setDraft((d) => ({ ...d, shop_id: safeShops[0].id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, safeShops.length]);

  const [files, setFiles] = useState<File[]>([]);
  const [replaceImages, setReplaceImages] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState("");

  const [newSubCatsRaw, setNewSubCatsRaw] = useState("");
  const [createdSubCatsPreview, setCreatedSubCatsPreview] = useState<string[]>([]);

  const [formError, setFormError] = useState<string | null>(null);

  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsErr, setVariantsErr] = useState<string | null>(null);
  const [variantsOk, setVariantsOk] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [variantsTouched, setVariantsTouched] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  function mutateVariants(updater: (prev: VariantDraft[]) => VariantDraft[]) {
    setVariantsTouched(true);
    setVariants(updater);
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const productId = Number((initial as any)?.id || 0);
  const isFashion = String(draft.style || "").toLowerCase() === "fashion";
  const isEdit = !!productId;

  const hasExistingImages = Array.isArray((initial as any)?.images) && (initial as any)?.images?.length > 0;
  const selectedShop = safeShops.find((s) => s.id === (draft.shop_id ?? undefined));

  const promoEnabled = !!draft.promo_eligible;
  const promoType: PromoDiscountType =
    draft.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";

  const promoValueNum = Number(draft.promo_discount_value ?? 0);
  const priceNum = Number(draft.price ?? 0);

  const promoPricePreview = useMemo(() => {
    if (!promoEnabled) return null;
    if (!priceNum || !promoValueNum) return null;
    return computePromoPrice(priceNum, promoType, promoValueNum);
  }, [promoEnabled, promoType, promoValueNum, priceNum]);

  const categoriesByStyle = useMemo(() => safeCategories, [safeCategories]);

  const filteredSubCats = useMemo(() => {
    const cid = Number(draft.category_id || 0);
    if (!cid) return [];
    return safeSubCategories.filter((sc) => Number(sc.category_id) === cid);
  }, [safeSubCategories, draft.category_id]);

  // ✅ Reset dependent state when style changes
  useEffect(() => {
    setIsCustomCategory(false);
    setIsCustomSubCategory(false);
    setNewCategoryName("");
    setNewSubCategoryName("");
    setNewSubCatsRaw("");
    setCreatedSubCatsPreview([]);
    setDraft((d) => ({ ...d, category_id: null, sub_category_id: null }));

    setVariantsErr(null);
    setVariantsOk(null);
    setVariantsTouched(false);
    setVariants([]);
    setSelectedKeys(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.style]);

  useEffect(() => {
    const cid = Number(draft.category_id || 0);
    const sid = Number(draft.sub_category_id || 0);
    if (!cid || !sid) return;
    const ok = safeSubCategories.some((sc) => sc.id === sid && Number(sc.category_id) === cid);
    if (!ok) setDraft((d) => ({ ...d, sub_category_id: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.category_id, safeSubCategories]);

  useEffect(() => {
    if (!isCustomCategory) {
      setCreatedSubCatsPreview([]);
      return;
    }
    setCreatedSubCatsPreview(splitNames(newSubCatsRaw));
  }, [newSubCatsRaw, isCustomCategory]);

  useEffect(() => {
    const run = async () => {
      setVariantsErr(null);
      setVariantsOk(null);

      if (!isFashion || !isEdit || variantsTouched) return;

      setVariantsLoading(true);
      try {
        const rows = await listProductVariants(productId);
        const mapped: VariantDraft[] = (rows || []).map((v: ProductVariant) => ({
          id: v.id,
          size: v.size ?? null,
          color: v.color ?? null,
          sku: v.sku ?? null,
          stock: Number(v.stock ?? 0),
          price_override: v.price_override ?? null,
          is_active: (v.is_active ?? 1) as any,
        }));
        setVariants(mapped);
      } catch (e: any) {
        setVariantsErr(e?.message || String(e));
      } finally {
        setVariantsLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFashion, productId, isEdit]);

  function validatePromo(): string | null {
    if (!promoEnabled) return null;

    if (!draft.price || Number(draft.price) <= 0) {
      return "Renseigne d’abord un prix valide avant d’appliquer une promo.";
    }

    const v = Number(draft.promo_discount_value);
    if (!Number.isFinite(v) || v <= 0) return "Renseigne une réduction valide (nombre > 0).";

    if (promoType === "PERCENT") {
      if (v <= 0 || v > 95) return "Le pourcentage doit être entre 1 et 95.";
    } else {
      if (v >= Number(draft.price)) return "Le montant de réduction doit être inférieur au prix.";
    }
    return null;
  }

  async function cleanAllVariants() {
    if (!isEdit || !isFashion) return;
    if (!confirm("Supprimer TOUTES les variantes de ce produit ?")) return;

    setVariantsErr(null);
    setVariantsOk(null);
    setVariantsLoading(true);
    try {
      const rows = await listProductVariants(productId);
      for (const v of rows || []) await removeProductVariant(v.id);
      setVariants([]);
      setVariantsTouched(true);
      setSelectedKeys(new Set());
      setVariantsOk("Toutes les variantes ont été supprimées.");
      window.setTimeout(() => setVariantsOk(null), 1600);
    } catch (e: any) {
      setVariantsErr(e?.message || String(e));
    } finally {
      setVariantsLoading(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const st = String(draft.style || "").toLowerCase();
    if (st !== "food" && st !== "market" && st !== "fashion") {
      setFormError("Choisis d’abord le type : Food / Market / Fashion.");
      return;
    }

    const vert = styleToVertical(st);
    if (!vert) {
      setFormError("vertical required (FOOD|MARKET|FASHION)");
      return;
    }

    const promoErr = validatePromo();
    if (promoErr) {
      setFormError(promoErr);
      return;
    }

    if (!isVendor && !draft.shop_id) {
      setFormError("Sélectionne une boutique.");
      return;
    }

    if (isVendor && safeShops.length > 1 && !draft.shop_id) {
      setFormError("Sélectionne une boutique.");
      return;
    }

    if (isCustomCategory) {
      if (!newCategoryName.trim()) {
        setFormError("Renseigne le nom de la nouvelle catégorie.");
        return;
      }
      const scNames = splitNames(newSubCatsRaw);
      if (!scNames.length) {
        setFormError("Ajoute au moins une sous-catégorie (séparées par des virgules).");
        return;
      }
    } else if (!draft.category_id) {
      setFormError("Sélectionne une catégorie.");
      return;
    }

    if (!isCustomCategory) {
      if (isCustomSubCategory) {
        if (!newSubCategoryName.trim()) {
          setFormError("Renseigne le nom de la nouvelle sous-catégorie.");
          return;
        }
      } else if (!draft.sub_category_id) {
        setFormError("Sélectionne une sous-catégorie (liée à la catégorie).");
        return;
      }
    }

    if (st === "fashion") {
      const cleaned = cleanVariantsForApi(variants);
      if (cleaned.length === 0) {
        setFormError("Ajoute au moins une variante (taille + couleur) pour un produit Fashion.");
        return;
      }
    }

    setSubmitting(true);
    try {
      let categoryId: number | null | undefined = draft.category_id;
      let subCatId: number | null | undefined = draft.sub_category_id;

      if (isCustomCategory) {
        const createdCat = await onCreateCategory(newCategoryName.trim(), vert);
        categoryId = (createdCat as any).id;

        const cid = Number(categoryId || 0);
        if (!cid) throw new Error("category_id manquant après création.");

        const names = splitNames(newSubCatsRaw);
        let firstCreated: SubCategory | null = null;

        for (let i = 0; i < names.length; i++) {
          const created = await onCreateSubCategory(cid, names[i], vert);
          if (!firstCreated) firstCreated = created as any;
        }

        subCatId = firstCreated?.id ?? null;

        setIsCustomCategory(false);
        setNewCategoryName("");
        setNewSubCatsRaw("");
        setCreatedSubCatsPreview([]);
        setDraft((d) => ({
          ...d,
          category_id: categoryId ?? null,
          sub_category_id: subCatId ?? null,
        }));
      } else {
        const cid = Number(categoryId || 0);
        if (!cid) throw new Error("Sélectionne une catégorie d’abord.");

        if (isCustomSubCategory) {
          const createdSub = await onCreateSubCategory(cid, newSubCategoryName.trim(), vert);
          subCatId = createdSub.id;
          setIsCustomSubCategory(false);
          setNewSubCategoryName("");
        }
      }

      const finalDraft: Draft = {
        ...draft,
        style: st as any,
        vertical: vert, // ✅ CRITIQUE: utilisé par l’API (products + sub-categories)
        category_id: categoryId ?? null,
        sub_category_id: subCatId ?? null,
      };

      await onSubmit(finalDraft, files, replaceImages, variants);
    } catch (err: any) {
      setFormError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const basePrice = Number(draft.price ?? 0);
  const safeBasePrice = basePrice > 0 ? basePrice : 0;

  return (
    <form onSubmit={submit}>
      <style>{`
        .duu-admin-soft{ background: rgba(0,0,0,.03); border: 1px solid rgba(0,0,0,.06); border-radius: 16px; }
        .duu-admin-card{ border-radius: 16px; overflow:hidden; }
        .duu-pill{
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 10px; border-radius: 999px;
          background:#fff; border:1px solid rgba(0,0,0,.08);
          box-shadow: 0 6px 18px rgba(0,0,0,.06);
          font-weight:800;
        }
        .duu-pill small{ font-weight:700; color: rgba(0,0,0,.55); }
        .duu-focus:focus, .duu-focus:focus-visible, .form-control:focus, .form-select:focus{
          outline:none !important;
          box-shadow: 0 0 0 .22rem rgba(253,220,0,.35) !important;
          border-color: rgba(229,57,53,.35) !important;
        }
        .duu-chip{
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 10px; border-radius: 999px;
          border: 1px solid rgba(0,0,0,.10);
          background:#fff;
          font-weight: 800;
          cursor:pointer;
          user-select:none;
        }
        .duu-muted{ color: rgba(0,0,0,.58); }
      `}</style>

      <div className="row g-2">
        <div className="col-12 col-md-8">
          <div className="row g-2">
            <div className="col-8">
              <label className="form-label">Nom</label>
              <input
                className="form-control duu-focus"
                value={draft.name || ""}
                onChange={(ev) => setDraft((d) => ({ ...d, name: ev.target.value }))}
                required
              />
            </div>

            <div className="col-4">
              <label className="form-label">Actif</label>
              <select
                className="form-select duu-focus"
                value={draft.is_active == null ? "" : String(Number(draft.is_active))}
                onChange={(ev) =>
                  setDraft((d) => ({
                    ...d,
                    is_active: ev.target.value === "" ? null : (Number(ev.target.value) as 0 | 1),
                  }))
                }
              >
                <option value="">(ne pas changer)</option>
                <option value="1">Actif</option>
                <option value="0">Désactivé</option>
              </select>
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Type (Food / Market / Fashion)</label>
              <select
                className="form-select duu-focus"
                value={draft.style || ""}
                onChange={(ev) => {
                  const style = (ev.target.value as any) || "";
                  setDraft((d) => ({
                    ...d,
                    style,
                    vertical: styleToVertical(style),
                  }));
                }}
                required
              >
                <option value="">(Choisir le type)</option>
                <option value="food">Food</option>
                <option value="market">Market</option>
                <option value="fashion">Fashion</option>
              </select>
              <small className="text-muted">
                Choisis le type d’abord, ensuite tu sélectionnes (ou crées) catégorie et sous-catégorie.
              </small>
            </div>

            {/* ✅ Debug utile en prod: affiche le vertical calculé */}
            <div className="col-12 col-md-6 d-flex align-items-end">
              <div className="w-100">
                <label className="form-label">Vertical</label>
                <input className="form-control" value={draft.vertical || ""} readOnly />
                <small className="text-muted">Auto (FOOD / MARKET / FASHION).</small>
              </div>
            </div>
          </div>

          <div className="row g-2 mt-1">
            <div className="col-12">
              <label className="form-label">Boutique</label>
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select duu-focus"
                  value={draft.shop_id != null ? String(draft.shop_id) : ""}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setDraft((d) => ({ ...d, shop_id: v ? Number(v) : null }));
                  }}
                  disabled={safeShops.length <= 1}
                >
                  <option value="">{isVendor ? "(Auto / choisir)" : "(Sélectionner une boutique)"}</option>
                  {safeShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {selectedShop?.logo && (
                  <img
                    src={imgUrl(selectedShop.logo)}
                    alt={selectedShop.name}
                    className="rounded-circle border d-none d-md-inline-block"
                    style={{ width: 40, height: 40, objectFit: "cover" }}
                  />
                )}
              </div>

              <small className="text-muted">
                {isVendor
                  ? "Vendeur : tu peux choisir parmi tes boutiques (ou laisser auto si une seule)."
                  : "Admin : boutique obligatoire. Vendeur : la boutique peut être déduite côté API."}
              </small>
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-6">
              <label className="form-label">Catégorie</label>
              <select
                className="form-select duu-focus"
                disabled={!draft.style}
                value={isCustomCategory ? "__other__" : draft.category_id ? String(draft.category_id) : ""}
                onChange={(ev) => {
                  const val = ev.target.value;
                  if (val === "__other__") {
                    setIsCustomCategory(true);
                    setIsCustomSubCategory(false);
                    setDraft((d) => ({ ...d, category_id: null, sub_category_id: null }));
                    return;
                  }
                  setIsCustomCategory(false);
                  setNewCategoryName("");
                  setNewSubCatsRaw("");
                  setCreatedSubCatsPreview([]);
                  const cid = val ? Number(val) : null;
                  setDraft((d) => ({ ...d, category_id: cid, sub_category_id: null }));
                }}
              >
                <option value="">{!draft.style ? "(Choisir le type d’abord)" : "(Sélectionner)"}</option>
                {categoriesByStyle.map((c) => (
                  <option key={(c as any).id} value={(c as any).id}>
                    {(c as any).name}
                  </option>
                ))}
                {draft.style ? <option value="__other__">Autre…</option> : null}
              </select>
            </div>

            {isCustomCategory && (
              <div className="col-6">
                <label className="form-label">Nouvelle catégorie</label>
                <input
                  className="form-control duu-focus"
                  placeholder="Ex: Épicerie, Boissons, Hygiène…"
                  value={newCategoryName}
                  onChange={(ev) => setNewCategoryName(ev.target.value)}
                  disabled={!draft.style}
                />
              </div>
            )}
          </div>

          {isCustomCategory ? (
            <div className="row g-2 mt-1">
              <div className="col-12">
                <label className="form-label">Sous-catégories de départ</label>
                <input
                  className="form-control duu-focus"
                  placeholder="Ex: Épices, Riz, Huiles (séparées par des virgules)"
                  value={newSubCatsRaw}
                  onChange={(ev) => setNewSubCatsRaw(ev.target.value)}
                  disabled={!draft.style}
                />

                {createdSubCatsPreview.length ? (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {createdSubCatsPreview.map((x) => (
                      <span key={x} className="badge bg-light text-dark border">
                        {x}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="row g-2 mt-1">
              <div className="col-6">
                <label className="form-label">Sous-catégorie (liée)</label>
                <select
                  className="form-select duu-focus"
                  disabled={!draft.style || !draft.category_id}
                  value={isCustomSubCategory ? "__other__" : draft.sub_category_id ? String(draft.sub_category_id) : ""}
                  onChange={(ev) => {
                    const val = ev.target.value;
                    if (val === "__other__") {
                      setIsCustomSubCategory(true);
                      setDraft((d) => ({ ...d, sub_category_id: null }));
                      return;
                    }
                    setIsCustomSubCategory(false);
                    setNewSubCategoryName("");
                    setDraft((d) => ({ ...d, sub_category_id: val ? Number(val) : null }));
                  }}
                >
                  <option value="">
                    {!draft.style
                      ? "(Choisir le type d’abord)"
                      : !draft.category_id
                      ? "(Choisir une catégorie d’abord)"
                      : filteredSubCats.length
                      ? "(Sélectionner)"
                      : "(Aucune sous-catégorie)"}
                  </option>

                  {filteredSubCats.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}

                  {draft.category_id ? <option value="__other__">Autre…</option> : null}
                </select>

                <small className="text-muted">La liste dépend du type + catégorie sélectionnés.</small>
              </div>

              {isCustomSubCategory && (
                <div className="col-6">
                  <label className="form-label">Nouvelle sous-catégorie</label>
                  <input
                    className="form-control duu-focus"
                    placeholder="Ex: Épices, Conserves, Snacks…"
                    value={newSubCategoryName}
                    onChange={(ev) => setNewSubCategoryName(ev.target.value)}
                    disabled={!draft.style || !draft.category_id}
                  />
                  <small className="text-muted">Elle sera créée et liée automatiquement à cette catégorie.</small>
                </div>
              )}
            </div>
          )}

          <div className="row g-2 mt-2">
            <div className="col-4">
              <label className="form-label">Prix</label>
              <input
                type="number"
                step="0.01"
                className="form-control duu-focus"
                value={draft.price ?? ""}
                onChange={(ev) =>
                  setDraft((d) => ({
                    ...d,
                    price: ev.target.value === "" ? null : Number(ev.target.value),
                  }))
                }
                required
              />
            </div>
            <div className="col-4">
              <label className="form-label">Devise</label>
              <input
                className="form-control duu-focus"
                value={draft.currency || "MAD"}
                onChange={(ev) => setDraft((d) => ({ ...d, currency: ev.target.value }))}
              />
            </div>
            <div className="col-4">
              <label className="form-label">Stock</label>
              <input
                type="number"
                className="form-control duu-focus"
                value={draft.stock ?? ""}
                onChange={(ev) =>
                  setDraft((d) => ({
                    ...d,
                    stock: ev.target.value === "" ? null : Number(ev.target.value),
                  }))
                }
              />
            </div>
          </div>

          {/* ✅ Variants block (Fashion only) */}
          {isFashion && (
            <>
              <VariantMatrix
                variants={variants}
                mutateVariants={mutateVariants}
                variantsLoading={variantsLoading}
                variantsErr={variantsErr}
                variantsOk={variantsOk}
                setVariantsErr={setVariantsErr}
                setVariantsOk={setVariantsOk}
                isEdit={isEdit}
                productName={draft.name || ""}
                basePrice={safeBasePrice}
                onCleanAll={cleanAllVariants}
                selectedKeys={selectedKeys}
                onToggleKey={toggleKey}
              />
              <VariantBulkEditBar
                selectedKeys={selectedKeys}
                onClearSelection={() => setSelectedKeys(new Set())}
                mutateVariants={mutateVariants}
              />
            </>
          )}

          <div className="row g-2 mt-1">
            <div className="col-6">
              <div className="form-check mt-4">
                <input
                  id="feat"
                  className="form-check-input"
                  type="checkbox"
                  checked={!!draft.is_featured}
                  onChange={(ev) => setDraft((d) => ({ ...d, is_featured: ev.target.checked ? 1 : 0 }))}
                />
                <label htmlFor="feat" className="form-check-label">
                  Mis en avant
                </label>
              </div>
            </div>

            <div className="col-6">
              <div className="form-check mt-4">
                <input
                  id="promo"
                  className="form-check-input"
                  type="checkbox"
                  checked={!!draft.promo_eligible}
                  onChange={(ev) => {
                    const checked = ev.target.checked;
                    setDraft((d) => ({
                      ...d,
                      promo_eligible: checked ? 1 : 0,
                      ...(checked ? {} : { promo_discount_value: null, promo_discount_type: "PERCENT" }),
                    }));
                  }}
                />
                <label htmlFor="promo" className="form-check-label">
                  Éligible promo
                </label>
              </div>
            </div>
          </div>

          {promoEnabled && (
            <div className="card border-0 bg-light mt-2 duu-admin-card">
              <div className="card-body p-3">
                <div className="fw-semibold mb-2">Réduction</div>

                <div className="row g-2 align-items-end">
                  <div className="col-6 col-md-4">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select duu-focus"
                      value={promoType}
                      onChange={(ev) =>
                        setDraft((d) => ({
                          ...d,
                          promo_discount_type: (ev.target.value as PromoDiscountType) || "PERCENT",
                        }))
                      }
                    >
                      <option value="PERCENT">Pourcentage (%)</option>
                      <option value="AMOUNT">Montant (MAD)</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-4">
                    <label className="form-label">Valeur {promoType === "PERCENT" ? "(%)" : "(MAD)"}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control duu-focus"
                      value={draft.promo_discount_value ?? ""}
                      onChange={(ev) =>
                        setDraft((d) => ({
                          ...d,
                          promo_discount_value: ev.target.value === "" ? null : Number(ev.target.value),
                        }))
                      }
                      placeholder={promoType === "PERCENT" ? "Ex: 10" : "Ex: 20"}
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="small text-muted">Aperçu</div>
                    <div className="fw-semibold">
                      {promoPricePreview == null ? "—" : moneyMAD(promoPricePreview)}
                      {promoPricePreview != null && draft.price != null ? (
                        <span className="ms-2 small text-muted">(au lieu de {moneyMAD(Number(draft.price))})</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <small className="text-muted d-block mt-2">
                  Cette réduction sera utilisée pour afficher le prix promo côté client.
                </small>
              </div>
            </div>
          )}

          {formError && <div className="alert alert-danger py-2 mt-2">{formError}</div>}

          <div className="mt-2">
            <label className="form-label">Description</label>
            <textarea
              className="form-control duu-focus"
              rows={3}
              value={draft.description || ""}
              onChange={(ev) => setDraft((d) => ({ ...d, description: ev.target.value }))}
            />
          </div>
        </div>

        <ImagePicker
          files={files}
          setFiles={setFiles}
          replaceImages={replaceImages}
          setReplaceImages={setReplaceImages}
          existingImages={hasExistingImages ? (initial as any).images : undefined}
        />
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="btn btn-dark" disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
