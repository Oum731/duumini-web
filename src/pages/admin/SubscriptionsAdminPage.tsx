// src/pages/admin/SubscriptionsAdminPage.tsx
import { useEffect, useMemo, useState } from "react";
import { CreditCard, PlusCircle, Building2 } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import {
  listSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  listCompanySubscriptions,
  startCompanyTrial,
  activateCompanySubscription,
  cancelCompanySubscription,
  subscriptionErrorMessage,
  type SubscriptionPlan,
  type CompanySubscriptionRow,
  type EffectiveStatus,
} from "../../services/subscriptions";

type Tab = "companies" | "plans";

function statusBadge(status: EffectiveStatus) {
  const map: Record<EffectiveStatus, string> = {
    TRIAL: "bg-info text-dark",
    ACTIVE: "bg-success",
    EXPIRED: "bg-danger",
    CANCELLED: "bg-secondary",
    NONE: "bg-light text-dark border",
  };
  const label: Record<EffectiveStatus, string> = {
    TRIAL: "Essai",
    ACTIVE: "Actif",
    EXPIRED: "Expiré",
    CANCELLED: "Annulé",
    NONE: "Aucun abonnement",
  };
  return <span className={`badge ${map[status]}`}>{label[status]}</span>;
}

export default function SubscriptionsAdminPage() {
  const [tab, setTab] = useState<Tab>("companies");

  return (
    <div>
      <PageHeader
        title="Abonnements"
        subtitle="Débloque les outils de gestion Duumini pour une entreprise — activation manuelle, sans passerelle de paiement."
      />

      <div className="d-flex gap-2 mb-3">
        <button
          className={`btn btn-sm ${tab === "companies" ? "btn-dark" : "btn-outline-secondary"}`}
          onClick={() => setTab("companies")}
        >
          <Building2 size={14} className="me-1" /> Entreprises
        </button>
        <button
          className={`btn btn-sm ${tab === "plans" ? "btn-dark" : "btn-outline-secondary"}`}
          onClick={() => setTab("plans")}
        >
          <CreditCard size={14} className="me-1" /> Plans
        </button>
      </div>

      {tab === "companies" ? <CompaniesTab /> : <PlansTab />}
    </div>
  );
}

function CompaniesTab() {
  const [items, setItems] = useState<CompanySubscriptionRow[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalCompany, setModalCompany] = useState<CompanySubscriptionRow | null>(null);
  const [modalMode, setModalMode] = useState<"trial" | "activate" | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [periodEnd, setPeriodEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [companiesRes, plansRes] = await Promise.all([
        listCompanySubscriptions(),
        listSubscriptionPlans(true),
      ]);
      setItems(companiesRes.items);
      setPlans(plansRes.items);
    } catch (e: any) {
      setError(subscriptionErrorMessage(e, "Impossible de charger les entreprises."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeCount = useMemo(() => items.filter((i) => i.effective_status === "ACTIVE").length, [items]);
  const trialCount = useMemo(() => items.filter((i) => i.effective_status === "TRIAL").length, [items]);

  function openModal(company: CompanySubscriptionRow, mode: "trial" | "activate") {
    setModalCompany(company);
    setModalMode(mode);
    setSelectedPlanId(company.plan_id || plans[0]?.id || null);
    setPeriodEnd("");
    setNote("");
  }

  async function handleConfirm() {
    if (!modalCompany || !selectedPlanId) return;
    setSaving(true);
    setError(null);
    try {
      if (modalMode === "trial") {
        await startCompanyTrial(modalCompany.company_id, { plan_id: selectedPlanId, note: note || undefined });
      } else {
        if (!periodEnd) {
          setError("Date de fin de période requise.");
          setSaving(false);
          return;
        }
        await activateCompanySubscription(modalCompany.company_id, {
          plan_id: selectedPlanId,
          current_period_end: periodEnd,
          note: note || undefined,
        });
      }
      setModalCompany(null);
      setModalMode(null);
      await refresh();
    } catch (e: any) {
      setError(subscriptionErrorMessage(e, "Action impossible."));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(company: CompanySubscriptionRow) {
    if (!confirm(`Annuler l'abonnement de ${company.legal_name} ?`)) return;
    try {
      await cancelCompanySubscription(company.company_id);
      await refresh();
    } catch (e: any) {
      setError(subscriptionErrorMessage(e, "Impossible d'annuler l'abonnement."));
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard label="Abonnements actifs" value={activeCount} accent="green" />
        </div>
        <div className="col-sm-4">
          <KpiCard label="En essai" value={trialCount} accent="blue" />
        </div>
        <div className="col-sm-4">
          <KpiCard label="Entreprises" value={items.length} accent="neutral" />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Chargement..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Statut</th>
                <th>Plan</th>
                <th>Échéance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.company_id}>
                  <td>{c.legal_name}</td>
                  <td>{statusBadge(c.effective_status)}</td>
                  <td className="small text-muted">{c.plan_name || "—"}</td>
                  <td className="small text-muted">
                    {c.status === "TRIAL" ? c.trial_ends_at : c.current_period_end || "—"}
                  </td>
                  <td className="text-end d-flex gap-1 justify-content-end">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => openModal(c, "trial")}>
                      Essai
                    </button>
                    <button className="btn btn-outline-dark btn-sm" onClick={() => openModal(c, "activate")}>
                      Activer
                    </button>
                    {c.effective_status === "ACTIVE" || c.effective_status === "TRIAL" ? (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleCancel(c)}>
                        Annuler
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Aucune entreprise pour l'instant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {modalCompany && modalMode ? (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setModalCompany(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {modalMode === "trial" ? "Démarrer un essai" : "Activer l'abonnement"} — {modalCompany.legal_name}
                </h5>
                <button className="btn-close" onClick={() => setModalCompany(null)} />
              </div>
              <div className="modal-body">
                <label className="form-label small">Plan</label>
                <select
                  className="form-select mb-2"
                  value={selectedPlanId ?? ""}
                  onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({moneyMAD(p.price_amount)}/{p.billing_cycle === "MONTHLY" ? "mois" : "an"})
                    </option>
                  ))}
                </select>

                {modalMode === "activate" ? (
                  <>
                    <label className="form-label small">Fin de période</label>
                    <input
                      type="date"
                      className="form-control mb-2"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </>
                ) : null}

                <label className="form-label small">Note (optionnel)</label>
                <input className="form-control" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setModalCompany(null)}>
                  Annuler
                </button>
                <button className="btn btn-dark" disabled={saving} onClick={handleConfirm}>
                  {saving ? "..." : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlansTab() {
  const [items, setItems] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [trialDays, setTrialDays] = useState("0");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listSubscriptionPlans(true);
      setItems(res.items);
    } catch (e: any) {
      setError(subscriptionErrorMessage(e, "Impossible de charger les plans."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    if (!code.trim() || !name.trim()) return setError("Code et nom requis.");
    const priceAmount = Number(price);
    if (!Number.isFinite(priceAmount) || priceAmount < 0) return setError("Prix invalide.");

    setSaving(true);
    try {
      await createSubscriptionPlan({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        price_amount: priceAmount,
        billing_cycle: billingCycle,
        trial_days: Number(trialDays) || 0,
      });
      setShowCreate(false);
      setCode("");
      setName("");
      setPrice("");
      setTrialDays("0");
      await refresh();
    } catch (e: any) {
      setError(subscriptionErrorMessage(e, "Impossible de créer le plan."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: SubscriptionPlan) {
    try {
      await updateSubscriptionPlan(plan.id, { is_active: plan.is_active ? 0 : 1 } as any);
      await refresh();
    } catch (e: any) {
      setError(subscriptionErrorMessage(e, "Impossible de mettre à jour le plan."));
    }
  }

  return (
    <div>
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <button className="btn btn-duu btn-sm mb-3 d-flex align-items-center gap-1" onClick={() => setShowCreate((v) => !v)}>
        <PlusCircle size={16} /> Nouveau plan
      </button>

      {showCreate ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body row g-2">
            <div className="col-md-2">
              <input className="form-control" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="col-md-3">
              <input className="form-control" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-md-2">
              <input
                type="number"
                className="form-control"
                placeholder="Prix MAD"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as "MONTHLY" | "YEARLY")}
              >
                <option value="MONTHLY">Mensuel</option>
                <option value="YEARLY">Annuel</option>
              </select>
            </div>
            <div className="col-md-2">
              <input
                type="number"
                className="form-control"
                placeholder="Essai (jours)"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
            <div className="col-md-1">
              <button className="btn btn-dark w-100" disabled={saving} onClick={handleCreate}>
                {saving ? "..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Chargement des plans..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th className="text-end">Prix</th>
                <th>Cycle</th>
                <th className="text-end">Essai</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="small text-muted">{p.code}</td>
                  <td>{p.name}</td>
                  <td className="text-end">{moneyMAD(p.price_amount)}</td>
                  <td className="small">{p.billing_cycle === "MONTHLY" ? "Mensuel" : "Annuel"}</td>
                  <td className="text-end">{p.trial_days}j</td>
                  <td>
                    <span className={`badge ${p.is_active ? "bg-success" : "bg-secondary"}`}>
                      {p.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => toggleActive(p)}>
                      {p.is_active ? "Désactiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    Aucun plan créé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
