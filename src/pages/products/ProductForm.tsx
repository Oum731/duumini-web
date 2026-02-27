// src/pages/products/ProductForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../services/http";
import type { Category } from "../../services/categories";
import type {
  Product,
  ProductVariant,
  PromoDiscountType as SvcPromoDiscountType,
} from "../../services/products";
import { listProductVariants, removeProductVariant } from "../../services/products";

/* ================= Types ================= */

export type ProductImage = { id: number; url: string; sort_order: number };

export type FullProduct = Product &
  { images?: ProductImage[] } & {
    shop_name?: string | null;
    sub_category_name?: string | null;
  };

export type Shop = {
  id: number;
  name: string;
  logo?: string | null;
  cover?: string | null;
};

export type SubCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  category_name?: string | null;
  category_slug?: string | null;
};

export type ProductStyle = "food" | "market" | "fashion";
export type PromoDiscountType = SvcPromoDiscountType;

export type Draft = {
  style?: ProductStyle | "";
  name: string;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  stock?: number | null;

  is_featured?: 0 | 1 | null;
  promo_eligible?: 0 | 1 | null;

  category_id?: number | null;
  sub_category_id?: number | null;

  shop_id?: number | null;

  promo_discount_type?: PromoDiscountType | null;
  promo_discount_value?: number | null;
  promo_free_delivery?: 0 | 1 | null;

  is_active?: 0 | 1 | null;
};

/* ================= Helpers (exported for Admin pages) ================= */

const MAD_SCALE = 100;

function toCents(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * MAD_SCALE);
}
function fromCents(c: any): number {
  const x = Number(c);
  if (!Number.isFinite(x)) return 0;
  return x / MAD_SCALE;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function moneyMAD(n?: number | null, digits: 0 | 2 = 0) {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe);
}

export function imgUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
}

function computePromoPrice(
  price: number,
  type: PromoDiscountType,
  value: number
) {
  const priceC = toCents(price);
  const v = Number(value);
  if (priceC <= 0 || !Number.isFinite(v) || v <= 0) return fromCents(priceC);

  if (type === "PERCENT") {
    const pct = clamp(v, 0, 100);
    const discountC = Math.round((priceC * pct) / 100);
    const outC = Math.max(0, priceC - discountC);
    return fromCents(outC);
  }

  const discountC = toCents(v);
  const outC = Math.max(0, priceC - discountC);
  return fromCents(outC);
}

export function isActive(p: any): 0 | 1 {
  const v =
    p?.is_active != null
      ? Number(p.is_active)
      : p?.active != null
      ? Number(p.active)
      : 1;
  return (v === 0 ? 0 : 1) as 0 | 1;
}

export function hasRealPromo(p: any): boolean {
  const eligible = Number(p?.promo_eligible || 0) === 1;
  const val = Number(p?.promo_discount_value || 0);
  return eligible && Number.isFinite(val) && val > 0;
}

export function promoLabel(p: any): string {
  if (!hasRealPromo(p)) return "—";
  const t = String(p?.promo_discount_type || "").toUpperCase();
  const v = Number(p?.promo_discount_value || 0);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return t === "AMOUNT" ? `-${moneyMAD(v)}` : `-${Math.round(v)}%`;
}

export function basePriceForAdmin(p: any): number {
  const n = Number(p?.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function promoPriceForAdmin(p: any): number | null {
  if (!hasRealPromo(p)) return null;
  const price = basePriceForAdmin(p);
  const t: PromoDiscountType =
    String(p?.promo_discount_type || "").toUpperCase() === "AMOUNT"
      ? "AMOUNT"
      : "PERCENT";
  const v = Number(p?.promo_discount_value || 0);
  if (price <= 0 || !Number.isFinite(v) || v <= 0) return null;
  return computePromoPrice(price, t, v);
}

function splitNames(raw: string) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function inferStyleFromProduct(p: any): ProductStyle | "" {
  const v = String(p?.vertical || "").toUpperCase();
  if (v === "FOOD") return "food";
  if (v === "MARKET") return "market";
  if (v === "FASHION") return "fashion";
  return "";
}

/* ================= Variants helpers (API + UI) ================= */

export type VariantDraft = {
  id?: number;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  stock?: number;
  price_override?: number | null;
  is_active?: 0 | 1 | null;
};

function normStr(x: any, max = 60): string | null {
  const s = String(x ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}
function normStock(x: any): number {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
function normPriceOverride(x: any): number | null {
  if (x === "" || x == null) return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function cleanVariantsForApi(
  list: VariantDraft[]
): Array<Partial<ProductVariant> & { stock?: number }> {
  const out: Array<Partial<ProductVariant> & { stock?: number }> = [];
  for (const v of list || []) {
    const size = normStr(v.size, 20);
    const color = normStr(v.color, 40);
    const sku = normStr(v.sku, 80);

    if (!size || !color) continue;

    out.push({
      size,
      color,
      sku,
      stock: normStock(v.stock),
      price_override: normPriceOverride(v.price_override),
      is_active: (v.is_active ?? 1) as any,
    });
  }
  return out;
}

function toUpperSku(s?: string | null) {
  const x = String(s ?? "").trim();
  if (!x) return "";
  return x.toUpperCase().replace(/\s+/g, "-").slice(0, 80);
}

function buildSkuAuto(name: string, size?: string | null, color?: string | null) {
  const n = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
  const s = String(size || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 8);
  const c = String(color || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 10);

  const parts = [n || "DUU", s || "X", c || "X"].filter(Boolean);
  return parts.join("-").slice(0, 80);
}

// UI keys
function normKeyPart(x: any) {
  return String(x ?? "").trim().toLowerCase();
}
function vKey(size?: string | null, color?: string | null) {
  return `${normKeyPart(size)}|${normKeyPart(color)}`;
}
function uniq(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = String(x ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

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
  onCreateCategory: (name: string) => Promise<Category>;
  onCreateSubCategory: (categoryId: number, name: string) => Promise<SubCategory>;
  onSubmit: (draft: Draft, files: File[], replaceImages: boolean, variants: VariantDraft[]) => Promise<void> | void;
  onCancel: () => void;
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeSubCategories = Array.isArray(subCategories) ? subCategories : [];
  const safeShops = Array.isArray(shops) ? shops : [];

  const [draft, setDraft] = useState<Draft>(() => {
    const anyInit: any = initial || {};
    return {
      style: "",
      name: anyInit?.name || "",
      price: anyInit?.price ?? null,
      description: anyInit?.description || "",
      stock: anyInit?.stock ?? null,
      currency: anyInit?.currency || "MAD",

      is_featured: anyInit?.is_featured != null ? (Number(anyInit.is_featured) as 0 | 1) : 0,
      promo_eligible: anyInit?.promo_eligible != null ? (Number(anyInit.promo_eligible) as 0 | 1) : 0,

      category_id: anyInit?.category_id != null && anyInit?.category_id !== "" ? Number(anyInit.category_id) : null,
      sub_category_id: anyInit?.sub_category_id != null && anyInit?.sub_category_id !== "" ? Number(anyInit.sub_category_id) : null,

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

  useEffect(() => {
    if (!initial) return;
    setDraft((d) => {
      if (d.style) return d;
      const style = inferStyleFromProduct(initial as any);
      return style ? { ...d, style } : d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

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

  const [galleryInput, setGalleryInput] = useState<HTMLInputElement | null>(null);
  const [cameraInput, setCameraInput] = useState<HTMLInputElement | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsErr, setVariantsErr] = useState<string | null>(null);
  const [variantsOk, setVariantsOk] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [variantsTouched, setVariantsTouched] = useState(false);

  const sizesPreset = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];
  const colorsPreset = ["Noir", "Blanc", "Rouge", "Bleu", "Vert", "Jaune", "Beige", "Gris", "Marron", "Rose"];

  const [activeSize, setActiveSize] = useState<string>(sizesPreset[0]);
  const [customSize, setCustomSize] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);

  const productId = Number((initial as any)?.id || 0);
  const isFashion = String(draft.style || "").toLowerCase() === "fashion";
  const isEdit = !!productId;

  function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const current = [...files];
    for (const f of Array.from(list)) {
      if (current.length >= 8) break;
      current.push(f);
    }
    setFiles(current.slice(0, 8));
  }

  function removeAt(i: number) {
    const arr = [...files];
    arr.splice(i, 1);
    setFiles(arr);
  }

  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

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

  const categoriesByStyle = useMemo(() => {
    const st = String(draft.style || "").toLowerCase();
    if (!st) return safeCategories;
    return safeCategories;
  }, [safeCategories, draft.style]);

  const filteredSubCats = useMemo(() => {
    const cid = Number(draft.category_id || 0);
    if (!cid) return [];
    let list = safeSubCategories.filter((sc) => Number(sc.category_id) === cid);
    return list;
  }, [safeSubCategories, draft.category_id, draft.style]);

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
    setActiveSize(sizesPreset[0]);
    setCustomSize("");
    setCustomColor("");
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
        const mapped: VariantDraft[] = (rows || []).map((v) => ({
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

  function hasVariant(size: string, color: string) {
    const k = vKey(size, color);
    return (variants || []).some((v) => vKey(v.size, v.color) === k);
  }

  function upsertVariant(size: string, color: string, patch?: Partial<VariantDraft>) {
    const k = vKey(size, color);
    setVariantsTouched(true);
    setVariants((prev) => {
      const arr = [...(prev || [])];
      const idx = arr.findIndex((v) => vKey(v.size, v.color) === k);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...patch, size, color };
        return arr;
      }
      return [
        ...arr,
        {
          size,
          color,
          sku: null,
          stock: 0,
          price_override: null,
          is_active: 1,
          ...(patch || {}),
        },
      ];
    });
    setLastAddedKey(k);
    window.setTimeout(() => setLastAddedKey(null), 900);
  }

  function removeVariant(size: string, color: string) {
    const k = vKey(size, color);
    setVariantsTouched(true);
    setVariants((prev) => (prev || []).filter((v) => vKey(v.size, v.color) !== k));
  }

  function patchVariantByKey(size: string, color: string, patch: Partial<VariantDraft>) {
    const k = vKey(size, color);
    setVariantsTouched(true);
    setVariants((prev) =>
      (prev || []).map((v) => (vKey(v.size, v.color) === k ? { ...v, ...patch } : v))
    );
  }

  const variantsBySize = useMemo(() => {
    const map = new Map<string, VariantDraft[]>();
    for (const v of variants || []) {
      const s = String(v.size ?? "").trim();
      const c = String(v.color ?? "").trim();
      if (!s || !c) continue;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(v);
    }
    for (const [, arr] of map.entries()) {
      arr.sort((a, b) =>
        String(a.color || "").localeCompare(String(b.color || ""), "fr", { sensitivity: "base" })
      );
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "fr", { sensitivity: "base" })
    );
  }, [variants]);

  const allSizesUI = useMemo(
    () => uniq([...sizesPreset, ...variantsBySize.map(([s]) => s)]),
    [variantsBySize]
  );
  const allColorsUI = useMemo(() => {
    const fromVariants: string[] = [];
    for (const [, arr] of variantsBySize) for (const v of arr) fromVariants.push(String(v.color || ""));
    return uniq([...colorsPreset, ...fromVariants]);
  }, [variantsBySize]);

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

    const promoErr = validatePromo();
    if (promoErr) {
      setFormError(promoErr);
      return;
    }

    if (!isVendor && !draft.shop_id) {
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
        const createdCat = await onCreateCategory(newCategoryName.trim());
        categoryId = createdCat.id;

        const cid = Number(categoryId || 0);
        if (!cid) throw new Error("category_id manquant après création.");

        const names = splitNames(newSubCatsRaw);
        let firstCreated: SubCategory | null = null;

        for (let i = 0; i < names.length; i++) {
          const created = await onCreateSubCategory(cid, names[i]);
          if (!firstCreated) firstCreated = created;
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
          const createdSub = await onCreateSubCategory(cid, newSubCategoryName.trim());
          subCatId = createdSub.id;
          setIsCustomSubCategory(false);
          setNewSubCategoryName("");
        }
      }

      const finalDraft: Draft = {
        ...draft,
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
        .duu-chip.flash{
          box-shadow: 0 0 0 .22rem rgba(253,220,0,.35);
          border-color: rgba(229,57,53,.35);
        }
        .duu-variant-mini{
          background:#fff;
          border:1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          padding: 10px 12px;
          box-shadow: 0 10px 22px rgba(0,0,0,.06);
        }
        .duu-variant-mini .lbl{ font-size:.82rem; color: rgba(0,0,0,.55); font-weight:800; }
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
                onChange={(ev) => setDraft((d) => ({ ...d, style: (ev.target.value as any) || "" }))}
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
                    Choisis une <b>taille</b>, puis coche une ou plusieurs <b>couleurs</b>.
                  </div>
                  <div className="small duu-muted mt-1">
                    Prix produit: <b>{safeBasePrice > 0 ? moneyMAD(safeBasePrice) : "—"}</b> • Prix variante (optionnel)
                    remplace le prix produit.
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => {
                      setVariantsTouched(true);
                      setVariants((prev) =>
                        (prev || []).map((v) => ({
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
                      if (!draft.name.trim()) {
                        setVariantsErr("Renseigne le nom du produit avant de générer des SKU.");
                        return;
                      }
                      setVariantsErr(null);
                      setVariantsTouched(true);
                      setVariants((prev) =>
                        (prev || []).map((v) => ({
                          ...v,
                          sku:
                            v.sku && String(v.sku).trim()
                              ? toUpperSku(v.sku)
                              : buildSkuAuto(draft.name, v.size ?? null, v.color ?? null),
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
                      onClick={cleanAllVariants}
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

              {/* 1) Tailles */}
              <div className="mt-3">
                <div className="fw-semibold mb-2">1) Taille</div>

                <div className="d-flex flex-wrap gap-2">
                  {allSizesUI.map((s) => {
                    const checked = String(activeSize) === String(s);
                    return (
                      <label
                        key={s}
                        className="duu-chip"
                        style={{
                          borderColor: checked ? "rgba(229,57,53,.35)" : "rgba(0,0,0,.10)",
                          boxShadow: checked ? "0 0 0 .18rem rgba(253,220,0,.28)" : "none",
                        }}
                      >
                        <input
                          type="radio"
                          name="sizeRadio"
                          checked={checked}
                          onChange={() => setActiveSize(s)}
                          style={{ marginRight: 6 }}
                        />
                        {s}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-2 d-flex gap-2 flex-wrap">
                  <input
                    className="form-control duu-focus"
                    style={{ maxWidth: 260 }}
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
                      setActiveSize(s);
                      setCustomSize("");
                    }}
                  >
                    Ajouter taille
                  </button>
                </div>
              </div>

              {/* 2) Couleurs */}
              <div className="mt-3">
                <div className="fw-semibold mb-2">
                  2) Couleurs pour : <span className="badge text-bg-dark">{activeSize}</span>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {allColorsUI.map((c) => {
                    const checked = hasVariant(activeSize, c);
                    const k = vKey(activeSize, c);
                    return (
                      <label key={k} className={`duu-chip ${lastAddedKey === k ? "flash" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => (e.target.checked ? upsertVariant(activeSize, c) : removeVariant(activeSize, c))}
                          style={{ marginRight: 6 }}
                        />
                        {c}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-2 d-flex gap-2 flex-wrap">
                  <input
                    className="form-control duu-focus"
                    style={{ maxWidth: 260 }}
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
                      if (hasVariant(activeSize, c)) {
                        setCustomColor("");
                        return;
                      }
                      upsertVariant(activeSize, c);
                      setCustomColor("");
                    }}
                  >
                    Ajouter couleur
                  </button>
                </div>
              </div>

              {/* Grouped view */}
              <div className="mt-4">
                <div className="fw-semibold mb-2">Variantes ajoutées</div>

                {variantsBySize.length === 0 ? (
                  <div className="text-muted small">
                    Aucune variante. Choisis une taille, puis coche une ou plusieurs couleurs.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {variantsBySize.map(([size, arr]) => (
                      <div key={size} className="p-2 rounded" style={{ background: "rgba(0,0,0,.03)" }}>
                        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                          <div className="fw-semibold">
                            Taille : <span className="badge text-bg-dark">{size}</span>
                            <span className="ms-2 small text-muted">({arr.length} couleur(s))</span>
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              if (!confirm(`Supprimer toutes les couleurs pour la taille "${size}" ?`)) return;
                              setVariantsTouched(true);
                              setVariants((prev) =>
                                (prev || []).filter((v) => String(v.size || "").trim() !== String(size).trim())
                              );
                            }}
                          >
                            Tout supprimer (taille)
                          </button>
                        </div>

                        <div className="row g-2">
                          {arr.map((v) => {
                            const color = String(v.color || "");
                            const isOn = (v.is_active ?? 1) === 1;
                            const stock = normStock(v.stock ?? 0);
                            const override = v.price_override != null ? Number(v.price_override) : null;
                            const priceFinal = override != null && override > 0 ? override : safeBasePrice;

                            return (
                              <div className="col-12 col-md-6" key={vKey(size, color)}>
                                <div className="duu-variant-mini">
                                  <div className="d-flex align-items-center justify-content-between gap-2">
                                    <div className="fw-semibold">
                                      <span className="badge bg-light text-dark border">{color}</span>
                                      {!isOn ? (
                                        <span className="ms-2 badge bg-secondary">Off</span>
                                      ) : stock <= 0 ? (
                                        <span className="ms-2 badge bg-danger">Rupture</span>
                                      ) : (
                                        <span className="ms-2 badge bg-success">OK</span>
                                      )}
                                    </div>

                                    <div className="d-flex gap-2">
                                      <button
                                        type="button"
                                        className={`btn btn-sm ${isOn ? "btn-outline-dark" : "btn-dark"}`}
                                        onClick={() => patchVariantByKey(size, color, { is_active: isOn ? 0 : 1 })}
                                      >
                                        {isOn ? "Désactiver" : "Activer"}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeVariant(size, color)}
                                        title="Supprimer cette variante"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>

                                  <div className="row g-2 mt-2">
                                    <div className="col-6">
                                      <div className="lbl mb-1">Stock</div>
                                      <input
                                        type="number"
                                        className="form-control duu-focus"
                                        value={stock}
                                        min={0}
                                        onChange={(e) => patchVariantByKey(size, color, { stock: Number(e.target.value || 0) })}
                                      />
                                    </div>

                                    <div className="col-6">
                                      <div className="lbl mb-1">Prix var. (opt)</div>
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="form-control duu-focus"
                                        value={v.price_override ?? ""}
                                        placeholder="= prix produit"
                                        onChange={(e) =>
                                          patchVariantByKey(size, color, {
                                            price_override: e.target.value === "" ? null : Number(e.target.value),
                                          })
                                        }
                                      />
                                    </div>

                                    <div className="col-12">
                                      <div className="lbl mb-1">SKU (opt)</div>
                                      <div className="input-group">
                                        <input
                                          className="form-control duu-focus"
                                          value={v.sku ?? ""}
                                          onChange={(e) => patchVariantByKey(size, color, { sku: e.target.value })}
                                          placeholder="Optionnel"
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary"
                                          onClick={() => patchVariantByKey(size, color, { sku: buildSkuAuto(draft.name, size, color) })}
                                          title="Auto"
                                        >
                                          Auto
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="small text-muted mt-2">
                                    Aperçu : <b>{moneyMAD(priceFinal)}</b> • Stock <b>{stock}</b>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="small text-muted mt-3">
                  Important : à l’enregistrement, seules les variantes avec <strong>taille + couleur</strong> seront envoyées à l’API.
                </div>
              </div>
            </div>
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

        <div className="col-12 col-md-4">
          <label className="form-label d-flex align-items-center justify-content-between">
            Images <small className="text-muted">Galerie / Caméra</small>
          </label>

          {hasExistingImages && !files.length && !replaceImages ? (
            <div className="mb-2">
              <div className="small text-muted mb-1">Images existantes :</div>
              <div className="row g-2">
                {(initial as any).images.map((img: ProductImage) => (
                  <div className="col-4" key={img.id}>
                    <img
                      src={imgUrl(img.url)}
                      alt="existing"
                      className="w-100 rounded border"
                      style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="d-flex flex-wrap gap-2 mb-2">
            <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => galleryInput?.click()}>
              Depuis la galerie
            </button>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => cameraInput?.click()}>
              Ouvrir la caméra
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setFiles([])}
              disabled={!files.length}
            >
              Vider
            </button>
          </div>

          <input
            ref={(el) => setGalleryInput(el)}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(ev) => addFiles(ev.target.files)}
          />
          <input
            ref={(el) => setCameraInput(el)}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(ev) => addFiles(ev.target.files)}
          />

          <div className="form-check mb-2">
            <input
              id="replace_images"
              className="form-check-input"
              type="checkbox"
              checked={replaceImages}
              onChange={(ev) => setReplaceImages(ev.target.checked)}
            />
            <label htmlFor="replace_images" className="form-check-label">
              Remplacer la galerie existante
            </label>
          </div>

          {files.length > 0 ? (
            <div className="row g-2">
              {previews.map((p, i) => (
                <div className="col-4" key={i}>
                  <div className="position-relative border rounded overflow-hidden">
                    <img
                      src={p.url}
                      alt={`img-${i}`}
                      className="w-100"
                      style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger position-absolute"
                      style={{ top: 6, right: 6 }}
                      onClick={() => removeAt(i)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : !hasExistingImages ? (
            <div className="text-muted small">Aucune image sélectionnée.</div>
          ) : null}
        </div>
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