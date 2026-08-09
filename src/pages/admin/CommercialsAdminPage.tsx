// src/pages/admin/CommercialsAdminPage.tsx
import { useEffect, useState } from "react";
import { Users, TrendingUp, Wallet } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import { formatPhoneDisplay } from "../../utils/phone";
import { useRealtime } from "../../context/RealtimeContext";
import {
  listCommercialProfiles,
  getCommercialPortfolio,
  updateCommercialRate,
  settleCommercialBalance,
  commercialProfileErrorMessage,
  type AdminCommercialProfile,
  type CommercialPortfolioClient,
} from "../../services/commercialProfiles";

export default function CommercialsAdminPage() {
  const { socket } = useRealtime();
  const [items, setItems] = useState<AdminCommercialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [rateDrafts, setRateDrafts] = useState<Record<number, string>>({});

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<CommercialPortfolioClient[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listCommercialProfiles();
      setItems(res.items);
    } catch (e: any) {
      setError(commercialProfileErrorMessage(e, "Impossible de charger les commerciaux."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // ✅ Rafraîchit automatiquement le classement (et le portefeuille ouvert,
  // le cas échéant) dès qu'une vente est rattachée à un commercial — sans
  // ça il fallait recharger la page à la main pour voir apparaître une
  // commande fraîchement déclarée. Le backend émet ce même event WS
  // "notify"/ORDER_CREATED côté admin depuis longtemps (voir
  // emitOrderCreatedRealtimeWSOnly, orders.js) ; on se contente de
  // l'écouter ici, aucun nouvel event à créer côté serveur.
  useEffect(() => {
    if (!socket) return;
    function onNotify(data: { type?: string; commercial_id?: number | null }) {
      if (data?.type !== "ORDER_CREATED") return;
      refresh();
      if (data.commercial_id && expandedId === data.commercial_id) {
        loadPortfolio(data.commercial_id);
      }
    }
    socket.on("notify", onNotify);
    return () => {
      socket.off("notify", onNotify);
    };
  }, [socket, expandedId]);

  async function handleSettle(userId: number) {
    setBusyId(userId);
    try {
      await settleCommercialBalance(userId);
      await refresh();
    } catch (e: any) {
      setError(commercialProfileErrorMessage(e, "Impossible de confirmer le versement de la commission."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveRate(userId: number) {
    const raw = rateDrafts[userId];
    const pct = Number(raw);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Le taux de commission doit être entre 0 et 100%.");
      return;
    }
    setBusyId(userId);
    try {
      await updateCommercialRate(userId, pct / 100);
      setRateDrafts((d) => {
        const next = { ...d };
        delete next[userId];
        return next;
      });
      await refresh();
    } catch (e: any) {
      setError(commercialProfileErrorMessage(e, "Impossible de mettre à jour le taux."));
    } finally {
      setBusyId(null);
    }
  }

  async function loadPortfolio(userId: number) {
    setPortfolioLoading(true);
    try {
      const res = await getCommercialPortfolio(userId);
      setPortfolio(res.items);
    } catch (e: any) {
      setError(commercialProfileErrorMessage(e, "Impossible de charger le portefeuille."));
    } finally {
      setPortfolioLoading(false);
    }
  }

  async function toggleExpand(userId: number) {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    await loadPortfolio(userId);
  }

  const totalRevenue = items.reduce((s, p) => s + p.revenue_month, 0);
  const totalDue = items.reduce((s, p) => s + p.pending_commission, 0);

  return (
    <div className="container-xxl py-4">
      <PageHeader
        title="Commerciaux"
        subtitle={`${items.length} commercial(aux) — classement par CA du mois`}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4">
          <KpiCard icon={Users} label="Commerciaux" value={items.length} accent="blue" />
        </div>
        <div className="col-6 col-md-4">
          <KpiCard
            icon={TrendingUp}
            label="CA total du mois"
            value={moneyMAD(totalRevenue)}
            accent="green"
          />
        </div>
        <div className="col-6 col-md-4">
          <KpiCard
            icon={Wallet}
            label="Commissions à verser"
            value={moneyMAD(totalDue)}
            accent="orange"
          />
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <div className="text-muted">Aucun commercial pour le moment.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Commercial</th>
                <th>CA du mois</th>
                <th>Commandes</th>
                <th>Clients</th>
                <th>Taux commission</th>
                <th>Commission à verser</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <>
                  <tr key={p.user_id} className="row-click" onClick={() => toggleExpand(p.user_id)}>
                    <td className="small">
                      <div className="fw-semibold">
                        {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-muted">{formatPhoneDisplay(p.phone)}</div>
                    </td>
                    <td className="fw-semibold">{moneyMAD(p.revenue_month)}</td>
                    <td>{p.orders_month}</td>
                    <td>{p.clients_month}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex align-items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          className="form-control form-control-sm"
                          style={{ width: 80 }}
                          value={
                            rateDrafts[p.user_id] ?? (p.commission_rate * 100).toFixed(1)
                          }
                          onChange={(e) =>
                            setRateDrafts((d) => ({ ...d, [p.user_id]: e.target.value }))
                          }
                        />
                        <span className="small text-muted">%</span>
                        {rateDrafts[p.user_id] !== undefined && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark"
                            disabled={busyId === p.user_id}
                            onClick={() => handleSaveRate(p.user_id)}
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="small">{moneyMAD(p.pending_commission)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {p.pending_commission > 0 && (
                        <button
                          type="button"
                          className="btn btn-duu-orange btn-sm"
                          disabled={busyId === p.user_id}
                          onClick={() => handleSettle(p.user_id)}
                          title="C'est DUUMINI qui verse cette commission au commercial (pourcentage de ses ventes) — cliquer une fois le virement/paiement effectué."
                        >
                          {busyId === p.user_id ? "…" : "Confirmer le versement"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === p.user_id && (
                    <tr key={`${p.user_id}-portfolio`}>
                      <td colSpan={7} className="bg-light">
                        {portfolioLoading ? (
                          <LoadingState size="sm" />
                        ) : portfolio.length === 0 ? (
                          <div className="text-muted small py-2">Aucun client pour le moment.</div>
                        ) : (
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr>
                                <th>Client</th>
                                <th>Téléphone</th>
                                <th>Commandes</th>
                                <th>CA généré</th>
                                <th>Dernière commande</th>
                              </tr>
                            </thead>
                            <tbody>
                              {portfolio.map((c, i) => (
                                <tr key={c.client_user_id ?? i}>
                                  <td className="small">
                                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                                  </td>
                                  <td className="small">{formatPhoneDisplay(c.phone || "")}</td>
                                  <td className="small">{c.orders_count}</td>
                                  <td className="small">{moneyMAD(c.revenue_total)}</td>
                                  <td className="small">
                                    {new Date(c.last_order_at).toLocaleDateString("fr-FR")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
