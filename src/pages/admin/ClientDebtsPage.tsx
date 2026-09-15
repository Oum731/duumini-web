// src/pages/admin/ClientDebtsPage.tsx
import { useEffect, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import { formatPhoneDisplay } from "../../utils/phone";
import { listClientDebts, type ClientDebtRow } from "../../services/reports";

function clientWhatsappLink(phone: string, text: string) {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function ClientDebtsPage() {
  const [items, setItems] = useState<ClientDebtRow[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listClientDebts()
      .then((res) => {
        if (!mounted) return;
        setItems(res.items);
        setTotalDue(res.total_amount_due);
      })
      .catch((e: any) => {
        if (!mounted) return;
        const msg =
          e?.payload?.error || e?.data?.error || e?.message || "Impossible de charger les créances clients.";
        setError(msg);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Créances clients"
        subtitle="Clients avec un solde restant dû sur leurs commandes (paiement partiel ou non payé)."
      />

      {error ? (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}

      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard icon={Wallet} label="Total dû" value={moneyMAD(totalDue)} accent="orange" />
        </div>
        <div className="col-sm-4">
          <KpiCard icon={AlertTriangle} label="Clients concernés" value={items.length} accent="blue" />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Chargement des créances..." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th className="text-end">Commandes</th>
                <th className="text-end">Total commandé</th>
                <th className="text-end">Déjà payé</th>
                <th className="text-end">Reste dû</th>
                <th>Dernière commande</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => {
                const name = `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Client sans nom";
                const waHref = r.phone
                  ? clientWhatsappLink(
                      r.phone,
                      `Bonjour ${name}, un rappel concernant votre solde restant de ${moneyMAD(r.amount_due)} chez Duumini. Merci.`
                    )
                  : null;
                return (
                  <tr key={r.client_user_id ?? `guest-${i}`} className="table-warning">
                    <td>{name}</td>
                    <td>{r.phone ? formatPhoneDisplay(r.phone) : "—"}</td>
                    <td className="text-end">{r.orders_count}</td>
                    <td className="text-end">{moneyMAD(r.total_amount)}</td>
                    <td className="text-end">{moneyMAD(r.paid_amount)}</td>
                    <td className="text-end fw-bold text-danger">{moneyMAD(r.amount_due)}</td>
                    <td className="small text-muted">
                      {r.last_order_at ? new Date(r.last_order_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="text-end">
                      {waHref ? (
                        <a className="btn btn-outline-success btn-sm" href={waHref} target="_blank" rel="noreferrer">
                          Relancer
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    Aucune créance en cours. 🎉
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
