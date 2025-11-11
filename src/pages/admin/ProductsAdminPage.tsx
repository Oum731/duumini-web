// src/pages/admin/ProductsAdminPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  listProducts,
  getProduct,
  type Product,
  createProduct,
  updateProduct,
  removeProduct,
} from "../../services/products";
import { listCategories, type Category, createCategory } from "../../services/categories";
import { API_BASE } from "../../services/http";

/* ===== Helpers ===== */
function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(
    Number(n || 0)
  );
}
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

type ProductImage = { id: number; url: string; sort_order: number };
type FullProduct = Product & { images?: ProductImage[] };

type Draft = Partial<Product> & {
  description?: string | null;
  stock?: number | null;
  currency?: string;
  sub_category?: "product" | "food";
  category_name?: string;
};

/* ========= Formulaire Produit ========= */
function ProductForm({
  initial,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: Draft & { images?: ProductImage[] };
  categories: Category[];
  onSubmit: (draft: Draft, files: File[], replaceImages: boolean) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    name: initial?.name || "",
    price: initial?.price || 0,
    description: initial?.description || "",
    stock: initial?.stock ?? 0,
    currency: initial?.currency || "MAD",
    sub_category: initial?.sub_category || "product",
    is_featured: initial?.is_featured ?? 0,
    promo_eligible: initial?.promo_eligible ?? 0,
    category_id: initial?.category_id ?? undefined,
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [replaceImages, setReplaceImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    for (const f of Array.from(list)) if (next.length < 8) next.push(f);
    setFiles(next.slice(0, 8));
  }
  const onPickGallery = () => fileInputRef.current?.click();
  const onOpenCamera = () => cameraInputRef.current?.click();
  const clearFiles = () => setFiles([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
            value={draft.sub_category || "product"}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                sub_category: e.target.value as Draft["sub_category"],
              }))
            }
          >
            <option value="product">Market (African Market)</option>
            <option value="food">Food (African Food)</option>
          </select>
        </div>
      </div>

      {draft.sub_category === "product" && (
        <div className="row g-2 mt-1">
          <div className="col-6">
            <label className="form-label">Sous-catégorie (Market)</label>
            <select
              className="form-select"
              value={
                isCustomCategory
                  ? "__other__"
                  : draft.category_id
                  ? String(draft.category_id)
                  : ""
              }
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
                placeholder="Ex: Huiles, Boissons…"
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

      <div className="row g-2 mt-2">
        <div className="col-4">
          <label className="form-label">Prix</label>
          <input
            type="number"
            step="0.01"
            className="form-control"
            value={Number(draft.price || 0)}
            onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
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
            value={Number(draft.stock || 0)}
            onChange={(e) => setDraft((d) => ({ ...d, stock: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="mt-2">
        <label className="form-label">Description</label>
        <textarea
          className="form-control"
          rows={3}
          value={draft.description || ""}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
      </div>

      <div className="mt-3 d-flex justify-content-between">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn btn-dark" disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/* ========= Page Admin ========= */
export default function ProductsAdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<FullProduct | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await listProducts({ page: 1, pageSize: 20 });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCategories() {
    try {
      const res = await listCategories({ page: 1, pageSize: 100 });
      setCategories(res.items);
    } catch {}
  }

  useEffect(() => {
    refresh();
    refreshCategories();
  }, []);

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

      const payload: Partial<Product> = {
        ...draft,
        category_id: categoryId ?? undefined,
      };
      delete (payload as any).category_name;

      if (edit == null) await createProduct(payload, files);
      else await updateProduct(edit.id, payload, files, replaceImages);

      setOk("Produit enregistré avec succès.");
      setShowForm(false);
      setEdit(null);
      await refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-xxl py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4">Produits</h1>
        <button className="btn btn-dark" onClick={() => setShowForm(true)}>
          + Nouveau produit
        </button>
      </div>

      {ok && <div className="alert alert-success">{ok}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div>Chargement…</div>
      ) : (
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Prix</th>
              <th>Sous-cat</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{moneyMAD(p.price)}</td>
                <td>{p.sub_category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.3)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {edit ? "Modifier le produit" : "Nouveau produit"}
                </h5>
                <button className="btn-close" onClick={() => setShowForm(false)} />
              </div>
              <div className="modal-body">
                <ProductForm
                  initial={edit || undefined}
                  categories={categories}
                  onSubmit={onSave}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
