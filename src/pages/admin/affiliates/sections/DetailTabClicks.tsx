import { DUU, formatDate, type PageInfo } from "../shared";
import { PaginationBar } from "../components";
import type { AffiliateClick } from "../types";

export function DetailTabClicks({
  clickItems,
  clickPageInfo,
  onPageChange,
}: {
  clickItems: AffiliateClick[];
  clickPageInfo: PageInfo;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      <div className="d-flex flex-column gap-2">
        {clickItems.length === 0 ? (
          <div className="small" style={{ color: DUU.gray }}>
            Aucun clic.
          </div>
        ) : (
          clickItems.map((row) => (
            <div
              key={row.id}
              className="p-3"
              style={{
                borderRadius: 18,
                border: `1px solid ${DUU.line}`,
                background: DUU.white,
              }}
            >
              <div className="fw-semibold mb-1" style={{ color: DUU.black }}>
                Clic #{row.id}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Code: {row.affiliate_code || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Produit: {row.product_id ?? "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Source: {row.source || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Device: {row.device || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                IP: {row.ip_address || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Landing: {row.landing_url || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Référent: {row.referer_url || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Date: {formatDate(row.created_at)}
              </div>
            </div>
          ))
        )}
      </div>

      <PaginationBar pageInfo={clickPageInfo} onChange={onPageChange} />
    </>
  );
}
