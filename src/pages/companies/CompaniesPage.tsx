// src/pages/companies/CompaniesPage.tsx
import { useEffect, useState } from "react";
import { Modal } from "../profile/components/Modal";
import { useCompany } from "../../context/CompanyContext";
import { getCompanyCaps } from "../../utils/capabilities";
import {
  addCompanyMember,
  companyErrorMessage,
  createCompany,
  listCompanyMembers,
  removeCompanyMember,
  updateCompanyMemberRole,
  type CompanyMember,
  type InternalRole,
  type SupplierType,
} from "../../services/companies";

const SUPPLIER_TYPES: { value: SupplierType; label: string }[] = [
  { value: "FABRICANT", label: "Fabricant" },
  { value: "IMPORTATEUR", label: "Importateur" },
  { value: "GROSSISTE", label: "Grossiste" },
  { value: "DISTRIBUTEUR", label: "Distributeur" },
  { value: "AUTRE", label: "Autre" },
];

const INTERNAL_ROLES: { value: InternalRole; label: string }[] = [
  { value: "OWNER", label: "Propriétaire" },
  { value: "MANAGER", label: "Gestionnaire" },
  { value: "SALES", label: "Commercial" },
  { value: "WAREHOUSE", label: "Magasinier" },
  { value: "ACCOUNTANT", label: "Comptable" },
  { value: "VIEWER", label: "Lecture seule" },
];

function CreateCompanyForm({ onCreated }: { onCreated: () => void }) {
  const [legalName, setLegalName] = useState("");
  const [description, setDescription] = useState("");
  const [supplierType, setSupplierType] = useState<SupplierType | "">("");
  const [countryCode, setCountryCode] = useState("MA");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!legalName.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCompany({
        legal_name: legalName.trim(),
        description: description.trim() || null,
        supplier_type: supplierType || null,
        country_code: countryCode,
      });
      setLegalName("");
      setDescription("");
      setSupplierType("");
      onCreated();
    } catch (e: any) {
      setError(companyErrorMessage(e, "Impossible de créer l'entreprise."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-3 mb-4" style={{ borderRadius: "var(--duu-radius-md, 18px)" }}>
      <h5 className="mb-3">Créer une entreprise</h5>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="mb-2">
        <label className="form-label">Nom légal</label>
        <input
          className="form-control"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="Ex. Duumini Distribution SARL"
        />
      </div>

      <div className="mb-2">
        <label className="form-label">Description (optionnel)</label>
        <textarea
          className="form-control"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="row g-2 mb-3">
        <div className="col-sm-6">
          <label className="form-label">Type de fournisseur</label>
          <select
            className="form-select"
            value={supplierType}
            onChange={(e) => setSupplierType(e.target.value as SupplierType | "")}
          >
            <option value="">—</option>
            {SUPPLIER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-6">
          <label className="form-label">Pays</label>
          <select
            className="form-select"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            <option value="MA">Maroc</option>
            <option value="CI">Côte d'Ivoire</option>
          </select>
        </div>
      </div>

      <button className="btn btn-dark" type="submit" disabled={busy}>
        {busy ? "Création…" : "Créer l'entreprise"}
      </button>
    </form>
  );
}

function AddMemberModal({
  companyId,
  open,
  onClose,
  onAdded,
}: {
  companyId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<InternalRole>("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(userId);
    if (!id) {
      setError("Identifiant utilisateur invalide.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addCompanyMember(companyId, { user_id: id, internal_role: role });
      setUserId("");
      setRole("VIEWER");
      onAdded();
      onClose();
    } catch (e: any) {
      setError(companyErrorMessage(e, "Impossible d'ajouter ce membre."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Ajouter un employé" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="mb-2">
          <label className="form-label">Identifiant utilisateur (ID)</label>
          <input
            className="form-control"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Ex. 42"
            inputMode="numeric"
          />
          <div className="form-text">
            La personne doit déjà avoir un compte Duumini. Demandez-lui son
            identifiant depuis son profil.
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Rôle interne</label>
          <select
            className="form-select"
            value={role}
            onChange={(e) => setRole(e.target.value as InternalRole)}
          >
            {INTERNAL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-dark" type="submit" disabled={busy}>
          {busy ? "Ajout…" : "Ajouter"}
        </button>
      </form>
    </Modal>
  );
}

function MembersPanel({ companyId, myRole }: { companyId: number; myRole?: InternalRole }) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const caps = getCompanyCaps(myRole ?? null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const items = await listCompanyMembers(companyId);
      setMembers(items);
    } catch (e: any) {
      setError(companyErrorMessage(e, "Impossible de charger les employés."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function changeRole(userId: number, role: InternalRole) {
    try {
      await updateCompanyMemberRole(companyId, userId, role);
      load();
    } catch (e: any) {
      setError(companyErrorMessage(e, "Impossible de modifier le rôle."));
    }
  }

  async function remove(userId: number) {
    if (!window.confirm("Retirer cet employé de l'entreprise ?")) return;
    try {
      await removeCompanyMember(companyId, userId);
      load();
    } catch (e: any) {
      setError(companyErrorMessage(e, "Impossible de retirer ce membre."));
    }
  }

  return (
    <div className="card p-3" style={{ borderRadius: "var(--duu-radius-md, 18px)" }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="m-0">Employés</h5>
        {caps.canManageEmployees && (
          <button className="btn btn-sm btn-outline-dark" onClick={() => setShowAdd(true)}>
            + Ajouter
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <div className="text-muted">Chargement…</div>}

      {!loading && !members.length && (
        <div className="text-muted">Aucun employé pour le moment.</div>
      )}

      {!loading && !!members.length && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                {caps.canManageEmployees && <th />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {[m.first_name, m.last_name].filter(Boolean).join(" ") || `Utilisateur #${m.user_id}`}
                  </td>
                  <td>{m.phone || "—"}</td>
                  <td>
                    {caps.canManageEmployees ? (
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 160 }}
                        value={m.internal_role}
                        onChange={(e) => changeRole(m.user_id, e.target.value as InternalRole)}
                      >
                        {INTERNAL_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      INTERNAL_ROLES.find((r) => r.value === m.internal_role)?.label ?? m.internal_role
                    )}
                  </td>
                  {caps.canManageEmployees && (
                    <td>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => remove(m.user_id)}
                      >
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddMemberModal
        companyId={companyId}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={load}
      />
    </div>
  );
}

export default function CompaniesPage() {
  const { myCompanies, activeCompanyId, activeCompany, setActiveCompany, loading, refresh } =
    useCompany();

  return (
    <div className="container py-4" style={{ maxWidth: 900 }}>
      <h2 className="mb-1">Mon entreprise</h2>
      <p className="text-muted mb-4">
        Gérez vos entreprises et les employés qui y ont accès.
      </p>

      {loading && !myCompanies.length && <div className="text-muted mb-4">Chargement…</div>}

      {!!myCompanies.length && (
        <div className="card p-3 mb-4" style={{ borderRadius: "var(--duu-radius-md, 18px)" }}>
          <label className="form-label">Entreprise active</label>
          <select
            className="form-select"
            value={activeCompanyId ?? ""}
            onChange={(e) => setActiveCompany(Number(e.target.value) || null)}
          >
            {myCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.legal_name} ({c.my_role ?? "—"})
              </option>
            ))}
          </select>
        </div>
      )}

      <CreateCompanyForm onCreated={refresh} />

      {activeCompany && (
        <MembersPanel companyId={activeCompany.id} myRole={activeCompany.my_role} />
      )}
    </div>
  );
}
