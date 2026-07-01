import { BarChart3 } from "lucide-react";
import { DUU, cardStyle, formatMoney, formatNumber } from "../shared";
import { SectionTitle, TinyBar } from "../components";
import { safeAffiliateName } from "../helpers";
import type { Affiliate } from "../types";

export function TopAffiliatesList({ topAffiliates }: { topAffiliates: Affiliate[] }) {
  return (
    <div className="p-3 p-lg-4 h-100" style={cardStyle()}>
      <SectionTitle
        icon={<BarChart3 size={20} />}
        title="Top affiliés"
        sub="Classement rapide par gains"
      />

      {topAffiliates.length === 0 ? (
        <div className="small" style={{ color: DUU.gray }}>
          Aucun affilié à afficher.
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {topAffiliates.map((item, idx) => (
            <div key={item.id}>
              <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: idx === 0 ? DUU.yellow : "rgba(17,17,17,0.06)",
                      color: DUU.black,
                      fontWeight: 800,
                      fontSize: ".85rem",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="fw-semibold" style={{ color: DUU.black }}>
                      {safeAffiliateName(item)}
                    </div>
                    <div className="small" style={{ color: DUU.gray }}>
                      {formatNumber(item.total_orders)} commande(s)
                    </div>
                  </div>
                </div>

                <div className="text-end">
                  <div className="fw-bold" style={{ color: DUU.black }}>
                    {formatMoney(item.total_earnings)}
                  </div>
                  <div className="small" style={{ color: DUU.gray }}>
                    {formatNumber(item.total_clicks)} clic(s)
                  </div>
                </div>
              </div>

              <TinyBar
                value={Number(item.total_earnings || 0)}
                max={Math.max(
                  1,
                  ...topAffiliates.map((x) => Number(x.total_earnings || 0)),
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
