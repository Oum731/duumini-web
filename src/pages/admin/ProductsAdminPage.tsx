// src/pages/admin/ProductsAdminPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  listProducts,
  getProduct,
  type Product,
  createProduct,
  updateProduct,
  removeProduct,
} from "../../services/products";
import {
  listCategories,
  type Category,
  createCategory,
} from "../../services/categories";
import { API_BASE, api } from "../../services/http";

type ProductImage = { id: number; url: string; sort_order: number };
type FullProduct = Product & { images?: ProductImage[] };

type Shop = {
  id: number;
  name: string;
  logo?: string | null;
  cover?: string | null;
};

type PromoDiscountType = "PERCENT" | "AMOUNT";

type Draft = Partial<Product> & {
  category_name?: string;

  // ✅ champs promo
  promo_discount_type?: PromoDiscountType;
  promo_discount_value?: number;

  // ✅ villes
  cities?: string[];
};

const CITY_OPTIONS = ["Casablanca", "Marrakech"];

type ListResponse = {
  items: Product[];
  pageInfo: { total: number; page: number; pageSize: number };
};

type Mode = "default" | "top-ordered" | "top-rated";
type Channel = "all" | "african-food" | "african-market";

function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(Number(n || 0));
}

function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function toggleInArray(list: string[], value: string) {
  const low = value.toLowerCase();
  const idx = list.findIndex((x) => String(x).toLowerCase() === low);
  if (idx >= 0) {
    const copy = [...list];
    copy.splice(idx, 1);
    return copy;
  }
  return [...list, value];
}

function computePromoPrice(price: number, type: PromoDiscountType, value: number) {
  const p = Number(price || 0);
  const v = Number(value || 0);
  if (!p || !v) return p;

  if (type === "PERCENT") {
    const pct = Math.max(0, Math.min(100, v));
    const res = p - (p * pct) / 100;
    return Math.max(0, Number(res.toFixed(2)));
  }

  // AMOUNT
  const res = p - v;
  return Math.max(0, Number(res.toFixed(2)));
}

// ✅ règle unique d'affichage promo (badge + preview)
function hasRealPromo(p: any) {
  return !!p?.promo_eligible && Number(p?.promo_discount_value ?? 0) > 0;
}

/* ========= Formulaire Produit ========= */
function ProductForm({
  initial,
  categories,
  shops,
  onSubmit,
  onCancel,
}: {
  initial?: Draft & { images?: ProductImage[] };
  categories: Category[];
  shops: Shop[];
  onSubmit: (draft: Draft, files: File[], replaceImages: boolean) => Promise<void> | void;
  onCancel: () => void;
}) {
  const isInitialCustomSubCategory =
    !!initial?.sub_category &&
    initial.sub_category !== "product" &&
    initial.sub_category !== "food";

  const [draft, setDraft] = useState<Draft>(() => {
    const anyInit: any = initial || {};
    return {
      name: anyInit?.name || "",
      price: anyInit?.price ?? undefined,
      description: anyInit?.description || "",
      stock: anyInit?.stock ?? undefined,
      currency: anyInit?.currency || "MAD",
      sub_category: anyInit?.sub_category || "product",
      is_featured: anyInit?.is_featured ?? 0,
      promo_eligible: anyInit?.promo_eligible ?? 0,
      category_id: anyInit?.category_id ?? undefined,
      shop_id: anyInit?.shop_id ?? undefined,
      category_name: anyInit?.category_name,

      // ✅ villes
      cities: Array.isArray(anyInit?.cities) ? anyInit.cities : [],

      // ✅ promo
      promo_discount_type: anyInit?.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT",
      promo_discount_value:
        typeof anyInit?.promo_discount_value === "number" ? anyInit.promo_discount_value : undefined,
    };
  });

  const [files, setFiles] = useState<File[]>([]);
  const [replaceImages, setReplaceImages] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState(draft.category_name || "");

  const [isCustomSubCategory, setIsCustomSubCategory] = useState(isInitialCustomSubCategory);

  const [galleryInput, setGalleryInput] = useState<HTMLInputElement | null>(null);
  const [cameraInput, setCameraInput] = useState<HTMLInputElement | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

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

  const hasExistingImages = (initial?.images?.length ?? 0) > 0;
  const predefinedSubCategoryValue = isCustomSubCategory ? "__other__" : draft.sub_category || "product";

  const selectedShop = shops.find((s) => s.id === draft.shop_id);
  const selectedCities = Array.isArray(draft.cities) ? (draft.cities as string[]) : [];

  const promoEnabled = !!draft.promo_eligible;
  const promoType: PromoDiscountType = draft.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";

  const promoValueNum = Number(draft.promo_discount_value ?? 0);
  const priceNum = Number(draft.price ?? 0);

  const promoPricePreview = useMemo(() => {
    if (!promoEnabled) return null;
    if (!priceNum || !promoValueNum) return null;
    return computePromoPrice(priceNum, promoType, promoValueNum);
  }, [promoEnabled, promoType, promoValueNum, priceNum]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const promoErr = validatePromo();
    if (promoErr) {
      setFormError(promoErr);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(draft, files, replaceImages);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="row g-2">
        <div className="col-12 col-md-8">
          <div className="row g-2">
            <div className="col-8">
              <label className="form-label">Nom</label>
              <input
                className="form-control"
                value={draft.name || ""}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                required
              />
            </div>
            <div className="col-4">
              <label className="form-label">Canal</label>
              <select
                className="form-select"
                value={predefinedSubCategoryValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__other__") {
                    setIsCustomSubCategory(true);
                    setDraft((d) => ({
                      ...d,
                      sub_category:
                        d.sub_category && d.sub_category !== "product" && d.sub_category !== "food"
                          ? d.sub_category
                          : "",
                    }));
                  } else {
                    setIsCustomSubCategory(false);
                    setDraft((d) => ({ ...d, sub_category: val || "product" }));
                  }
                }}
              >
                <option value="product">Market (African Market)</option>
                <option value="food">Food (African Food)</option>
                <option value="__other__">Autre…</option>
              </select>

              {isCustomSubCategory && (
                <input
                  className="form-control mt-1"
                  placeholder="Ex: Service, Courses…"
                  value={draft.sub_category || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, sub_category: e.target.value || undefined }))}
                />
              )}
            </div>
          </div>

          {/* ✅ Villes */}
          <div className="row g-2 mt-1">
            <div className="col-12">
              <label className="form-label">Villes disponibles</label>
              <div className="d-flex flex-wrap gap-3">
                {CITY_OPTIONS.map((c) => {
                  const checked = selectedCities.some((x) => String(x).toLowerCase() === c.toLowerCase());
                  return (
                    <div className="form-check" key={c}>
                      <input
                        id={`city_${c}`}
                        className="form-check-input"
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft((d) => {
                            const current = Array.isArray(d.cities) ? (d.cities as string[]) : [];
                            return { ...d, cities: toggleInArray(current, c) };
                          })
                        }
                      />
                      <label htmlFor={`city_${c}`} className="form-check-label">
                        {c}
                      </label>
                    </div>
                  );
                })}
              </div>
              <small className="text-muted">
                Si aucune ville n’est cochée, le produit sera considéré “visible partout”.
              </small>
            </div>
          </div>

          {/* Boutique */}
          <div className="row g-2 mt-1">
            <div className="col-12">
              <label className="form-label">Boutique</label>
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select"
                  value={draft.shop_id != null ? String(draft.shop_id) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({ ...d, shop_id: v ? Number(v) : undefined }));
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

          {/* Market categories */}
          {draft.sub_category === "product" && (
            <div className="row g-2 mt-1">
              <div className="col-6">
                <label className="form-label">Sous-catégorie (Market)</label>
                <select
                  className="form-select"
                  value={isCustomCategory ? "__other__" : draft.category_id ? String(draft.category_id) : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__other__") {
                      setIsCustomCategory(true);
                      setDraft((d) => ({ ...d, category_id: undefined }));
                    } else {
                      setIsCustomCategory(false);
                      setNewCategoryName("");
                      setDraft((d) => ({
                        ...d,
                        category_id: val ? Number(val) : undefined,
                        category_name: undefined,
                      }));
                    }
                  }}
                >
                  <option value="">(Aucune)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__other__">Autre…</option>
                </select>
              </div>

              {isCustomCategory && (
                <div className="col-6">
                  <label className="form-label">Nouvelle catégorie</label>
                  <input
                    className="form-control"
                    placeholder="Ex: Viandes & Volailles…"
                    value={newCategoryName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewCategoryName(v);
                      setDraft((d) => ({ ...d, category_name: v }));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="row g-2 mt-1">
            <div className="col-4">
              <label className="form-label">Prix</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={draft.price ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, price: e.target.value === "" ? undefined : Number(e.target.value) }))
                }
                required
              />
            </div>
            <div className="col-4">
              <label className="form-label">Devise</label>
              <input
                className="form-control"
                value={draft.currency || "MAD"}
                onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
              />
            </div>
            <div className="col-4">
              <label className="form-label">Stock</label>
              <input
                type="number"
                className="form-control"
                value={draft.stock ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, stock: e.target.value === "" ? undefined : Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div className="row g-2 mt-1">
            <div className="col-6">
              <div className="form-check mt-4">
                <input
                  id="feat"
                  className="form-check-input"
                  type="checkbox"
                  checked={!!draft.is_featured}
                  onChange={(e) => setDraft((d) => ({ ...d, is_featured: e.target.checked ? 1 : 0 }))}
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDraft((d) => ({
                      ...d,
                      promo_eligible: checked ? 1 : 0,
                      ...(checked ? {} : { promo_discount_value: undefined, promo_discount_type: "PERCENT" }),
                    }));
                  }}
                />
                <label htmlFor="promo" className="form-check-label">
                  Éligible promo
                </label>
              </div>
            </div>
          </div>

          {/* ✅ Bloc réduction */}
          {promoEnabled && (
            <div className="card border-0 bg-light mt-2">
              <div className="card-body p-3">
                <div className="fw-semibold mb-2">Réduction</div>

                <div className="row g-2 align-items-end">
                  <div className="col-6 col-md-4">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={promoType}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, promo_discount_type: (e.target.value as PromoDiscountType) || "PERCENT" }))
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
                      className="form-control"
                      value={draft.promo_discount_value ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          promo_discount_value: e.target.value === "" ? undefined : Number(e.target.value),
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
              className="form-control"
              rows={3}
              value={draft.description || ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
        </div>

        {/* Images */}
        <div className="col-12 col-md-4">
          <label className="form-label d-flex align-items-center justify-content-between">
            Images <small className="text-muted">Galerie / Caméra</small>
          </label>

          {hasExistingImages && !files.length && !replaceImages ? (
            <div className="mb-2">
              <div className="small text-muted mb-1">Images existantes :</div>
              <div className="row g-2">
                {initial!.images!.map((img) => (
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
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFiles([])} disabled={!files.length}>
              Vider
            </button>
          </div>

          <input ref={(el) => setGalleryInput(el)} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <input ref={(el) => setCameraInput(el)} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />

          <div className="form-check mb-2">
            <input
              id="replace_images"
              className="form-check-input"
              type="checkbox"
              checked={replaceImages}
              onChange={(e) => setReplaceImages(e.target.checked)}
            />
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
  const [shops, setShops] = useState<Shop[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<FullProduct | null>(null);
  const [preview, setPreview] = useState<FullProduct | null>(null);

  const [mode, setMode] = useState<Mode>("default");
  const [channel, setChannel] = useState<Channel>("all");
  const [onlyActive, setOnlyActive] = useState<boolean>(false);

  const pages = useMemo(
    () => (mode === "default" ? Math.max(1, Math.ceil(total / pageSize)) : 1),
    [total, pageSize, mode]
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "top-ordered" || mode === "top-rated") {
        const endpoint = mode === "top-ordered" ? "/api/products/top-ordered" : "/api/products/top-rated";
        const res = await api.get<Product[]>(endpoint, { query: { limit: 100, minCount: 2 } });
        setItems(res || []);
        setTotal(Array.isArray(res) ? res.length : 0);
        setLoading(false);
        return;
      }

      const query: any = { page, pageSize };
      if (onlyActive) query.onlyActive = 1;

      let res: ListResponse;

      if (channel === "all") {
        const r = await listProducts(query);
        res = r as ListResponse;
      } else {
        const path = channel === "african-food" ? "/api/products/african-food" : "/api/products/african-market";
        const r = await api.get<ListResponse>(path, { query });
        res = r;
      }

      setItems(res.items);
      setTotal(res.pageInfo.total);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshCategories() {
    try {
      const res = await listCategories({ page: 1, pageSize: 100 });
      setCategories(res.items);
    } catch (e) {
      console.error("Erreur chargement catégories", e);
    }
  }

  async function refreshShops() {
    try {
      const res = await api.get<{ items: Shop[] }>(`/api/shops`, { query: { page: 1, pageSize: 200 } });
      setShops(res.items || []);
    } catch (e) {
      console.error("Erreur chargement boutiques", e);
    }
  }

  useEffect(() => {
    refreshCategories();
    refreshShops();
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, channel, onlyActive, mode]);

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
      setEdit(p as FullProduct);
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
      setPreview(p as FullProduct);
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

  async function onSave(draft: Draft, files: File[], replaceImages: boolean) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      let categoryId = draft.category_id ?? null;
      if (!categoryId && draft.category_name) {
        const created = await createCategory(draft.category_name);
        categoryId = created.id;
        await refreshCategories();
      }

      const payload: any = { ...draft, category_id: categoryId ?? undefined };
      delete payload.category_name;

      if (edit == null && payload.is_active == null) payload.is_active = 1;
      if (payload.cities != null && !Array.isArray(payload.cities)) payload.cities = [];

      // ✅ si promo_eligible est 0 → purge champs promo
      if (!payload.promo_eligible) {
        delete payload.promo_discount_type;
        delete payload.promo_discount_value;
      }

      if (edit == null) {
        await createProduct(payload, files);
        setOk("Produit créé avec succès.");
      } else {
        await updateProduct(edit.id, payload, files, replaceImages);
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
    const current = ((p as any).active ?? (p as any).is_active ?? 1) ? 1 : 0;
    const next = current ? 0 : 1;

    if (
      !confirm(
        next ? "Activer ce produit ? Il sera de nouveau visible sur Duumini." : "Désactiver ce produit ? Il ne sera plus visible sur Duumini."
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await updateProduct(p.id, { is_active: next } as any, [], false);
      setOk(next ? "Produit activé." : "Produit désactivé.");

      setItems((prev) => prev.map((it) => (it.id === p.id ? ({ ...it, is_active: next } as any) : it)));
      setPreview((prev) => (prev && prev.id === p.id ? ({ ...prev, is_active: next } as any) : prev));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const filtered = items.filter((p) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (p.name || "").toLowerCase().includes(t) || String(p.id).includes(t) || (p.shop_name || "").toLowerCase().includes(t);
  });

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

      <div className="card mb-3">
        <div className="card-body d-flex flex-column flex-lg-row gap-3 align-items-lg-center justify-content-between">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <span className="text-muted small me-1">Canal :</span>
            <div className="btn-group btn-group-sm" role="group">
              <button type="button" className={"btn " + (channel === "all" && mode === "default" ? "btn-dark" : "btn-outline-dark")} onClick={() => changeChannel("all")}>
                Tous
              </button>
              <button
                type="button"
                className={"btn " + (channel === "african-food" && mode === "default" ? "btn-dark" : "btn-outline-dark")}
                onClick={() => changeChannel("african-food")}
              >
                African Food
              </button>
              <button
                type="button"
                className={"btn " + (channel === "african-market" && mode === "default" ? "btn-dark" : "btn-outline-dark")}
                onClick={() => changeChannel("african-market")}
              >
                African Market
              </button>
            </div>

            <div className="form-check ms-3">
              <input id="onlyActive" className="form-check-input" type="checkbox" checked={onlyActive} onChange={toggleOnlyActive} disabled={mode !== "default"} />
              <label htmlFor="onlyActive" className="form-check-label small">
                Actifs uniquement
              </label>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            <span className="text-muted small me-1">Vue rapide :</span>
            <div className="btn-group btn-group-sm" role="group">
              <button type="button" className={"btn " + (mode === "top-ordered" ? "btn-warning" : "btn-outline-warning")} onClick={() => changeMode(mode === "top-ordered" ? "default" : "top-ordered")}>
                Top commandés
              </button>
              <button type="button" className={"btn " + (mode === "top-rated" ? "btn-success" : "btn-outline-success")} onClick={() => changeMode(mode === "top-rated" ? "default" : "top-rated")}>
                Mieux notés
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-3 gap-2">
        <div className="input-group" style={{ maxWidth: 420 }}>
          <input
            className="form-control"
            placeholder="Recherche par nom, boutique ou ID…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <button className="btn btn-outline-secondary" onClick={resetSearch} disabled={!q}>
            Effacer
          </button>
        </div>

        {mode === "default" && (
          <div className="btn-group">
            <button className="btn btn-sm btn-outline-dark" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>
              ◀
            </button>
            <span className="btn btn-sm btn-outline-dark disabled">
              {page} / {pages}
            </span>
            <button className="btn btn-sm btn-outline-dark" disabled={page >= pages || busy} onClick={() => setPage((p) => p + 1)}>
              ▶
            </button>
          </div>
        )}
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">{mode === "top-ordered" ? "Aucun produit commandé." : mode === "top-rated" ? "Aucun produit noté." : "Aucun produit."}</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Produit</th>
                    <th className="d-none d-sm-table-cell">Boutique</th>
                    <th className="d-none d-md-table-cell">Canal</th>
                    <th className="d-none d-sm-table-cell">Stock</th>
                    <th className="d-none d-sm-table-cell">Statut</th>
                    <th className="text-end">Prix</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isActive = ((p as any).active ?? (p as any).is_active ?? 1) ? 1 : 0;
                    const sub = String((p as any).sub_category || "").toLowerCase();
                    const channelLabel = sub === "food" ? "African Food" : sub === "product" ? "African Market" : sub || "-";

                    // ✅ FIX : promo réelle
                    const promo = hasRealPromo(p as any);

                    return (
                      <tr key={p.id}>
                        <td>{p.id}</td>

                        <td className="text-truncate" style={{ maxWidth: 380 }}>
                          <div className="d-flex align-items-center gap-2">
                            {(p as any).cover ? (
                              <img
                                src={imgUrl((p as any).cover)}
                                alt={p.name}
                                className="rounded border"
                                style={{ width: 42, height: 42, objectFit: "cover" }}
                              />
                            ) : (
                              <div className="rounded border bg-light" style={{ width: 42, height: 42 }} />
                            )}

                            <div className="d-flex flex-column">
                              <div className="d-flex align-items-center gap-2">
                                <span className="text-truncate" title={p.name}>
                                  {p.name}
                                </span>

                                {promo && (
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                    Promo
                                  </span>
                                )}

                                <button className="btn btn-link btn-sm p-0 align-baseline" title="Voir" onClick={() => openPreview(p.id)}>
                                  (voir)
                                </button>
                              </div>

                              {p.shop_name && <small className="text-muted">{p.shop_name}</small>}
                            </div>
                          </div>
                        </td>

                        <td className="d-none d-sm-table-cell">{p.shop_name || (p as any).shop_id || "-"}</td>

                        <td className="d-none d-md-table-cell">
                          <span className="badge bg-light text-dark">{channelLabel}</span>
                        </td>

                        <td className="d-none d-sm-table-cell">{(p as any).stock ?? 0}</td>

                        <td className="d-none d-sm-table-cell">
                          {isActive ? <span className="badge bg-success-subtle text-success">Actif</span> : <span className="badge bg-secondary-subtle text-muted">Désactivé</span>}
                        </td>

                        <td className="text-end">{moneyMAD(p.price)}</td>

                        <td className="text-end">
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline-dark" onClick={() => openEdit(p.id)} disabled={busy}>
                              Modifier
                            </button>
                            <button className={`btn btn-sm ${isActive ? "btn-outline-warning" : "btn-outline-success"}`} onClick={() => onToggleActive(p)} disabled={busy}>
                              {isActive ? "Désactiver" : "Activer"}
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(p.id)} disabled={busy}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && mode === "default" ? (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <div className="text-muted small">{total} éléments</div>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-dark" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>
                  Préc.
                </button>
                <span className="btn btn-sm btn-outline-dark disabled">
                  {page} / {pages}
                </span>
                <button className="btn btn-sm btn-outline-dark" disabled={page >= pages || busy} onClick={() => setPage((p) => p + 1)}>
                  Suiv.
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,.2)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit == null ? "Nouveau produit" : "Modifier produit"}</h5>
                <button className="btn-close" onClick={closeForm} disabled={busy} />
              </div>
              <div className="modal-body">
                <ProductForm initial={(edit as any) || undefined} categories={categories} shops={shops} onSubmit={onSave} onCancel={closeForm} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {preview && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,.4)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Aperçu — {preview.name}</h5>
                <button className="btn-close" onClick={() => setPreview(null)} />
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
                    <ul className="list-unstyled mb-2">
                      <li>
                        <strong>ID :</strong> {preview.id}
                      </li>
                      <li>
                        <strong>Boutique :</strong> {preview.shop_name || (preview as any).shop_id}
                      </li>
                      <li>
                        <strong>Prix :</strong> {moneyMAD(preview.price)}
                      </li>

                      <li>
                        <strong>Promo :</strong>{" "}
                        {hasRealPromo(preview as any) ? (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Oui</span>
                        ) : (
                          "Non"
                        )}
                      </li>

                      {hasRealPromo(preview as any) ? (
                        <>
                          <li>
                            <strong>Type réduction :</strong> {(preview as any).promo_discount_type || "—"}
                          </li>
                          <li>
                            <strong>Valeur réduction :</strong> {(preview as any).promo_discount_value ?? "—"}
                          </li>
                        </>
                      ) : null}

                      <li>
                        <strong>Stock :</strong> {(preview as any).stock ?? 0}
                      </li>
                      <li>
                        <strong>Canal :</strong> {(preview as any).sub_category || "-"}
                      </li>
                      <li>
                        <strong>Villes :</strong>{" "}
                        {Array.isArray((preview as any).cities) && (preview as any).cities.length ? (preview as any).cities.join(", ") : "—"}
                      </li>
                      <li>
                        <strong>Statut :</strong> {((preview as any).active ?? (preview as any).is_active ?? 1) ? "Actif" : "Désactivé"}
                      </li>
                    </ul>

                    <div className="small text-muted">{preview.description || "—"}</div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setPreview(null)}>
                  Fermer
                </button>
                <button
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
