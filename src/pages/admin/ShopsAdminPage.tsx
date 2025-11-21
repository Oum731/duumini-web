// src/pages/admin/ShopsAdminPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import {
  listShops,
  type Shop,
  createShop,
  updateShop,
  removeShop,
} from "../../services/shops";
import { API_BASE } from "../../services/http";

type Draft = Partial<Shop> & { description?: string | null };

type ShopFiles = {
  logo?: File | null;
  cover?: File | null;
};

// Helper pour construire l’URL du logo (Cloudinary ou relative API)
function shopLogoUrl(logo?: string | null) {
  if (!logo) return "";
  const u = String(logo);
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

/* ======= Formulaire boutique ======= */

function ShopForm({
  initial,
  onSubmit,
}: {
  initial?: Draft;
  onSubmit: (d: Draft, files: ShopFiles) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: initial?.name || "",
    description: (initial as any)?.description || "",
    category_id: initial?.category_id ?? null,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const existingLogoUrl = shopLogoUrl((initial as any)?.logo || null);
  const existingCoverUrl = shopLogoUrl((initial as any)?.cover || null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 🔹 On nettoie le nom et on bloque si vide (évite fallback "Boutique")
    const cleanName = (draft.name ?? "").toString().trim();
    if (!cleanName) {
      alert("Le nom du restaurant / boutique est obligatoire.");
      return;
    }

    const finalDraft: Draft = {
      ...draft,
      name: cleanName,
    };

    onSubmit(finalDraft, { logo: logoFile, cover: coverFile });
  }

  function onPickLogo() {
    logoInputRef.current?.click();
  }
  function onPickCover() {
    coverInputRef.current?.click();
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setLogoFile(f);
  }
  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setCoverFile(f);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-2">
        <label className="form-label">Nom du restaurant / boutique</label>
        <input
          className="form-control"
          value={draft.name || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value }))
          }
          required
        />
      </div>

      {/* Slug auto généré, en lecture seule si boutique existante */}
      {initial?.slug && (
        <div className="mb-2">
          <label className="form-label">Slug (auto)</label>
          <input
            className="form-control"
            value={initial.slug}
            disabled
            readOnly
          />
          <small className="text-muted">
            Généré automatiquement à partir du nom.
          </small>
        </div>
      )}

      {/* Logo */}
      <div className="mb-3">
        <label className="form-label d-flex justify-content-between align-items-center">
          Logo du restaurant
          <small className="text-muted">Carré recommandé</small>
        </label>

        <div className="d-flex align-items-center gap-3 mb-2">
          {/* Preview logo */}
          <div>
            {logoFile ? (
              <img
                src={URL.createObjectURL(logoFile)}
                alt="logo preview"
                className="rounded-circle border"
                style={{ width: 60, height: 60, objectFit: "cover" }}
              />
            ) : existingLogoUrl ? (
              <img
                src={existingLogoUrl}
                alt="logo actuel"
                className="rounded-circle border"
                style={{ width: 60, height: 60, objectFit: "cover" }}
              />
            ) : (
              <div
                className="rounded-circle border bg-light"
                style={{ width: 60, height: 60 }}
              />
            )}
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={onPickLogo}
            >
              Choisir une image
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={onPickLogo}
            >
              Prendre une photo
            </button>
            {logoFile && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setLogoFile(null)}
              >
                Retirer le logo
              </button>
            )}
          </div>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onLogoChange}
        />
      </div>

      {/* Cover optionnelle (bannière) */}
      <div className="mb-3">
        <label className="form-label d-flex justify-content-between align-items-center">
          Image de couverture (optionnel)
          <small className="text-muted">Bannière horizontale</small>
        </label>

        <div className="d-flex align-items-center gap-3 mb-2">
          {/* Preview cover */}
          <div>
            {coverFile ? (
              <img
                src={URL.createObjectURL(coverFile)}
                alt="cover preview"
                className="rounded border"
                style={{ width: 96, height: 60, objectFit: "cover" }}
              />
            ) : existingCoverUrl ? (
              <img
                src={existingCoverUrl}
                alt="cover actuelle"
                className="rounded border"
                style={{ width: 96, height: 60, objectFit: "cover" }}
              />
            ) : (
              <div
                className="rounded border bg-light"
                style={{ width: 96, height: 60 }}
              />
            )}
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={onPickCover}
            >
              Choisir une image
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={onPickCover}
            >
              Prendre une photo
            </button>
            {coverFile && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setCoverFile(null)}
              >
                Retirer la couverture
              </button>
            )}
          </div>
        </div>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onCoverChange}
        />
      </div>

      <div className="mb-2">
        <label className="form-label">Description</label>
        <textarea
          className="form-control"
          rows={3}
          value={(draft as any).description || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
        />
      </div>

      <div className="d-flex justify-content-end">
        <button className="btn btn-dark" type="submit">
          Enregistrer
        </button>
      </div>
    </form>
  );
}

/* ======= Page admin boutiques ======= */

export default function ShopsAdminPage() {
  const [items, setItems] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Shop | null>(null);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  async function refresh() {
    setLoading(true);
    try {
      const res = await listShops({ page, pageSize });
      setItems(res.items);
      setTotal(res.pageInfo.total);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function openCreate() {
    setEdit(null);
    setShowForm(true);
  }
  function openEdit(s: Shop) {
    setEdit(s);
    setShowForm(true);
  }

  async function onSave(draft: Draft, files: ShopFiles) {
    // 🔹 On reconstruit un payload propre et on force un name trimé
    const cleanName = (draft.name ?? "").toString().trim();
    if (!cleanName) {
      alert("Le nom du restaurant / boutique est obligatoire.");
      return;
    }

    const payload: Draft = {
      name: cleanName,
      description: (draft as any).description ?? null,
      category_id: draft.category_id ?? null,
      address: draft.address ?? null,
      city: draft.city ?? null,
      country: draft.country ?? null,
      lat: draft.lat ?? null,
      lng: draft.lng ?? null,
    };

    try {
      if (edit == null) {
        await createShop(payload, files);
      } else {
        await updateShop(edit.id, payload, files);
      }
      setShowForm(false);
      refresh();
    } catch (e: any) {
      console.error("Erreur create/update shop", e);
      const msg =
        (e?.response?.data?.error as string | undefined) ||
        e?.message ||
        "Une erreur est survenue lors de l'enregistrement de la boutique.";
      alert(msg);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Supprimer cette boutique ?")) return;
    await removeShop?.(id);
    refresh();
  }

  const filtered = items.filter((s) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(t) ||
      (s.slug || "").toLowerCase().includes(t) ||
      String(s.id).includes(t)
    );
  });

  return (
    <div className="container-xxl py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <input
          className="form-control"
          placeholder="Recherche…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{ maxWidth: 280 }}
        />
        <button className="btn btn-dark" onClick={openCreate}>
          + Nouvelle boutique
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucune boutique.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Logo</th>
                    <th>Nom</th>
                    <th>Slug</th>
                    <th>Créée le</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const logo = (s as any).logo as string | null | undefined;
                    const logoSrc = shopLogoUrl(logo);
                    return (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={s.name}
                              className="rounded-circle border"
                              style={{
                                width: 40,
                                height: 40,
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              className="rounded-circle border bg-light"
                              style={{ width: 40, height: 40 }}
                            />
                          )}
                        </td>
                        <td>{s.name}</td>
                        <td>{s.slug}</td>
                        <td>
                          {s.created_at
                            ? new Date(s.created_at).toLocaleString()
                            : "-"}
                        </td>
                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              className="btn btn-sm btn-outline-dark"
                              onClick={() => openEdit(s)}
                            >
                              Modifier
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => onDelete(s.id)}
                            >
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

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="text-muted small">{total} éléments</div>
            <div className="btn-group">
              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Préc.
              </button>
              <span className="btn btn-sm btn-outline-dark disabled">
                {page} / {pages}
              </span>
              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suiv.
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,.2)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {edit == null ? "Nouvelle boutique" : "Modifier boutique"}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setShowForm(false)}
                />
              </div>
              <div className="modal-body">
                <ShopForm initial={edit || undefined} onSubmit={onSave} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
