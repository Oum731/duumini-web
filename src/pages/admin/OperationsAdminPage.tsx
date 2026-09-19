// src/pages/admin/OperationsAdminPage.tsx
//
// Module Operations (Phase C) : suivi d'actions/tâches par ville et
// responsable — reproduit dans l'app l'onglet "Operations" du classeur de
// gestion existant (Date, Commande/sujet, Ville, Type, Responsable, Statut,
// Échéance, Action/résolution).
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, PlusCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import {
  listOperations,
  createOperation,
  updateOperation,
  removeOperation,
  operationErrorMessage,
  type Operation,
  type OperationStatus,
} from "../../services/operations";
import { listAdminUsers, type AdminUser } from "../../services/adminUsers";

const STATUS_LABEL: Record<OperationStatus, string> = {
  OPEN: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Fait",
};

const STATUS_BADGE: Record<OperationStatus, string> = {
  OPEN: "bg-secondary",
  IN_PROGRESS: "bg-warning text-dark",
  DONE: "bg-success",
};

function personName(first?: string | null, last?: string | null) {
  const n = `${first || ""} ${last || ""}`.trim();
  return n || null;
}

function isLate(op: Operation) {
  if (op.status === "DONE" || !op.due_date) return false;
  return new Date(op.due_date) < new Date(new Date().toDateString());
}

const PAGE_SIZE = 20;

export default function OperationsAdminPage() {
  const [items, setItems] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OperationStatus | "">("");
  const [cityFilter, setCityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const [showCreate, setShowCreate] = useState(false);
  const [opDate, setOpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState<AdminUser | null>(null);
  const [responsibleQuery, setResponsibleQuery] = useState("");
  const [responsibleResults, setResponsibleResults] = useState<AdminUser[]>([]);
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState<Operation | null>(null);
  const [editStatus, setEditStatus] = useState<OperationStatus>("OPEN");
  const [editResolution, setEditResolution] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function refresh(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await listOperations({
        status: statusFilter || undefined,
        city: cityFilter || undefined,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.pageInfo.total);
    } catch (e: any) {
      setError(operationErrorMessage(e, "Impossible de charger les actions."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [statusFilter, cityFilter]);

  useEffect(() => {
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, cityFilter, page]);

  const lateCount = useMemo(() => items.filter(isLate).length, [items]);
  const inProgressCount = useMemo(
    () => items.filter((o) => o.status === "IN_PROGRESS").length,
    [items]
  );

  async function searchResponsible(q: string) {
    setResponsibleQuery(q);
    if (!q.trim()) {
      setResponsibleResults([]);
      return;
    }
    try {
      const res = await listAdminUsers({ q: q.trim(), pageSize: 6 });
      setResponsibleResults(res.items);
    } catch {
      setResponsibleResults([]);
    }
  }

  async function handleCreate() {
    if (!opDate) return setError("La date est obligatoire.");
    if (!subject.trim()) return setError("Le sujet est obligatoire.");

    setSaving(true);
    setError(null);
    try {
      await createOperation({
        op_date: opDate,
        subject: subject.trim(),
        city: city.trim() || undefined,
        type: type.trim() || undefined,
        responsible_user_id: responsible?.id,
        due_date: dueDate || undefined,
      });
      setShowCreate(false);
      setSubject("");
      setCity("");
      setType("");
      setDueDate("");
      setResponsible(null);
      setResponsibleQuery("");
      if (page === 1) await refresh(1);
      else setPage(1);
    } catch (e: any) {
      setError(operationErrorMessage(e, "Impossible de créer cette action."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(op: Operation) {
    setEditRow(op);
    setEditStatus(op.status);
    setEditResolution(op.resolution || "");
    setEditDueDate(op.due_date ? op.due_date.slice(0, 10) : "");
  }

  async function handleSaveEdit() {
    if (!editRow) return;
    setEditSaving(true);
    setError(null);
    try {
      await updateOperation(editRow.id, {
        status: editStatus,
        resolution: editResolution.trim() || undefined,
        due_date: editDueDate || undefined,
      });
      setEditRow(null);
      await refresh();
    } catch (e: any) {
      setError(operationErrorMessage(e, "Impossible de mettre à jour cette action."));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette action ?")) return;
    try {
      await removeOperation(id);
      await refresh();
    } catch (e: any) {
      setError(operationErrorMessage(e, "Impossible de supprimer cette action."));
    }
  }

  return (
    <div>
      <PageHeader
        title="Operations"
        subtitle="Suivi d'actions/tâches par ville et responsable."
        right={
          <button className="btn btn-duu btn-sm d-flex align-items-center gap-1" onClick={() => setShowCreate((v) => !v)}>
            <PlusCircle size={16} /> Nouvelle action
          </button>
        }
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard icon={ClipboardList} label="Actions (page)" value={total} accent="blue" />
        </div>
        <div className="col-sm-4">
          <KpiCard icon={AlertTriangle} label="En retard (page)" value={lateCount} accent="orange" />
        </div>
        <div className="col-sm-4">
          <KpiCard icon={CheckCircle2} label="En cours (page)" value={inProgressCount} accent="neutral" />
        </div>
      </div>

      {showCreate ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body row g-2">
            <div className="col-md-2">
              <label className="form-label small">Date</label>
              <input type="date" className="form-control" value={opDate} onChange={(e) => setOpDate(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Sujet</label>
              <input
                className="form-control"
                placeholder="ex: Réclamation client X"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Ville</label>
              <input className="form-control" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Type</label>
              <input
                className="form-control"
                placeholder="ex: Livraison"
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Échéance</label>
              <input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="col-md-6 position-relative">
              <label className="form-label small">Responsable</label>
              {responsible ? (
                <div className="form-control d-flex justify-content-between align-items-center">
                  <span>{personName(responsible.first_name, responsible.last_name) || responsible.phone}</span>
                  <button className="btn btn-sm btn-link p-0" onClick={() => setResponsible(null)}>
                    Changer
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="form-control"
                    placeholder="Rechercher un utilisateur..."
                    value={responsibleQuery}
                    onChange={(e) => searchResponsible(e.target.value)}
                  />
                  {responsibleResults.length > 0 ? (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 10 }}>
                      {responsibleResults.map((u) => (
                        <button
                          key={u.id}
                          className="list-group-item list-group-item-action"
                          onClick={() => {
                            setResponsible(u);
                            setResponsibleResults([]);
                          }}
                        >
                          {personName(u.first_name, u.last_name) || u.phone}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="col-md-6 d-flex align-items-end justify-content-end">
              <button className="btn btn-dark" disabled={saving} onClick={handleCreate}>
                {saving ? "..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select
          className="form-select w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OperationStatus | "")}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABEL) as OperationStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          className="form-control"
          style={{ maxWidth: 220 }}
          placeholder="Filtrer par ville..."
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState label="Chargement des actions..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sujet</th>
                <th>Ville</th>
                <th>Type</th>
                <th>Responsable</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th>Résolution</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((op) => (
                <tr key={op.id} className={isLate(op) ? "table-danger" : ""}>
                  <td className="small text-nowrap">{new Date(op.op_date).toLocaleDateString("fr-FR")}</td>
                  <td>{op.subject}</td>
                  <td className="small text-muted">{op.city || "—"}</td>
                  <td className="small text-muted">{op.type || "—"}</td>
                  <td className="small">
                    {personName(op.responsible_first_name, op.responsible_last_name) || "—"}
                  </td>
                  <td className="small text-nowrap">
                    {op.due_date ? new Date(op.due_date).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[op.status]}`}>{STATUS_LABEL[op.status]}</span>
                  </td>
                  <td className="small text-muted" style={{ maxWidth: 220 }}>
                    {op.resolution || "—"}
                  </td>
                  <td className="text-end text-nowrap">
                    <div className="btn-group">
                      <button className="btn btn-outline-dark btn-sm" onClick={() => openEdit(op)}>
                        Modifier
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(op.id)}>
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4">
                    Aucune action enregistrée.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 ? (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="text-muted small">{total} action(s)</div>
          <div className="btn-group">
            <button className="btn btn-sm btn-outline-dark" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Préc.
            </button>
            <span className="btn btn-sm btn-outline-dark disabled">
              {page} / {pages}
            </span>
            <button className="btn btn-sm btn-outline-dark" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Suiv.
            </button>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setEditRow(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editRow.subject}</h5>
                <button className="btn-close" onClick={() => setEditRow(null)} />
              </div>
              <div className="modal-body">
                <label className="form-label small">Statut</label>
                <select
                  className="form-select mb-2"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OperationStatus)}
                >
                  {(Object.keys(STATUS_LABEL) as OperationStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <label className="form-label small">Échéance</label>
                <input
                  type="date"
                  className="form-control mb-2"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
                <label className="form-label small">Action / résolution</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editResolution}
                  onChange={(e) => setEditResolution(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setEditRow(null)}>
                  Annuler
                </button>
                <button className="btn btn-dark" disabled={editSaving} onClick={handleSaveEdit}>
                  {editSaving ? "..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
