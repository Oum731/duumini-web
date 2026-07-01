import { DUU, formatDate } from "../shared";
import type { Affiliate } from "../types";

export function DetailTabOverview({ selectedAffiliate }: { selectedAffiliate: Affiliate }) {
  return (
    <div className="small">
      <div className="d-flex justify-content-between py-2 border-bottom">
        <span style={{ color: DUU.gray }}>Créé le</span>
        <span style={{ color: DUU.black }}>
          {formatDate(selectedAffiliate.created_at)}
        </span>
      </div>
      <div className="d-flex justify-content-between py-2 border-bottom">
        <span style={{ color: DUU.gray }}>Mis à jour</span>
        <span style={{ color: DUU.black }}>
          {formatDate(selectedAffiliate.updated_at)}
        </span>
      </div>
      <div className="d-flex justify-content-between py-2 border-bottom gap-3">
        <span style={{ color: DUU.gray }}>Lien code</span>
        <span className="text-truncate text-end" style={{ color: DUU.black, maxWidth: 180 }}>
          {selectedAffiliate.share_url_by_code || "-"}
        </span>
      </div>
      <div className="d-flex justify-content-between py-2 border-bottom gap-3">
        <span style={{ color: DUU.gray }}>Lien slug</span>
        <span className="text-truncate text-end" style={{ color: DUU.black, maxWidth: 180 }}>
          {selectedAffiliate.share_url_by_slug || "-"}
        </span>
      </div>
      <div className="d-flex justify-content-between py-2 gap-3">
        <span style={{ color: DUU.gray }}>Commission</span>
        <span style={{ color: DUU.black }}>
          {Number(selectedAffiliate.commission_rate || 0)}%
        </span>
      </div>
    </div>
  );
}
