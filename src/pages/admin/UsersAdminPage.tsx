// src/pages/admin/UsersAdminPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  listUsers,
  createUser,
  updateUser,
  removeUser,
  type Role,
  type User,
  changeUserRole,
} from "../../services/users";
import { useAuth } from "../../context/AuthContext"; // ⬅️ pour refreshUser()
import { getCurrentUser } from "../../services/auth"; // ⬅️ pour savoir si c’est moi
import { listAffiliates, createAffiliate, type Affiliate } from "../../services/affiliates";
import { formatPhoneDisplay } from "../../utils/phone";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader } from "../../components/admin/adminUI";

const ROLES: Role[] = ["MEMBER", "VENDEUR", "LIVREUR", "ADMIN"];
type Draft = Partial<User> & { password?: string };

export default function UsersAdminPage() {
  const { refreshUser } = useAuth(); // ⬅️ on utilisera ceci après edit/delete
  const me = getCurrentUser(); // ⬅️ utilisateur courant (normalisé)
  const myId = me?.id ?? null;

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ role: "MEMBER" });

  // ✅ Affiliation : chargée une fois pour toutes (programme d'affiliation
  // toujours petit), pour savoir en un coup d'œil qui est déjà affilié
  // sans faire un aller-retour réseau par ligne.
  const [affiliateByUserId, setAffiliateByUserId] = useState<Map<number, Affiliate>>(new Map());
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [affiliateTarget, setAffiliateTarget] = useState<User | null>(null);
  const [affiliateRate, setAffiliateRate] = useState("10");
  const [affiliateNotes, setAffiliateNotes] = useState("");
  const [affiliateSaving, setAffiliateSaving] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({ page, pageSize, q: q || undefined });
      setItems(res.items);
      setTotal(res.pageInfo.total);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  const loadAffiliates = useCallback(async () => {
    try {
      const res = await listAffiliates({ pageSize: 1000 });
      const map = new Map<number, Affiliate>();
      for (const a of res.items || []) {
        if (a.user_id != null) map.set(Number(a.user_id), a);
      }
      setAffiliateByUserId(map);
    } catch {
      // silencieux : l'absence de badge n'empêche pas de gérer les users
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  function openAffiliate(u: User) {
    setAffiliateTarget(u);
    setAffiliateRate("10");
    setAffiliateNotes("");
    setAffiliateError(null);
    setShowAffiliateModal(true);
  }

  async function onGrantAffiliate() {
    if (!affiliateTarget) return;
    setAffiliateSaving(true);
    setAffiliateError(null);
    try {
      await createAffiliate({
        user_id: affiliateTarget.id,
        name:
          [affiliateTarget.first_name, affiliateTarget.last_name].filter(Boolean).join(" ") ||
          affiliateTarget.phone ||
          `Utilisateur #${affiliateTarget.id}`,
        phone: affiliateTarget.phone || null,
        commission_rate: Number(affiliateRate || 10),
        status: "ACTIVE",
        notes: affiliateNotes || null,
      });
      setShowAffiliateModal(false);
      await loadAffiliates();
    } catch (e: any) {
      setAffiliateError(
        e?.payload?.message || e?.message || "Impossible de créer l'affilié."
      );
    } finally {
      setAffiliateSaving(false);
    }
  }

  function openCreate() {
    setEditId(null);
    setDraft({
      phone: "",
      password: "",
      first_name: "",
      last_name: "",
      role: "MEMBER",
    });
    setShowForm(true);
  }
  function openEdit(u: User) {
    setEditId(u.id);
    setDraft({ ...u });
    setShowForm(true);
  }

  async function onSave() {
    try {
      if (editId == null) {
        // Création : DB prendra le rôle envoyé
        await createUser({
          phone: String(draft.phone || ""),
          password: String(draft.password || "secret123"),
          first_name: draft.first_name ?? null,
          last_name: draft.last_name ?? null,
          role: (draft.role as Role) || "MEMBER",
        });
        setShowForm(false);
        await refresh(); 
        return;
      }

      // Edition existante
      const original = items.find((u) => u.id === editId);
      const nextRole = (draft.role as Role) || "MEMBER";
      const roleChanged = !!original && original.role !== nextRole;

      // 1) Maj des champs SANS rôle
      await updateUser(editId, {
        phone: String(draft.phone || ""),
        first_name: draft.first_name ?? null,
        last_name: draft.last_name ?? null,
      });

      // 2) Puis, si besoin, changement de rôle
      if (roleChanged) {
        await changeUserRole(editId, nextRole);
      }

      //modifié MON propre rôle → resynchro et ARRET (ne plus taper d’endpoint admin)
      const me = getCurrentUser();
      if (me?.id === editId && roleChanged) {
        setShowForm(false);
        await refreshUser();
        return; 
      }

      setShowForm(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      await removeUser(id);

      // ⬇️ Si j’ai supprimé MON propre compte, resynchro immédiate
      if (myId && id === myId) {
        await refreshUser(); // AuthContext mettra la session à null → redirections gérées ailleurs
      }

      refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  const filtered = items.filter((u) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      (u.phone || "").toLowerCase().includes(t) ||
      (u.first_name || "").toLowerCase().includes(t) ||
      (u.last_name || "").toLowerCase().includes(t) ||
      (u.role || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="container-xxl py-4">
      <PageHeader
        title="Utilisateurs"
        subtitle={`${total} élément(s)`}
        right={
          <>
            <input
              className="form-control"
              placeholder="Recherche tel/nom…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              style={{ maxWidth: 280 }}
            />
            <button className="btn btn-duu-orange" onClick={openCreate}>
              + Nouvel utilisateur
            </button>
          </>
        }
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <div
        className="card border-0"
        style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
      >
        <div className="card-body p-3 p-sm-4">
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucun utilisateur.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Téléphone</th>
                    <th>Nom</th>
                    <th>Rôle</th>
                    <th>Affiliation</th>
                    <th>Inscription</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{formatPhoneDisplay(u.phone)}</td>
                      <td>
                        {[u.first_name, u.last_name]
                          .filter(Boolean)
                          .join(" ") || "-"}
                      </td>
                      <td>
                        <span className="badge bg-secondary">{u.role}</span>
                        {myId === u.id && (
                          <span className="ms-2 badge bg-info">Moi</span>
                        )}
                      </td>
                      <td>
                        {affiliateByUserId.has(u.id) ? (
                          <span
                            className={`badge ${
                              affiliateByUserId.get(u.id)?.status === "ACTIVE"
                                ? "bg-success"
                                : "bg-secondary"
                            }`}
                          >
                            Affilié
                          </span>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => openAffiliate(u)}
                          >
                            Rendre affilié
                          </button>
                        )}
                      </td>
                      <td>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() => openEdit(u)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDelete(u.id)}
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
                  {editId == null
                    ? "Nouvel utilisateur"
                    : "Modifier utilisateur"}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setShowForm(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Téléphone</label>
                  <input
                    className="form-control"
                    value={draft.phone || ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, phone: e.target.value }))
                    }
                  />
                </div>
                {editId == null && (
                  <div className="mb-3">
                    <label className="form-label">Mot de passe</label>
                    <input
                      type="password"
                      className="form-control"
                      value={draft.password || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, password: e.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">Prénom</label>
                    <input
                      className="form-control"
                      value={draft.first_name || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, first_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Nom</label>
                    <input
                      className="form-control"
                      value={draft.last_name || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, last_name: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label">Rôle</label>
                  <select
                    className="form-select"
                    value={draft.role || "MEMBER"}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, role: e.target.value as Role }))
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-dark"
                  onClick={() => setShowForm(false)}
                >
                  Fermer
                </button>
                <button className="btn btn-duu-orange" onClick={onSave}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAffiliateModal && affiliateTarget && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,.2)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Rendre affilié</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowAffiliateModal(false)}
                />
              </div>
              <div className="modal-body">
                {affiliateError && (
                  <div className="alert alert-danger">{affiliateError}</div>
                )}
                <div className="mb-3">
                  <label className="form-label">Utilisateur</label>
                  <input
                    className="form-control"
                    disabled
                    value={
                      [affiliateTarget.first_name, affiliateTarget.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      affiliateTarget.phone ||
                      `#${affiliateTarget.id}`
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Taux de commission (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={affiliateRate}
                    onChange={(e) => setAffiliateRate(e.target.value)}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Notes (optionnel)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={affiliateNotes}
                    onChange={(e) => setAffiliateNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-dark"
                  onClick={() => setShowAffiliateModal(false)}
                >
                  Annuler
                </button>
                <button
                  className="btn btn-success"
                  onClick={onGrantAffiliate}
                  disabled={affiliateSaving}
                >
                  {affiliateSaving ? "Création…" : "Rendre affilié"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
