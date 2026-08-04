// src/pages/admin/LivreurProfilesAdminPage.tsx
import { useEffect, useState } from "react";
import { Bike, ShieldCheck, Clock3, Ban } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import { formatPhoneDisplay } from "../../utils/phone";
import {
  listLivreurProfiles,
  validateLivreurProfile,
  settleLivreurBalance,
  livreurProfileErrorMessage,
  type AdminLivreurProfile,
} from "../../services/livreurProfiles";

const ID_DOC_LABEL: Record<string, string> = {
  PASSPORT: "Passeport",
  CARTE_SEJOUR: "Carte de séjour",
  CNI: "Carte d'identité nationale",
};

export default function LivreurProfilesAdminPage() {
  const [items, setItems] = useState<AdminLivreurProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listLivreurProfiles();
      setItems(res.items);
    } catch (e: any) {
      setError(livreurProfileErrorMessage(e, "Impossible de charger les livreurs."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleValidate(userId: number) {
    setBusyId(userId);
    try {
      await validateLivreurProfile(userId);
      await refresh();
    } catch (e: any) {
      setError(livreurProfileErrorMessage(e, "Impossible de valider ce livreur."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSettle(userId: number) {
    setBusyId(userId);
    try {
      await settleLivreurBalance(userId);
      await refresh();
    } catch (e: any) {
      setError(livreurProfileErrorMessage(e, "Impossible de régler le solde de ce livreur."));
    } finally {
      setBusyId(null);
    }
  }

  const validated = items.filter((p) => p.verification_status === "VALIDATED");
  const pendingVisit = items.filter((p) => p.verification_status === "PENDING_VISIT");
  const blocked = items.filter((p) => p.is_blocked === 1);

  return (
    <div className="container-xxl py-4">
      <PageHeader
        title="Livreurs"
        subtitle={`${items.length} livreur(s) — validation après passage à l'agence`}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <KpiCard icon={Bike} label="Total livreurs" value={items.length} accent="blue" />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard icon={ShieldCheck} label="Validés" value={validated.length} accent="green" />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard
            icon={Clock3}
            label="En attente de passage"
            value={pendingVisit.length}
            accent="orange"
          />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard icon={Ban} label="Comptes bloqués" value={blocked.length} accent="neutral" />
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <div className="text-muted">Aucun livreur pour le moment.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Livreur</th>
                <th>Ville / Pays</th>
                <th>Pièce d'identité</th>
                <th>Photo</th>
                <th>Statut</th>
                <th>Solde dû</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.user_id}>
                  <td className="small">
                    <div className="fw-semibold">{p.first_name || "—"}</div>
                    <div className="text-muted">{formatPhoneDisplay(p.phone)}</div>
                  </td>
                  <td className="small">
                    {p.city || "—"} ({p.country_code})
                  </td>
                  <td className="small">
                    {p.id_document_url ? (
                      <a href={p.id_document_url} target="_blank" rel="noreferrer">
                        {p.id_document_type ? ID_DOC_LABEL[p.id_document_type] : "Voir"}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="small">
                    {p.photo_url ? (
                      <a href={p.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={p.photo_url}
                          alt="Photo livreur"
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: "cover",
                            borderRadius: "50%",
                          }}
                        />
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <span
                        className={`badge ${
                          p.verification_status === "VALIDATED"
                            ? "bg-success"
                            : "bg-warning text-dark"
                        }`}
                      >
                        {p.verification_status === "VALIDATED"
                          ? "Validé"
                          : "En attente de passage"}
                      </span>
                    </div>
                    {p.is_blocked === 1 && (
                      <span className="badge bg-danger mt-1">Bloqué</span>
                    )}
                  </td>
                  <td className="small">{moneyMAD(Number(p.pending_commission), 2)}</td>
                  <td>
                    <div className="d-flex flex-column gap-1 align-items-start">
                      {p.verification_status === "PENDING_VISIT" && (
                        <button
                          type="button"
                          className="btn btn-duu-green btn-sm"
                          disabled={busyId === p.user_id}
                          onClick={() => handleValidate(p.user_id)}
                        >
                          {busyId === p.user_id
                            ? "…"
                            : "Valider (passage agence effectué)"}
                        </button>
                      )}
                      {Number(p.pending_commission) > 0 && (
                        <button
                          type="button"
                          className="btn btn-duu-orange btn-sm"
                          disabled={busyId === p.user_id}
                          onClick={() => handleSettle(p.user_id)}
                        >
                          {busyId === p.user_id ? "…" : "Régler le solde"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
