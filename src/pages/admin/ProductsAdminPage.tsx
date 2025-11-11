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

type ProductImage = { id: number; url: string; sort_order: number };

// On étend Product pour pouvoir garder les images lors du preview/édition
type FullProduct = Product & { images?: ProductImage[] };

type Draft = Partial<Product> & {
  description?: string | null;
  stock?: number | null;
  currency?: string;
  sub_category?: "product" | "food"; // plus de "other" ici
  category_name?: string;            // pour "Autre…" (nouvelle catégorie)
};

function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(
    Number(n || 0)
  );
}

// Construit l’URL absolue pour les images relatives (ex: /uploads/..)
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

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
  const [replaceImages, setReplaceImages] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState(draft.category_name || "");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const current = [...files];
    for (const f of Array.from(list)) {
      if (current.length >= 8) break;
      current.push(f);
    }
    setFiles(current.slice(0, 8));
  }
  function onPickFromGallery() {
    fileInputRef.current?.click();
  }
  function onOpenCamera() {
    cameraInputRef.current?.click();
  }
  function removeAt(i: number) {
    const arr = [...files];
    arr.splice(i, 1);
    setFiles(arr);
  }
  function clearFiles() {
    setFiles([]);
  }
  function previewURL(f: File) {
    return URL.createObjectURL(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(draft, files, replaceImages);
    } finally {
      setSubmitting(false);
    }
  }

  const hasExistingImages = (initial?.images?.length ?? 0) > 0;

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

          {/* Sous-catégories Market (categories) */}
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
                value={Number(draft.price || 0)}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, price: Number(e.target.value) }))
                }
                required
              />
            </div>
            <div className="col-4">
              <label className="form-label">Devise</label>
              <input
                className="form-control"
                value={draft.currency || "MAD"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, currency: e.target.value }))
                }
              />
            </div>
            <div className="col-4">
              <label className="form-label">Stock</label>
              <input
                type="number"
                className="form-control"
                value={Number(draft.stock || 0)}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, stock: Number(e.target.value) }))
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
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      is_featured: e.target.checked ? 1 : 0,
                    }))
                  }
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
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      promo_eligible: e.target.checked ? 1 : 0,
                    }))
                  }
                />
                <label htmlFor="promo" className="form-check-label">
                  Éligible promo
                </label>
              </div>
            </div>
          </div>

          <div className="mt-2">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={draft.description || ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Colonne images */}
        <div className="col-12 col-md-4">
          <label className="form-label d-flex align-items-center justify-content-between">
            Images
            <small className="text-muted">Galerie / Caméra</small>
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
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={onPickFromGallery}
            >
              Depuis la galerie
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={onOpenCamera}
            >
              Ouvrir la caméra
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={clearFiles}
              disabled={!files.length}
            >
              Vider
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />

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
                    <img
                      src={previewURL(f)}
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
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
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

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<FullProduct | null>(null);
  const [preview, setPreview] = useState<FullProduct | null>(null);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listProducts({ page, pageSize });
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

  useEffect(() => {
    refreshCategories();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh();
  }, [page, pageSize]);

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
      const p = await getProduct(id); // récupère aussi images
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
      const p = await getProduct(id); // récupère aussi images
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
      // 1) Gérer la création éventuelle d'une nouvelle catégorie via "Autre…"
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

  const filtered = items.filter((p) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (p.name || "").toLowerCase().includes(t) || String(p.id).includes(t);
  });

  function resetSearch() {
    setQ("");
    setPage(1);
  }

  return (
    <div className="container-xxl py-4">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Produits</h1>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary"
            onClick={refresh}
            disabled={loading || busy}
          >
            Actualiser
          </button>
          <button className="btn btn-dark" onClick={openCreate} disabled={busy}>
            + Nouveau produit
          </button>
        </div>
      </div>

      {ok && <div className="alert alert-success py-2">{ok}</div>}
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="input-group" style={{ maxWidth: 420 }}>
          <input
            className="form-control"
            placeholder="Recherche par nom ou ID…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <button
            className="btn btn-outline-secondary"
            onClick={resetSearch}
            disabled={!q}
          >
            Effacer
          </button>
        </div>

        <div className="btn-group">
          <button
            className="btn btn-sm btn-outline-dark"
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => p - 1)}
          >
            ◀
          </button>
          <span className="btn btn-sm btn-outline-dark disabled">
            {page} / {pages}
          </span>
          <button
            className="btn btn-sm btn-outline-dark"
            disabled={page >= pages || busy}
            onClick={() => setPage((p) => p + 1)}
          >
            ▶
          </button>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucun produit.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Produit</th>
                    <th className="d-none d-sm-table-cell">Boutique</th>
                    <th className="d-none d-sm-table-cell">Stock</th>
                    <th className="text-end">Prix</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td className="text-truncate" style={{ maxWidth: 380 }}>
                        <div className="d-flex align-items-center gap-2">
                          {p.cover ? (
                            <img
                              src={imgUrl(p.cover)}
                              alt={p.name}
                              className="rounded border"
                              style={{
                                width: 42,
                                height: 42,
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              className="rounded border bg-light"
                              style={{ width: 42, height: 42 }}
                            />
                          )}
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="text-truncate"
                              title={p.name}
                            >
                              {p.name}
                            </span>
                            <button
                              className="btn btn-link btn-sm p-0 align-baseline"
                              title="Voir"
                              onClick={() => openPreview(p.id)}
                            >
                              (voir)
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="d-none d-sm-table-cell">{p.shop_id}</td>
                      <td className="d-none d-sm-table-cell">
                        {(p as any).stock ?? 0}
                      </td>
                      <td className="text-end">{moneyMAD(p.price)}</td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() => openEdit(p.id)}
                            disabled={busy}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDelete(p.id)}
                            disabled={busy}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 ? (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <div className="text-muted small">{total} éléments</div>
              <div className="btn-group">
                <button
                  className="btn btn-sm btn-outline-dark"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Préc.
                </button>
                <span className="btn btn-sm btn-outline-dark disabled">
                  {page} / {pages}
                </span>
                <button
                  className="btn btn-sm btn-outline-dark"
                  disabled={page >= pages || busy}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suiv.
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,.2)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {edit == null ? "Nouveau produit" : "Modifier produit"}
                </h5>
                <button
                  className="btn-close"
                  onClick={closeForm}
                  disabled={busy}
                />
              </div>
              <div className="modal-body">
                <ProductForm
                  initial={edit || undefined}
                  categories={categories}
                  onSubmit={onSave}
                  onCancel={closeForm}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {preview && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,.4)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Aperçu — {preview.name}</h5>
                <button
                  className="btn-close"
                  onClick={() => setPreview(null)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    {preview.images?.length ? (
                      <img
                        src={imgUrl(preview.images[0].url)}
                        alt={preview.name}
                        className="img-fluid rounded border"
                        style={{
                          width: "100%",
                          height: "auto",
                          objectFit: "cover",
                        }}
                      />
                    ) : preview.cover ? (
                      <img
                        src={imgUrl(preview.cover)}
                        alt={preview.name}
                        className="img-fluid rounded border"
                        style={{
                          width: "100%",
                          height: "auto",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div className="border rounded p-3 text-muted">
                        Pas d'image.
                      </div>
                    )}

                    {preview.images && preview.images.length > 1 ? (
                      <div className="row g-2 mt-2">
                        {preview.images.slice(1, 7).map((im) => (
                          <div className="col-4" key={im.id}>
                            <img
                              src={imgUrl(im.url)}
                              alt="mini"
                              className="w-100 rounded border"
                              style={{
                                aspectRatio: "1 / 1",
                                objectFit: "cover",
                              }}
                            />
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
                        <strong>Boutique :</strong> {preview.shop_id}
                      </li>
                      <li>
                        <strong>Prix :</strong> {moneyMAD(preview.price)}
                      </li>
                      <li>
                        <strong>Stock :</strong> {(preview as any).stock ?? 0}
                      </li>
                      <li>
                        <strong>Sous-cat :</strong> {preview.sub_category || "-"}
                      </li>
                    </ul>
                    <div className="small text-muted">
                      {preview.description || "—"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setPreview(null)}
                >
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
