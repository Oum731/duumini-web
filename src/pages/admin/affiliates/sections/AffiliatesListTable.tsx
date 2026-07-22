import { Eye, UserRound } from "lucide-react";
import { DUU, cardStyle, formatMoney, formatNumber, statusBadgeClass, type PageInfo } from "../shared";
import { SectionTitle, TinyBar, PaginationBar } from "../components";
import { safeAffiliateName, getPageTotal } from "../helpers";
import type { Affiliate } from "../types";
import { formatPhoneDisplay } from "../../../../utils/phone";
import { LoadingState } from "../../../../components/ui/Spinner";

export function AffiliatesListTable({
  loading,
  items,
  pageInfo,
  maxClicks,
  onSelectAffiliate,
  onEdit,
  onToggleStatus,
  onPageChange,
}: {
  loading: boolean;
  items: Affiliate[];
  pageInfo: PageInfo;
  maxClicks: number;
  onSelectAffiliate: (item: Affiliate) => void;
  onEdit: (item: Affiliate) => void;
  onToggleStatus: (item: Affiliate) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div style={cardStyle()}>
      <div className="p-3 p-lg-4 border-bottom" style={{ borderColor: DUU.line }}>
        <SectionTitle
          icon={<UserRound size={20} />}
          title="Liste des affiliés"
          sub={`${formatNumber(getPageTotal(pageInfo))} résultat(s)`}
        />
      </div>

      <div className="p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: DUU.yellowSoft }}>
                <th className="border-0 px-3 py-3">Affilié</th>
                <th className="border-0 px-3 py-3">Code / slug</th>
                <th className="border-0 px-3 py-3">Trafic</th>
                <th className="border-0 px-3 py-3">Gains</th>
                <th className="border-0 px-3 py-3">Statut</th>
                <th className="border-0 px-3 py-3 text-end">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5" style={{ color: DUU.gray }}>
                    Aucun affilié trouvé.
                  </td>
                </tr>
              ) : null}

              {items.map((item) => {
                const badge = statusBadgeClass(item.status);

                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3" style={{ minWidth: 220 }}>
                      <div className="fw-semibold" style={{ color: DUU.black }}>
                        {safeAffiliateName(item)}
                      </div>
                      <div className="small" style={{ color: DUU.gray }}>
                        {formatPhoneDisplay(item.phone || item.user?.phone) || "-"}
                      </div>
                      <div className="small" style={{ color: DUU.gray }}>
                        user_id: {item.user_id ?? "-"}
                      </div>
                    </td>

                    <td className="px-3 py-3" style={{ minWidth: 190 }}>
                      <div
                        className="d-inline-flex px-2 py-1"
                        style={{
                          borderRadius: 10,
                          background: "rgba(17,17,17,0.06)",
                          color: DUU.black,
                          fontWeight: 700,
                        }}
                      >
                        {item.affiliate_code || "-"}
                      </div>
                      <div className="small mt-1" style={{ color: DUU.gray }}>
                        {item.referral_slug ? `/ref/${item.referral_slug}` : "-"}
                      </div>
                    </td>

                    <td className="px-3 py-3" style={{ minWidth: 180 }}>
                      <div className="small mb-1" style={{ color: DUU.black }}>
                        {formatNumber(item.total_clicks)} clic(s)
                      </div>
                      <TinyBar value={Number(item.total_clicks || 0)} max={maxClicks} />
                      <div className="small mt-1" style={{ color: DUU.gray }}>
                        {formatNumber(item.total_orders)} commande(s)
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="fw-bold" style={{ color: DUU.black }}>
                        {formatMoney(item.total_earnings)}
                      </div>
                      <div className="small" style={{ color: DUU.gray }}>
                        taux {Number(item.commission_rate || 0)}%
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className="px-3 py-2 d-inline-flex"
                        style={{
                          borderRadius: 999,
                          fontSize: ".82rem",
                          fontWeight: 800,
                          ...badge,
                        }}
                      >
                        {item.status === "ACTIVE" ? "Actif" : "Inactif"}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-end" style={{ minWidth: 250 }}>
                      <div className="d-flex justify-content-end flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: DUU.black,
                            color: DUU.yellow,
                            borderRadius: 12,
                            fontWeight: 700,
                          }}
                          onClick={() => onSelectAffiliate(item)}
                        >
                          <Eye size={15} className="me-1" />
                          Voir
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: DUU.white,
                            color: DUU.black,
                            border: `1px solid ${DUU.line}`,
                            borderRadius: 12,
                            fontWeight: 700,
                          }}
                          onClick={() => onEdit(item)}
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background:
                              item.status === "ACTIVE"
                                ? "rgba(107,114,128,0.10)"
                                : "rgba(31,169,113,0.12)",
                            color: item.status === "ACTIVE" ? "#4B5563" : DUU.green,
                            border: `1px solid ${DUU.line}`,
                            borderRadius: 12,
                            fontWeight: 700,
                          }}
                          onClick={() => onToggleStatus(item)}
                        >
                          {item.status === "ACTIVE" ? "Désactiver" : "Activer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5" style={{ color: DUU.gray }}>
                    <LoadingState centered />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar pageInfo={pageInfo} onChange={onPageChange} />
    </div>
  );
}
