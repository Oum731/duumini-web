import { useEffect, useMemo, useState } from "react";
import {
  listShops,
  type Shop,
  // Ajoute ces services si besoin dans `services/shops.ts`
  // @ts-ignore
  createShop,
  // @ts-ignore
  updateShop,
  // @ts-ignore
  removeShop,
} from "../../services/shops";

type Draft = Partial<Shop> & { description?: string|null; };

/* ======= Barre admin inline (sans layout) ======= */

function ShopForm({ initial, onSubmit }: { initial?: Draft; onSubmit: (d: Draft) => Promise<void>|void }) {
  const [draft, setDraft] = useState<Draft>({
    name: initial?.name || "",
    slug: initial?.slug || "",
    description: (initial as any)?.description || "",
    category_id: initial?.category_id ?? null,
  });
  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSubmit(draft);}}>
      <div className="mb-2">
        <label className="form-label">Nom</label>
        <input className="form-control" value={draft.name||""} onChange={e=>setDraft(d=>({...d, name:e.target.value}))} required />
      </div>
      <div className="mb-2">
        <label className="form-label">Slug</label>
        <input className="form-control" value={draft.slug||""} onChange={e=>setDraft(d=>({...d, slug:e.target.value}))} required />
      </div>
      <div className="mb-2">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={3} value={(draft as any).description||""} onChange={e=>setDraft(d=>({...d, description:e.target.value}))} />
      </div>
      <div className="d-flex justify-content-end">
        <button className="btn btn-dark" type="submit">Enregistrer</button>
      </div>
    </form>
  );
}

export default function ShopsAdminPage() {
  const [items, setItems] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Shop|null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await listShops({ page, pageSize });
      setItems(res.items);
      setTotal(res.pageInfo.total);
      setError(null);
    } catch (e:any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [page, pageSize]); // eslint-disable-line

  function openCreate() { setEdit(null); setShowForm(true); }
  function openEdit(s: Shop) { setEdit(s); setShowForm(true); }

  async function onSave(draft: Draft) {
    if (edit == null) {
      await createShop?.(draft);
    } else {
      await updateShop?.(edit.id, draft);
    }
    setShowForm(false);
    refresh();
  }
  async function onDelete(id: number) {
    if (!confirm("Supprimer cette boutique ?")) return;
    await removeShop?.(id);
    refresh();
  }

  const filtered = items.filter(s => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (s.name || "").toLowerCase().includes(t) || (s.slug || "").toLowerCase().includes(t) || String(s.id).includes(t);
  });

  return (
    <div className="container-xxl py-4">
     

      <div className="d-flex align-items-center justify-content-between mb-3">
        <input className="form-control" placeholder="Recherche…" value={q} onChange={e=>{ setPage(1); setQ(e.target.value); }} style={{maxWidth: 280}} />
        <button className="btn btn-dark" onClick={openCreate}>+ Nouvelle boutique</button>
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
                    <th>Nom</th>
                    <th>Slug</th>
                    <th>Créée le</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.name}</td>
                      <td>{s.slug}</td>
                      <td>{s.created_at ? new Date(s.created_at).toLocaleString() : "-"}</td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button className="btn btn-sm btn-outline-dark" onClick={()=>openEdit(s)}>Modifier</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={()=>onDelete(s.id)}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="text-muted small">{total} éléments</div>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-dark" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Préc.</button>
              <span className="btn btn-sm btn-outline-dark disabled">{page} / {pages}</span>
              <button className="btn btn-sm btn-outline-dark" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Suiv.</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,.2)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit==null?"Nouvelle boutique":"Modifier boutique"}</h5>
                <button className="btn-close" onClick={()=>setShowForm(false)} />
              </div>
              <div className="modal-body">
                <ShopForm initial={edit||undefined} onSubmit={onSave} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
