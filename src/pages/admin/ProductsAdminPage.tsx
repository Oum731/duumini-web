// src/pages/admin/ProductsAdminPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getProduct,
  type Product,
  type ProductVariant,
  createProduct,
  updateProduct,
  removeProduct,
  listProductVariants,
  upsertProductVariants,
  removeProductVariant,
} from "../../services/products";
import {
  listCategories,
  type Category,
  createCategory,
} from "../../services/categories";
import { listSubCategories, createSubCategory } from "../../services/subCategories";
import { API_BASE, api } from "../../services/http";

type ProductImage = { id: number; url: string; sort_order: number };
type FullProduct = Product &
  { images?: ProductImage[] } & {
    shop_name?: string | null;
    sub_category_name?: string | null;
  };

type Shop = {
  id: number;
  name: string;
  logo?: string | null;
  cover?: string | null;
};

type PromoDiscountType = "PERCENT" | "AMOUNT";

type SubCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  category_name?: string | null;
  category_slug?: string | null;
};

type ProductStyle = "food" | "market" | "fashion";

type Draft = {
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

type Mode = "default" | "top-ordered" | "top-rated";
type Channel = "all" | "african-food" | "african-market" | "fashion";

/* ================= Helpers ================= */

/** ✅ Anti-bug float: tout calcul promo en centimes */
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

function moneyMAD(n?: number | null, digits: 0 | 2 = 0) {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe);
}

function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function computePromoPrice(price: number, type: PromoDiscountType, value: number) {
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

function isActive(p: any) {
  return p?.active ?? p?.is_active ?? 1 ? 1 : 0;
}

function hasRealPromo(p: any) {
  const active = isActive(p);
  if (!active) return false;
  return Number(p?.promo_eligible || 0) === 1 && Number(p?.promo_discount_value ?? 0) > 0;
}

function promoLabel(p: any) {
  if (!hasRealPromo(p)) return "—";
  const t = String(p?.promo_discount_type || "").toUpperCase();
  const v = Number(p?.promo_discount_value || 0);
  if (t === "AMOUNT") return `-${moneyMAD(v)}`;
  return `-${Math.round(v)}%`;
}

/**
 * ✅ Prix base admin:
 * - si variants => min_price (sinon price)
 * ✅ Retourne TOUJOURS un number (jamais null)
 */
function basePriceForAdmin(p: any): number {
  const hasVariants = !!p?.has_variants || Number(p?.variants_count || 0) > 0;

  const minp: number | null =
    p?.min_price == null || p?.min_price === ""
      ? null
      : Number(p.min_price);

  const price: number =
    p?.price == null || p?.price === ""
      ? 0
      : Number(p.price);

  if (hasVariants && minp != null && Number.isFinite(minp) && minp >= 0) {
    return minp;
  }

  return Number.isFinite(price) ? price : 0;
}

/** ✅ Fallback local promo (en centimes => pas de 100.86) */
function computePromoPriceLocal(base: number, eligible: any, type: any, value: any) {
  if (Number(eligible) !== 1) return null;

  const baseC = toCents(base);
  const v = Number(value);
  if (baseC <= 0 || !Number.isFinite(v) || v <= 0) return null;

  const t = String(type || "").toUpperCase();

  if (t === "AMOUNT") {
    const outC = Math.max(0, baseC - toCents(v));
    return fromCents(outC);
  }

  const pct = clamp(v, 0, 100);
  const discountC = Math.round((baseC * pct) / 100);
  const outC = Math.max(0, baseC - discountC);
  return fromCents(outC);
}

/**
 * ✅ Prix promo admin:
 * - si variants => min_promo_price (sinon promo_price)
 * - fallback local si l’API ne renvoie pas encore promo_price
 */
function promoPriceForAdmin(p: any) {
  if (!hasRealPromo(p)) return null;

  const hasVariants = !!p?.has_variants || Number(p?.variants_count || 0) > 0;
  const apiPromo = hasVariants ? p?.min_promo_price : p?.promo_price;
  const apiN = apiPromo == null || apiPromo === "" ? null : Number(apiPromo);
  if (Number.isFinite(apiN as any)) return apiN as number;

  const base = basePriceForAdmin(p);
  return computePromoPriceLocal(base, p?.promo_eligible, p?.promo_discount_type, p?.promo_discount_value);
}

function splitNames(raw: string) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function unwrap<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res) return res.data as T;
  return res as T;
}

function getPaginated(res: any): { items: Product[]; pageInfo?: any } {
  const body = unwrap<any>(res);

  const items = Array.isArray(body?.items)
    ? (body.items as Product[])
    : Array.isArray(body?.data?.items)
    ? (body.data.items as Product[])
    : [];

  const pageInfo = body?.pageInfo ?? body?.data?.pageInfo ?? undefined;

  return { items, pageInfo };
}

function inferStyleFromProduct(p: any): ProductStyle | "" {
  const v = String(p?.vertical || "").toUpperCase();
  if (v === "FOOD") return "food";
  if (v === "MARKET") return "market";
  if (v === "FASHION") return "fashion";
  return "";
}

/* ========= Variants helpers (UI) ========= */
type VariantDraft = {
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
function cleanVariantsForApi(list: VariantDraft[]): Array<Partial<ProductVariant> & { stock?: number }> {
  const out: Array<Partial<ProductVariant> & { stock?: number }> = [];
  for (const v of list || []) {
    const size = normStr(v.size, 20);
    const color = normStr(v.color, 40);
    const sku = normStr(v.sku, 80);
    if (!size && !color) continue;

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

/* ========= Formulaire Produit ========= */
function ProductForm({
  initial,
  categories,
  subCategories,
  shops,
  onCreateCategory,
  onCreateSubCategory,
  onSubmit,
  onCancel,
}: {
  initial?: (Partial<FullProduct> & { images?: ProductImage[] }) | undefined;
  categories: Category[];
  subCategories: SubCategory[];
  shops: Shop[];
  onCreateCategory: (name: string) => Promise<Category>;
  onCreateSubCategory: (categoryId: number, name: string) => Promise<SubCategory>;
  onSubmit: (draft: Draft, files: File[], replaceImages: boolean, variants: VariantDraft[]) => Promise<void> | void;
  onCancel: () => void;
}) {
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
      promo_discount_value: typeof anyInit?.promo_discount_value === "number" ? anyInit.promo_discount_value : null,

      promo_free_delivery: anyInit?.promo_free_delivery != null ? (Number(anyInit.promo_free_delivery) as 0 | 1) : 0,

      is_active:
        anyInit?.is_active != null
          ? (Number(anyInit.is_active) as 0 | 1)
          : anyInit?.active != null
          ? (Number(anyInit.active) as 0 | 1)
          : null,
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

  const [bulkSizesRaw, setBulkSizesRaw] = useState("");
  const [bulkColorsRaw, setBulkColorsRaw] = useState("");
  const [bulkStock, setBulkStock] = useState<number>(0);
  const [bulkPriceOverride, setBulkPriceOverride] = useState<string>("");

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

  function previewURL(f: File) {
    return URL.createObjectURL(f);
  }

  const hasExistingImages = (initial as any)?.images?.length > 0;
  const selectedShop = shops.find((s) => s.id === (draft.shop_id ?? undefined));

  const promoEnabled = !!draft.promo_eligible;
  const promoType: PromoDiscountType = draft.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";

  const promoValueNum = Number(draft.promo_discount_value ?? 0);
  const priceNum = Number(draft.price ?? 0);

  const promoPricePreview = useMemo(() => {
    if (!promoEnabled) return null;
    if (!priceNum || !promoValueNum) return null;
    return computePromoPrice(priceNum, promoType, promoValueNum);
  }, [promoEnabled, promoType, promoValueNum, priceNum]);

  const categoriesByStyle = useMemo(() => {
    const style = String(draft.style || "").toLowerCase();
    if (!style) return categories;

    const wanted = new Set<number>();
    for (const sc of subCategories || []) {
      const s = String(sc.slug || "").toLowerCase();
      if (s === style) wanted.add(Number(sc.category_id));
    }
    if (!wanted.size) return categories;
    return categories.filter((c) => wanted.has(c.id));
  }, [categories, subCategories, draft.style]);

  const filteredSubCats = useMemo(() => {
    const cid = Number(draft.category_id || 0);
    if (!cid) return [];

    let list = (subCategories || []).filter((sc) => Number(sc.category_id) === cid);

    const style = String(draft.style || "").toLowerCase();
    if (style) {
      const byStyle = list.filter((sc) => String(sc.slug || "").toLowerCase() === style);
      if (byStyle.length) list = byStyle;
    }

    return list;
  }, [subCategories, draft.category_id, draft.style]);

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
    setBulkSizesRaw("");
    setBulkColorsRaw("");
    setBulkStock(0);
    setBulkPriceOverride("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.style]);

  useEffect(() => {
    const cid = Number(draft.category_id || 0);
    const sid = Number(draft.sub_category_id || 0);
    if (!cid || !sid) return;

    const ok = subCategories.some((sc) => sc.id === sid && Number(sc.category_id) === cid);
    if (!ok) setDraft((d) => ({ ...d, sub_category_id: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.category_id]);

  useEffect(() => {
    if (!isCustomCategory) {
      setCreatedSubCatsPreview([]);
      return;
    }
    const names = splitNames(newSubCatsRaw);
    setCreatedSubCatsPreview(names);
  }, [newSubCatsRaw, isCustomCategory]);

  useEffect(() => {
    const run = async () => {
      setVariantsErr(null);
      setVariantsOk(null);

      if (!isFashion) return;

      if (!isEdit) {
        if (!variantsTouched && variants.length === 0) {
          setVariants([{ size: null, color: null, sku: null, stock: 0, price_override: null, is_active: 1 }]);
        }
        return;
      }

      if (variantsTouched) return;

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
    if (!Number.isFinite(v) || v <= 0) {
      return "Renseigne une réduction valide (nombre > 0).";
    }

    if (promoType === "PERCENT") {
      if (v <= 0 || v > 95) return "Le pourcentage doit être entre 1 et 95.";
    } else {
      if (v >= Number(draft.price)) return "Le montant de réduction doit être inférieur au prix.";
    }

    return null;
  }

  function addVariantRow(prefill?: Partial<VariantDraft>) {
    setVariantsTouched(true);
    setVariants((prev) => [
      ...prev,
      { size: null, color: null, sku: null, stock: 0, price_override: null, is_active: 1, ...(prefill || {}) },
    ]);
  }

  function removeVariantRowAt(i: number) {
    setVariantsTouched(true);
    setVariants((prev) => {
      const arr = [...prev];
      arr.splice(i, 1);
      return arr;
    });
  }

  function patchVariant(idx: number, patch: Partial<VariantDraft>) {
    setVariantsTouched(true);
    setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function dedupeVariants(list: VariantDraft[]) {
    const seen = new Set<string>();
    const out: VariantDraft[] = [];
    for (const v of list) {
      const key = `${String(v.size ?? "").trim().toLowerCase()}|${String(v.color ?? "").trim().toLowerCase()}`;
      if (key === "|") continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }

  function bulkAddVariants() {
    const sizes = splitNames(bulkSizesRaw);
    const colors = splitNames(bulkColorsRaw);

    if (!sizes.length && !colors.length) {
      setVariantsErr("Renseigne au moins des tailles ou des couleurs pour le générateur.");
      return;
    }
    setVariantsErr(null);
    setVariantsOk(null);

    const base: VariantDraft[] = [];
    const stock = normStock(bulkStock);
    const po = normPriceOverride(bulkPriceOverride);

    const sz = sizes.length ? sizes : [""];
    const cl = colors.length ? colors : [""];

    for (const s of sz) {
      for (const c of cl) {
        base.push({
          size: s ? s : null,
          color: c ? c : null,
          sku: null,
          stock,
          price_override: po,
          is_active: 1,
        });
      }
    }

    setVariantsTouched(true);
    setVariants((prev) => dedupeVariants([...prev, ...base]));
  }

  async function cleanAllVariants() {
    if (!isEdit || !isFashion) return;
    if (!confirm("Supprimer TOUTES les variantes de ce produit ? (clean total)")) return;

    setVariantsErr(null);
    setVariantsOk(null);
    setVariantsLoading(true);
    try {
      const rows = await listProductVariants(productId);
      for (const v of rows || []) await removeProductVariant(v.id);
      setVariants([]);
      setVariantsTouched(true);
      setVariantsOk("Toutes les variantes ont été supprimées.");
    } catch (e: any) {
      setVariantsErr(e?.message || String(e));
    } finally {
      setVariantsLoading(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const style = String(draft.style || "").toLowerCase();
    if (style !== "food" && style !== "market" && style !== "fashion") {
      setFormError("Choisis d’abord le type : Food / Market / Fashion.");
      return;
    }

    const promoErr = validatePromo();
    if (promoErr) {
      setFormError(promoErr);
      return;
    }

    if (isCustomCategory) {
      if (!newCategoryName.trim()) {
        setFormError("Renseigne le nom de la nouvelle catégorie.");
        return;
      }
      const scNames = splitNames(newSubCatsRaw);
      if (!scNames.length) {
        setFormError("Ajoute au moins une sous-catégorie pour la nouvelle catégorie (séparées par des virgules).");
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
        setDraft((d) => ({ ...d, category_id: categoryId ?? null, sub_category_id: subCatId ?? null }));
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

      const finalDraft: Draft = { ...draft, category_id: categoryId ?? null, sub_category_id: subCatId ?? null };
      await onSubmit(finalDraft, files, replaceImages, variants);
    } catch (err: any) {
      setFormError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const basePrice = Number(draft.price ?? 0);
  const safeBasePrice = basePrice > 0 ? basePrice : 0;

  const sizesPreset = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];
  const colorsPreset = ["Noir", "Blanc", "Rouge", "Bleu", "Vert", "Jaune", "Beige", "Gris", "Marron", "Rose"];

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
        .btn-duu{ background: var(--duu-yellow, #fddc00); color:#1f1f1f; border: none; font-weight: 900; }
        .btn-duu:hover{ filter: brightness(.96); }
        .duu-variant-card{
          background:#fff;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          box-shadow: 0 10px 28px rgba(0,0,0,.08);
          overflow:hidden;
        }
        .duu-variant-head{
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding: 10px 12px;
          background: linear-gradient(180deg, rgba(253,220,0,.28), rgba(255,255,255,1));
          border-bottom: 1px solid rgba(0,0,0,.06);
        }
        .duu-variant-title{
          font-weight: 950;
          color: rgba(0,0,0,.84);
          display:flex; align-items:center; gap:10px;
        }
        .duu-variant-body{ padding: 12px; }
        .duu-mini-chip{
          all:unset;
          display:inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.10);
          background: #fff;
          cursor:pointer;
          font-weight: 800;
          color: rgba(0,0,0,.75);
        }
        .duu-mini-chip:hover{ background: rgba(0,0,0,.03); }
        .duu-mini-chip.active{
          border-color: rgba(229,57,53,.35);
          box-shadow: 0 0 0 .18rem rgba(253,220,0,.28);
          color: rgba(0,0,0,.88);
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
                >
                  <option value="">(Sélectionner une boutique)</option>
                  {shops.map((s) => (
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

              <small className="text-muted">Admin : boutique obligatoire. Vendeur : sa boutique est déduite côté API.</small>
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
                  } else {
                    setIsCustomCategory(false);
                    setNewCategoryName("");
                    setNewSubCatsRaw("");
                    setCreatedSubCatsPreview([]);
                    const cid = val ? Number(val) : null;
                    setDraft((d) => ({ ...d, category_id: cid, sub_category_id: null }));
                  }
                }}
              >
                <option value="">{!draft.style ? "(Choisir le type d’abord)" : "(Sélectionner)"}</option>
                {categoriesByStyle.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                    } else {
                      setIsCustomSubCategory(false);
                      setNewSubCategoryName("");
                      setDraft((d) => ({ ...d, sub_category_id: val ? Number(val) : null }));
                    }
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
                onChange={(ev) => setDraft((d) => ({ ...d, price: ev.target.value === "" ? null : Number(ev.target.value) }))}
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
                onChange={(ev) => setDraft((d) => ({ ...d, stock: ev.target.value === "" ? null : Number(ev.target.value) }))}
              />
            </div>
          </div>

          {/* ✅ Variants block (Fashion only) */}
          {isFashion && (
            <div className="duu-admin-soft mt-3 p-3">
              <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="fw-semibold">Variantes (Fashion)</div>
                    <span className="duu-pill">
                      <small>Total</small> {variants.length}
                    </span>
                    <span className="duu-pill">
                      <small>Actives</small> {variants.filter((v) => (v.is_active ?? 1) === 1).length}
                    </span>
                  </div>
                  <div className="small text-muted mt-1">
                    Ajoute des tailles/couleurs. Stock et prix override par variante (optionnel). Le prix final affiché sera le prix produit si tu ne mets pas un prix variante.
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-sm btn-duu" onClick={() => addVariantRow()} disabled={variantsLoading}>
                    + Ajouter
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => {
                      setVariantsTouched(true);
                      setVariants((prev) => prev.map((v) => ({ ...v, sku: toUpperSku(v.sku ?? "") })));
                      setVariantsOk("SKU normalisés (MAJ + tirets).");
                      window.setTimeout(() => setVariantsOk(null), 1800);
                    }}
                    disabled={variantsLoading || !variants.length}
                    title="Met en MAJ et remplace les espaces par -"
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
                        prev.map((v) => ({
                          ...v,
                          sku: v.sku && String(v.sku).trim() ? toUpperSku(v.sku) : buildSkuAuto(draft.name, v.size ?? null, v.color ?? null),
                        }))
                      );
                      setVariantsOk("SKU générés automatiquement.");
                      window.setTimeout(() => setVariantsOk(null), 1800);
                    }}
                    disabled={variantsLoading || !variants.length}
                  >
                    Générer SKU
                  </button>

                  {isEdit && (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={cleanAllVariants} disabled={variantsLoading} title="Suppression réelle côté API (clean total)">
                      Supprimer tout
                    </button>
                  )}
                </div>
              </div>

              {variantsLoading ? <div className="text-muted small mt-2">Chargement variantes…</div> : null}
              {variantsOk ? <div className="alert alert-success py-2 mt-2 mb-0">{variantsOk}</div> : null}
              {variantsErr ? <div className="alert alert-danger py-2 mt-2 mb-0">{variantsErr}</div> : null}

              <div className="mt-3">
                <div className="fw-semibold mb-2">Générateur rapide</div>
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-4">
                    <label className="form-label small text-muted mb-1">Tailles (virgules)</label>
                    <input className="form-control duu-focus" value={bulkSizesRaw} onChange={(e) => setBulkSizesRaw(e.target.value)} placeholder="S, M, L, XL" />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small text-muted mb-1">Couleurs (virgules)</label>
                    <input className="form-control duu-focus" value={bulkColorsRaw} onChange={(e) => setBulkColorsRaw(e.target.value)} placeholder="Noir, Blanc, Rouge" />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small text-muted mb-1">Stock</label>
                    <input type="number" className="form-control duu-focus" value={bulkStock} onChange={(e) => setBulkStock(Number(e.target.value || 0))} min={0} />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small text-muted mb-1">Prix var.</label>
                    <input type="number" step="0.01" className="form-control duu-focus" value={bulkPriceOverride} onChange={(e) => setBulkPriceOverride(e.target.value)} placeholder="(opt)" />
                  </div>

                  <div className="col-12">
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-outline-dark btn-sm" onClick={bulkAddVariants} disabled={variantsLoading}>
                        Ajouter combinaisons
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setBulkSizesRaw("S, M, L, XL");
                          setBulkColorsRaw("Noir, Blanc");
                          setBulkStock(5);
                          setBulkPriceOverride("");
                        }}
                      >
                        Exemple
                      </button>
                      <span className="small duu-muted align-self-center">Astuce : tu peux mettre seulement tailles ou seulement couleurs (ça crée une liste simple).</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 d-flex flex-wrap gap-2">
                <div className="small text-muted w-100">Raccourcis tailles</div>
                {sizesPreset.map((s) => (
                  <button key={s} type="button" className="duu-mini-chip" onClick={() => addVariantRow({ size: s, stock: 0, is_active: 1 })}>
                    + {s}
                  </button>
                ))}
              </div>

              <div className="mt-2 d-flex flex-wrap gap-2">
                <div className="small text-muted w-100">Raccourcis couleurs</div>
                {colorsPreset.map((c) => (
                  <button key={c} type="button" className="duu-mini-chip" onClick={() => addVariantRow({ color: c, stock: 0, is_active: 1 })}>
                    + {c}
                  </button>
                ))}
              </div>

              <div className="row g-2 mt-3">
                {variants.length === 0 ? (
                  <div className="col-12 text-muted small">Aucune variante. Ajoute au moins une taille/couleur si c’est un produit Fashion.</div>
                ) : (
                  variants.map((v, idx) => {
                    const isOn = (v.is_active ?? 1) === 1;
                    const stock = normStock(v.stock ?? 0);
                    const override = v.price_override != null ? Number(v.price_override) : null;
                    const priceFinal = override != null && override > 0 ? override : safeBasePrice;
                    const hasPrice = priceFinal > 0;

                    return (
                      <div className="col-12" key={v.id ? `v-${v.id}` : `new-${idx}`}>
                        <div className="duu-variant-card">
                          <div className="duu-variant-head">
                            <div className="duu-variant-title">
                              <span className="badge text-bg-dark">#{idx + 1}</span>
                              <span className="small">
                                {String(v.size || "").trim() || "—"} <span className="text-muted">·</span> {String(v.color || "").trim() || "—"}
                              </span>
                              {!isOn ? <span className="badge bg-secondary">Off</span> : stock <= 0 ? <span className="badge bg-danger">Rupture</span> : <span className="badge bg-success">OK</span>}
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <button
                                type="button"
                                className={`btn btn-sm ${isOn ? "btn-outline-dark" : "btn-dark"}`}
                                onClick={() => patchVariant(idx, { is_active: isOn ? 0 : 1 })}
                                title="Activer / Désactiver"
                              >
                                {isOn ? "Désactiver" : "Activer"}
                              </button>

                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeVariantRowAt(idx)} title="Retirer cette ligne (UI)">
                                ×
                              </button>
                            </div>
                          </div>

                          <div className="duu-variant-body">
                            <div className="row g-2">
                              <div className="col-12 col-md-3">
                                <label className="form-label small text-muted mb-1">Taille</label>
                                <input
                                  list={`sizes-${idx}`}
                                  className="form-control duu-focus"
                                  value={v.size ?? ""}
                                  onChange={(e) => patchVariant(idx, { size: e.target.value })}
                                  placeholder="S / M / L / 42…"
                                />
                                <datalist id={`sizes-${idx}`}>
                                  {sizesPreset.map((s) => (
                                    <option key={s} value={s} />
                                  ))}
                                </datalist>
                              </div>

                              <div className="col-12 col-md-3">
                                <label className="form-label small text-muted mb-1">Couleur</label>
                                <input
                                  list={`colors-${idx}`}
                                  className="form-control duu-focus"
                                  value={v.color ?? ""}
                                  onChange={(e) => patchVariant(idx, { color: e.target.value })}
                                  placeholder="Noir / Blanc…"
                                />
                                <datalist id={`colors-${idx}`}>
                                  {colorsPreset.map((c) => (
                                    <option key={c} value={c} />
                                  ))}
                                </datalist>
                              </div>

                              <div className="col-12 col-md-3">
                                <label className="form-label small text-muted mb-1">SKU</label>
                                <div className="input-group">
                                  <input className="form-control duu-focus" value={v.sku ?? ""} onChange={(e) => patchVariant(idx, { sku: e.target.value })} placeholder="Optionnel" />
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => {
                                      const next = buildSkuAuto(draft.name, v.size ?? null, v.color ?? null);
                                      patchVariant(idx, { sku: next });
                                    }}
                                    title="Auto"
                                  >
                                    Auto
                                  </button>
                                </div>
                                <div className="small text-muted mt-1">Ex: DUU-TEE-M-NOIR</div>
                              </div>

                              <div className="col-12 col-md-3">
                                <label className="form-label small text-muted mb-1">Stock</label>
                                <div className="input-group">
                                  <button type="button" className="btn btn-outline-dark" onClick={() => patchVariant(idx, { stock: Math.max(0, stock - 1) })}>
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    className="form-control duu-focus text-center"
                                    value={stock}
                                    onChange={(e) => patchVariant(idx, { stock: e.target.value === "" ? 0 : Number(e.target.value) })}
                                    min={0}
                                  />
                                  <button type="button" className="btn btn-outline-dark" onClick={() => patchVariant(idx, { stock: stock + 1 })}>
                                    +
                                  </button>
                                </div>
                                <div className="small text-muted mt-1">0 = rupture</div>
                              </div>

                              <div className="col-12 col-md-4">
                                <label className="form-label small text-muted mb-1">Prix variante (optionnel)</label>
                                <div className="input-group">
                                  <span className="input-group-text">MAD</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="form-control duu-focus"
                                    value={v.price_override ?? ""}
                                    onChange={(e) => patchVariant(idx, { price_override: e.target.value === "" ? null : Number(e.target.value) })}
                                    placeholder="Laisser vide = prix produit"
                                  />
                                  <button type="button" className="btn btn-outline-secondary" onClick={() => patchVariant(idx, { price_override: null })}>
                                    Reset
                                  </button>
                                </div>
                              </div>

                              <div className="col-12 col-md-8">
                                <label className="form-label small text-muted mb-1">Aperçu</label>
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                  <span className="duu-pill">
                                    <small>Stock</small> {stock}
                                  </span>
                                  <span className="duu-pill">
                                    <small>Prix</small> {hasPrice ? moneyMAD(priceFinal) : "—"}
                                  </span>
                                  {override != null && override > 0 ? (
                                    <span className="badge bg-light text-dark border">Override</span>
                                  ) : (
                                    <span className="badge bg-light text-dark border">Prix produit</span>
                                  )}
                                  {String(v.sku || "").trim() ? (
                                    <span className="badge bg-dark-subtle text-dark border">SKU: {toUpperSku(v.sku)}</span>
                                  ) : null}
                                </div>
                                <div className="small text-muted mt-1">Si tu ne mets pas de prix variante → le prix produit s’applique automatiquement.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="small text-muted mt-3">
                Important : à l’enregistrement, seules les variantes avec <strong>taille ou couleur</strong> seront envoyées à l’API.
              </div>
            </div>
          )}

          <div className="row g-2 mt-1">
            <div className="col-6">
              <div className="form-check mt-4">
                <input id="feat" className="form-check-input" type="checkbox" checked={!!draft.is_featured} onChange={(ev) => setDraft((d) => ({ ...d, is_featured: ev.target.checked ? 1 : 0 }))} />
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
                      onChange={(ev) => setDraft((d) => ({ ...d, promo_discount_type: (ev.target.value as PromoDiscountType) || "PERCENT" }))}
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
                      onChange={(ev) => setDraft((d) => ({ ...d, promo_discount_value: ev.target.value === "" ? null : Number(ev.target.value) }))}
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

                <small className="text-muted d-block mt-2">Cette réduction sera utilisée pour afficher le prix promo côté client.</small>
              </div>
            </div>
          )}

          {formError && <div className="alert alert-danger py-2 mt-2">{formError}</div>}

          <div className="mt-2">
            <label className="form-label">Description</label>
            <textarea className="form-control duu-focus" rows={3} value={draft.description || ""} onChange={(ev) => setDraft((d) => ({ ...d, description: ev.target.value }))} />
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
                    <img src={imgUrl(img.url)} alt="existing" className="w-100 rounded border" style={{ aspectRatio: "1 / 1", objectFit: "cover" }} />
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
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFiles([])} disabled={!files.length}>
              Vider
            </button>
          </div>

          <input ref={(el) => setGalleryInput(el)} type="file" accept="image/*" multiple hidden onChange={(ev) => addFiles(ev.target.files)} />
          <input ref={(el) => setCameraInput(el)} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => addFiles(ev.target.files)} />

          <div className="form-check mb-2">
            <input id="replace_images" className="form-check-input" type="checkbox" checked={replaceImages} onChange={(ev) => setReplaceImages(ev.target.checked)} />
            <label htmlFor="replace_images" className="form-check-label">
              Remplacer la galerie existante
            </label>
          </div>

          {files.length > 0 ? (
            <div className="row g-2">
              {files.map((f, i) => (
                <div className="col-4" key={i}>
                  <div className="position-relative border rounded overflow-hidden">
                    <img src={previewURL(f)} alt={`img-${i}`} className="w-100" style={{ aspectRatio: "1 / 1", objectFit: "cover" }} />
                    <button type="button" className="btn btn-sm btn-danger position-absolute" style={{ top: 6, right: 6 }} onClick={() => removeAt(i)}>
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

/* ========= Page ========= */
export default function ProductsAdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<FullProduct | null>(null);
  const [preview, setPreview] = useState<FullProduct | null>(null);

  const [mode, setMode] = useState<Mode>("default");
  const [channel, setChannel] = useState<Channel>("all");

  const [onlyActive, setOnlyActive] = useState<boolean>(false);
  const [filterShopId, setFilterShopId] = useState<number | "">("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");

  const pages = useMemo(() => (mode === "default" ? Math.max(1, Math.ceil(total / pageSize)) : 1), [total, pageSize, mode]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "top-ordered" || mode === "top-rated") {
        const endpoint = mode === "top-ordered" ? "/api/products/top-ordered" : "/api/products/top-rated";

        const resRaw = await api.get<any>(endpoint, { query: { limit: 100, minCount: 2, onlyActive: 1 } });
        const body = unwrap<any>(resRaw);

        const list = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
        const activeOnly = list.filter((p: any) => isActive(p));
        setItems(activeOnly);
        setTotal(activeOnly.length);
        return;
      }

      const base =
        channel === "african-food"
          ? "/api/products/african-food"
          : channel === "african-market"
          ? "/api/products/african-market"
          : channel === "fashion"
          ? "/api/products/fashion"
          : "/api/products";

      const query: Record<string, any> = { page, pageSize };
      if (onlyActive) query.onlyActive = 1;
      if (filterCategoryId !== "") {
        query.category_id = filterCategoryId;
        query.categoryId = filterCategoryId;
      }
      if (filterShopId !== "") {
        query.shop_id = filterShopId;
        query.shopId = filterShopId;
      }

      const resRaw = await api.get<any>(base, { query });
      const { items: gotItems, pageInfo } = getPaginated(resRaw);

      setItems(gotItems);
      setTotal(Number(pageInfo?.total ?? gotItems.length ?? 0));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshCategories() {
    try {
      const res = await listCategories({ page: 1, pageSize: 500 });
      setCategories(res.items || []);
    } catch (e) {
      console.error("Erreur chargement catégories", e);
    }
  }

  async function refreshSubCategories() {
    try {
      const res = await listSubCategories({ page: 1, pageSize: 1000 } as any);
      setSubCategories((res as any).items || []);
    } catch (e) {
      try {
        const resRaw = await api.get<{ items: SubCategory[] }>("/api/sub-categories", { query: { page: 1, pageSize: 1000 } });
        const res = unwrap<{ items: SubCategory[] }>(resRaw);
        setSubCategories(res.items || []);
      } catch (e2) {
        console.error("Erreur chargement sous-catégories", e, e2);
      }
    }
  }

  async function refreshShops() {
    try {
      const resRaw = await api.get<{ items: Shop[] }>(`/api/shops`, { query: { page: 1, pageSize: 500 } });
      const res = unwrap<{ items: Shop[] }>(resRaw);
      setShops(res.items || []);
    } catch (e) {
      console.error("Erreur chargement boutiques", e);
    }
  }

  useEffect(() => {
    refreshCategories();
    refreshSubCategories();
    refreshShops();
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, channel, onlyActive, mode, filterShopId, filterCategoryId]);

  function openCreate() {
    setEdit(null);
    setShowForm(true);
    setOk(null);
    setError(null);
  }

  async function openEdit(id: number) {
    setBusy(true);
    setError(null);
    try {
      const p = await getProduct(id);
      setEdit({ ...(p as any) } as FullProduct);
      setShowForm(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(id: number) {
    setBusy(true);
    setError(null);
    try {
      const p = await getProduct(id);
      setPreview({ ...(p as any) } as FullProduct);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEdit(null);
  }

  async function onCreateCategory(name: string) {
    const created = await createCategory(name);
    await refreshCategories();
    return created as any;
  }

  async function onCreateSubCategory(categoryId: number, name: string) {
    const created = await createSubCategory({ category_id: categoryId, name });
    await refreshSubCategories();
    return created as any;
  }

  async function onSave(draft: Draft, files: File[], replaceImages: boolean, variants: VariantDraft[]) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const payload: any = { ...draft };

      const style = String(payload.style || "").toLowerCase();
      delete payload.style;
      if (style === "food") payload.vertical = "FOOD";
      else if (style === "market") payload.vertical = "MARKET";
      else if (style === "fashion") payload.vertical = "FASHION";

      if (!payload.promo_eligible) {
        delete payload.promo_discount_type;
        delete payload.promo_discount_value;
      }

      Object.keys(payload).forEach((k) => {
        if (payload[k] === null || payload[k] === undefined) delete payload[k];
      });

      if (edit == null) {
        if (!draft.category_id) throw new Error("category_id requis.");
        if (!draft.sub_category_id) throw new Error("sub_category_id requis.");
        if (payload.is_active == null) payload.is_active = 1;

        const cleaned = style === "fashion" ? cleanVariantsForApi(variants) : [];
        if (cleaned.length) payload.variants = cleaned;

        await createProduct(payload, files);
        setOk("Produit créé avec succès.");
      } else {
        await updateProduct(edit.id, payload, files, replaceImages);

        if (style === "fashion") {
          const cleaned = cleanVariantsForApi(variants);
          await upsertProductVariants(edit.id, { variants: cleaned as any }, { replace: true });
        }

        setOk("Produit mis à jour.");
      }

      setShowForm(false);
      setEdit(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Supprimer ce produit ?")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await removeProduct(id);
      setOk("Produit supprimé.");
      const after = items.length - 1;
      if (after === 0 && page > 1) setPage((p) => p - 1);
      else await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(p: Product) {
    const current = isActive(p);
    const next = current ? 0 : 1;

    if (
      !confirm(
        next
          ? "Activer ce produit ? Il sera de nouveau visible sur Duumini."
          : "Désactiver ce produit ? Il ne sera plus visible sur Duumini (promo incluse)."
      )
    )
      return;

    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await updateProduct((p as any).id, { is_active: next } as any, [], false);
      setOk(next ? "Produit activé." : "Produit désactivé.");

      setItems((prev) => prev.map((it) => ((it as any).id === (p as any).id ? ({ ...it, is_active: next } as any) : it)));
      setPreview((prev) => (prev && prev.id === (p as any).id ? ({ ...prev, is_active: next } as any) : prev));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const shopId = filterShopId === "" ? null : Number(filterShopId);
    const catId = filterCategoryId === "" ? null : Number(filterCategoryId);

    return (items || []).filter((p: any) => {
      if (onlyActive && !isActive(p)) return false;

      if (shopId != null) {
        const pid = Number(p.shop_id ?? p.shopId ?? 0);
        if (pid !== shopId) return false;
      }

      if (catId != null) {
        const cid = Number(p.category_id ?? 0);
        if (cid !== catId) return false;
      }

      if (!text) return true;
      return (
        String(p.name || "").toLowerCase().includes(text) ||
        String(p.id || "").includes(text) ||
        String(p.shop_name || "").toLowerCase().includes(text)
      );
    });
  }, [items, q, filterShopId, filterCategoryId, onlyActive]);

  function resetSearch() {
    setQ("");
    setPage(1);
  }
  function changeMode(newMode: Mode) {
    setMode(newMode);
    setPage(1);
  }
  function changeChannel(newChannel: Channel) {
    setChannel(newChannel);
    setMode("default");
    setPage(1);
  }
  function toggleOnlyActive() {
    setOnlyActive((prev) => !prev);
    setMode("default");
    setPage(1);
  }
  function clearFilters() {
    setFilterShopId("");
    setFilterCategoryId("");
    setQ("");
    setPage(1);
  }

  return (
    <div className="container-xxl py-4">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Produits</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={refresh} disabled={loading || busy}>
            Actualiser
          </button>
          <button className="btn btn-dark" onClick={openCreate} disabled={busy}>
            + Nouveau produit
          </button>
        </div>
      </div>

      {ok && <div className="alert alert-success py-2">{ok}</div>}
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <div className="btn-group">
                <button className={`btn ${channel === "all" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeChannel("all")} disabled={busy}>
                  Tous
                </button>
                <button className={`btn ${channel === "african-food" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeChannel("african-food")} disabled={busy}>
                  African Food
                </button>
                <button className={`btn ${channel === "african-market" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeChannel("african-market")} disabled={busy}>
                  African Market
                </button>
                <button className={`btn ${channel === "fashion" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeChannel("fashion")} disabled={busy}>
                  Fashion
                </button>
              </div>

              <div className="btn-group">
                <button className={`btn ${mode === "default" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeMode("default")} disabled={busy}>
                  Normal
                </button>
                <button className={`btn ${mode === "top-ordered" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeMode("top-ordered")} disabled={busy}>
                  Top commandés
                </button>
                <button className={`btn ${mode === "top-rated" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => changeMode("top-rated")} disabled={busy}>
                  Top notés
                </button>
              </div>

              <button className={`btn ${onlyActive ? "btn-dark" : "btn-outline-dark"}`} onClick={toggleOnlyActive} disabled={busy}>
                {onlyActive ? "Actifs ✅" : "Actifs seulement"}
              </button>
            </div>

            <div className="d-flex flex-wrap gap-2 align-items-center">
              <input
                className="form-control"
                style={{ width: 320, maxWidth: "100%" }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher (nom, id, boutique)…"
              />
              <button className="btn btn-outline-secondary" onClick={resetSearch} disabled={busy && !q}>
                Reset recherche
              </button>
              <button className="btn btn-outline-danger" onClick={clearFilters} disabled={busy}>
                Effacer filtres
              </button>
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-12 col-md-6">
              <label className="form-label small text-muted mb-1">Filtrer par boutique</label>
              <select
                className="form-select"
                value={filterShopId === "" ? "" : String(filterShopId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilterShopId(v ? Number(v) : "");
                  setPage(1);
                }}
                disabled={busy}
              >
                <option value="">Toutes</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small text-muted mb-1">Filtrer par catégorie</label>
              <select
                className="form-select"
                value={filterCategoryId === "" ? "" : String(filterCategoryId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilterCategoryId(v ? Number(v) : "");
                  setPage(1);
                }}
                disabled={busy}
              >
                <option value="">Toutes</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="small text-muted mt-2">
            Résultats: <strong>{filtered.length}</strong>
            {mode === "default" ? (
              <>
                {" "}
                / total: <strong>{total}</strong>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Produit</th>
                <th style={{ width: 160 }}>Boutique</th>
                <th style={{ width: 160 }}>Prix</th>
                <th style={{ width: 120 }}>Statut</th>
                <th style={{ width: 220 }} className="text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Aucun produit.
                  </td>
                </tr>
              ) : (
                filtered.map((p: any) => {
                  const base = basePriceForAdmin(p);
                  const promoP = promoPriceForAdmin(p);
                  const hasVar = !!p?.has_variants || Number(p?.variants_count || 0) > 0;

                  return (
                    <tr key={p.id}>
                      <td className="text-muted">{p.id}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {p.cover || p.image_url ? (
                            <img
                              src={imgUrl(p.cover || p.image_url)}
                              alt={p.name}
                              className="rounded border"
                              style={{ width: 46, height: 46, objectFit: "cover" }}
                            />
                          ) : (
                            <div className="rounded border bg-light" style={{ width: 46, height: 46 }} />
                          )}

                          <div>
                            <div className="fw-semibold">{p.name}</div>
                            <div className="small text-muted">
                              Cat: {p.category_id ?? "—"} • Sub: {p.sub_category_name ?? p.sub_category_id ?? "—"}
                              {hasRealPromo(p) ? <span className="ms-2 badge bg-danger-subtle text-danger border">Promo {promoLabel(p)}</span> : null}
                              {hasVar ? <span className="ms-2 badge bg-light text-dark border">Variants</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="text-muted">{p.shop_name || p.shop_id || "—"}</td>

                      <td>
                        <div className="fw-semibold">
                          {moneyMAD(base)}
                          {hasVar ? <span className="ms-1 small text-muted">(min)</span> : null}
                        </div>
                        {promoP != null ? (
                          <div className="small text-muted">
                            Promo : <b>{moneyMAD(promoP)}</b>
                          </div>
                        ) : null}
                      </td>

                      <td>{isActive(p) ? <span className="badge bg-success">Actif</span> : <span className="badge bg-secondary">Off</span>}</td>

                      <td className="text-end">
                        <div className="d-inline-flex gap-2">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => openPreview(p.id)} disabled={busy}>
                            Aperçu
                          </button>
                          <button className="btn btn-sm btn-outline-dark" onClick={() => openEdit(p.id)} disabled={busy}>
                            Modifier
                          </button>
                          <button className="btn btn-sm btn-outline-warning" onClick={() => onToggleActive(p)} disabled={busy}>
                            {isActive(p) ? "Désactiver" : "Activer"}
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(p.id)} disabled={busy}>
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {mode === "default" && pages > 1 ? (
          <div className="card-body p-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="small text-muted">
              Page <strong>{page}</strong> / <strong>{pages}</strong>
            </div>

            <div className="btn-group">
              <button className="btn btn-outline-dark" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={busy || page <= 1}>
                ← Précédent
              </button>
              <button className="btn btn-outline-dark" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={busy || page >= pages}>
                Suivant →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showForm && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,.2)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit == null ? "Nouveau produit" : "Modifier produit"}</h5>
                <button type="button" className="btn-close" onClick={closeForm} disabled={busy} />
              </div>
              <div className="modal-body">
                <ProductForm
                  initial={(edit as any) || undefined}
                  categories={categories}
                  subCategories={subCategories}
                  shops={shops}
                  onCreateCategory={onCreateCategory}
                  onCreateSubCategory={onCreateSubCategory}
                  onSubmit={onSave}
                  onCancel={closeForm}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,.4)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Aperçu — {preview.name}</h5>
                <button type="button" className="btn-close" onClick={() => setPreview(null)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    {preview.images?.length ? (
                      <img
                        src={imgUrl(preview.images[0].url)}
                        alt={preview.name}
                        className="img-fluid rounded border"
                        style={{ width: "100%", height: "auto", objectFit: "cover" }}
                      />
                    ) : (preview as any).cover ? (
                      <img
                        src={imgUrl((preview as any).cover)}
                        alt={preview.name}
                        className="img-fluid rounded border"
                        style={{ width: "100%", height: "auto", objectFit: "cover" }}
                      />
                    ) : (
                      <div className="border rounded p-3 text-muted">Pas d'image.</div>
                    )}

                    {preview.images && preview.images.length > 1 ? (
                      <div className="row g-2 mt-2">
                        {preview.images.slice(1, 7).map((im) => (
                          <div className="col-4" key={im.id}>
                            <img src={imgUrl(im.url)} alt="mini" className="w-100 rounded border" style={{ aspectRatio: "1 / 1", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-12 col-md-6">
                    {(() => {
                      const anyP: any = preview as any;
                      const base = basePriceForAdmin(anyP);
                      const promoP = promoPriceForAdmin(anyP);
                      const hasVar = !!anyP?.has_variants || Number(anyP?.variants_count || 0) > 0;

                      return (
                        <>
                          <ul className="list-unstyled mb-2">
                            <li>
                              <strong>ID :</strong> {preview.id}
                            </li>
                            <li>
                              <strong>Boutique :</strong> {preview.shop_name || (preview as any).shop_id}
                            </li>

                            <li>
                              <strong>Prix :</strong> {moneyMAD(base)} {hasVar ? <span className="small text-muted">(min)</span> : null}
                              {promoP != null ? (
                                <div className="small text-muted">
                                  Promo : <b>{moneyMAD(promoP)}</b> <span className="ms-2">({promoLabel(anyP)})</span>
                                </div>
                              ) : null}
                            </li>

                            <li>
                              <strong>Promo :</strong>{" "}
                              {hasRealPromo(anyP) ? (
                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Oui</span>
                              ) : (
                                "Non"
                              )}
                            </li>

                            <li>
                              <strong>Catégorie :</strong> {(preview as any).category_id ?? "—"}
                            </li>

                            <li>
                              <strong>Sous-catégorie :</strong>{" "}
                              {(preview as any).sub_category_name ? (preview as any).sub_category_name : (preview as any).sub_category_id ?? "—"}
                            </li>

                            <li>
                              <strong>Statut :</strong> {isActive(anyP) ? "Actif" : "Désactivé"}
                            </li>
                          </ul>

                          <div className="small text-muted">{(preview as any).description || "—"}</div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPreview(null)}>
                  Fermer
                </button>
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={() => {
                    const id = preview.id;
                    setPreview(null);
                    openEdit(id);
                  }}
                >
                  Modifier ce produit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
