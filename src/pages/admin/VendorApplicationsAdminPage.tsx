// src/pages/admin/VendorApplicationsAdminPage.tsx
import { useEffect, useState } from "react";
import { formatPhoneDisplay } from "../../utils/phone";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader } from "../../components/admin/adminUI";
import {
  listVendorApplications,
  approveVendorApplication,
  rejectVendorApplication,
  applicationErrorMessage,
  type VendorApplication,
  type ApplicationStatus,
} from "../../services/vendorApplications";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
};

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  PENDING: "bg-warning text-dark",
  APPROVED: "bg-success",
  REJECTED: "bg-danger",
};

function ApproveForm({
  application,
  onDone,
}: {
  application: VendorApplication;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Mot de passe requis (6 caractères minimum).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await approveVendorApplication(application.id, password);
      onDone();
    } catch (e: any) {
      setError(applicationErrorMessage(e, "Impossible d'approuver cette candidature."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border rounded p-3 mb-3">
      <h6 className="mb-2">Approuver et créer le compte</h6>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="mb-2">
        <label className="form-label">Mot de passe initial</label>
        <input
          type="text"
          className="form-control"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="À communiquer au candidat par téléphone/WhatsApp"
        />
      </div>
      <button className="btn btn-success btn-sm" type="submit" disabled={busy}>
        {busy ? "Création…" : "Créer le compte + la boutique"}
      </button>
    </form>
  );
}

function RejectForm({
  application,
  onDone,
}: {
  application: VendorApplication;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await rejectVendorApplication(application.id, notes || undefined);
      onDone();
    } catch (e: any) {
      setError(applicationErrorMessage(e, "Impossible de rejeter cette candidature."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border rounded p-3">
      <h6 className="mb-2">Rejeter</h6>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="mb-2">
        <label className="form-label">Motif (optionnel)</label>
        <textarea
          className="form-control"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button className="btn btn-outline-danger btn-sm" type="submit" disabled={busy}>
        {busy ? "Envoi…" : "Rejeter la candidature"}
      </button>
    </form>
  );
}

export default function VendorApplicationsAdminPage() {
  const [items, setItems] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("PENDING");
  const [selected, setSelected] = useState<VendorApplication | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listVendorApplications({
        status: statusFilter || undefined,
        q: qDebounced || undefined,
        pageSize: 100,
      });
      setItems(res.items);
      if (selected && !res.items.some((a) => a.id === selected.id)) {
        setSelected(null);
      }
    } catch (e: any) {
      setError(applicationErrorMessage(e, "Impossible de charger les candidatures."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, qDebounced]);

  return (
    <div className="container-xxl py-4">
      <PageHeader
        title="Candidatures vendeurs / fournisseurs"
        subtitle={`${items.length} candidature(s)`}
      />

      <div className="row g-3">
        <div className="col-12 col-md-5 col-lg-4">
          <div
            className="card border-0"
            style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
          >
            <div className="card-body p-3 p-sm-4">
              <select
                className="form-select mb-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "")}
              >
                <option value="PENDING">En attente</option>
                <option value="APPROVED">Approuvées</option>
                <option value="REJECTED">Rejetées</option>
                <option value="">Toutes</option>
              </select>

              <input
                type="text"
                className="form-control mb-3"
                placeholder="Recherche… (nom, téléphone, email)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              {loading && <LoadingState />}
              {error && <div className="alert alert-danger py-2">{error}</div>}

              {!loading && !items.length && (
                <div className="text-muted small">Aucune candidature.</div>
              )}

              <div className="list-group" style={{ maxHeight: "65vh", overflowY: "auto" }}>
                {items.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${
                      selected?.id === a.id ? "active" : ""
                    }`}
                    onClick={() => setSelected(a)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-semibold text-truncate">{a.legal_name}</span>
                      <span className={`badge ${STATUS_BADGE[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    <div className="small text-muted">
                      {a.applicant_type} • {a.country_code} • {formatPhoneDisplay(a.contact_phone)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-7 col-lg-8">
          <div
            className="card border-0 h-100"
            style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
          >
            <div className="card-body p-3 p-sm-4">
              {!selected ? (
                <div className="text-muted">
                  Sélectionnez une candidature dans la liste pour voir le détail.
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h2 className="h6 mb-1">{selected.legal_name}</h2>
                      <div className="text-muted small">
                        {selected.applicant_type} — {selected.city || "—"},{" "}
                        {selected.country_code}
                      </div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[selected.status]}`}>
                      {STATUS_LABEL[selected.status]}
                    </span>
                  </div>

                  <dl className="row small">
                    <dt className="col-4">Téléphone</dt>
                    <dd className="col-8">{formatPhoneDisplay(selected.contact_phone)}</dd>
                    <dt className="col-4">Email</dt>
                    <dd className="col-8">{selected.contact_email || "—"}</dd>
                    <dt className="col-4">Message</dt>
                    <dd className="col-8">{selected.message || "—"}</dd>
                    <dt className="col-4">DFE</dt>
                    <dd className="col-8">
                      {selected.dfe_url ? (
                        <a href={selected.dfe_url} target="_blank" rel="noopener noreferrer">
                          Voir le document
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                    <dt className="col-4">Registre de Commerce</dt>
                    <dd className="col-8">
                      {selected.rc_url ? (
                        <a href={selected.rc_url} target="_blank" rel="noopener noreferrer">
                          Voir le document
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                    {selected.admin_notes && (
                      <>
                        <dt className="col-4">Notes admin</dt>
                        <dd className="col-8">{selected.admin_notes}</dd>
                      </>
                    )}
                  </dl>

                  {selected.status === "PENDING" && (
                    <div className="row g-3 mt-2">
                      <div className="col-12 col-md-6">
                        <ApproveForm application={selected} onDone={refresh} />
                      </div>
                      <div className="col-12 col-md-6">
                        <RejectForm application={selected} onDone={refresh} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
