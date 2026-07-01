import { History, Plus, RefreshCw, Search, Settings2 } from "lucide-react";
import type { RevenuePeriod } from "../../../../services/affiliates";
import { DUU, cardStyle } from "../shared";
import { SectionTitle } from "../components";

export function FiltersBar({
  loading,
  qInput,
  statusFilter,
  globalPeriod,
  pageSize,
  onQInputChange,
  onStatusFilterChange,
  onGlobalPeriodChange,
  onPageSizeChange,
  onSubmitSearch,
  onReset,
  onRefresh,
  onRebuildReports,
  onCreateClick,
}: {
  loading: boolean;
  qInput: string;
  statusFilter: string;
  globalPeriod: RevenuePeriod;
  pageSize: number;
  onQInputChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onGlobalPeriodChange: (value: RevenuePeriod) => void;
  onPageSizeChange: (value: number) => void;
  onSubmitSearch: () => void;
  onReset: () => void;
  onRefresh: () => void;
  onRebuildReports: () => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="p-3 p-lg-4" style={cardStyle()}>
      <SectionTitle
        icon={<Settings2 size={20} />}
        title="Filtres et actions"
        sub="Recherche, statut, période, pagination et création rapide"
        right={
          <div className="d-flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn"
              style={{
                background: DUU.white,
                color: DUU.black,
                border: `1px solid ${DUU.line}`,
                borderRadius: 14,
                fontWeight: 700,
              }}
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw size={16} className="me-2" />
              {loading ? "Chargement..." : "Actualiser"}
            </button>

            <button
              type="button"
              className="btn"
              style={{
                background: DUU.white,
                color: DUU.black,
                border: `1px solid ${DUU.line}`,
                borderRadius: 14,
                fontWeight: 700,
              }}
              onClick={onRebuildReports}
            >
              <History size={16} className="me-2" />
              Recalculer rapports
            </button>

            <button
              type="button"
              className="btn"
              style={{
                background: DUU.yellow,
                color: DUU.black,
                border: `1px solid ${DUU.yellow}`,
                borderRadius: 14,
                fontWeight: 800,
              }}
              onClick={onCreateClick}
            >
              <Plus size={16} className="me-2" />
              Nouvel affilié
            </button>
          </div>
        }
      />

      <form
        className="row g-3 align-items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitSearch();
        }}
      >
        <div className="col-12 col-lg-4">
          <label className="form-label fw-semibold">Recherche</label>
          <div className="position-relative">
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: DUU.gray,
              }}
            />
            <input
              type="text"
              className="form-control"
              style={{
                paddingLeft: 40,
                borderRadius: 16,
                borderColor: DUU.line,
                minHeight: 48,
              }}
              placeholder="Code, slug, nom, téléphone, user_id..."
              value={qInput}
              onChange={(e) => onQInputChange(e.target.value)}
            />
          </div>
        </div>

        <div className="col-12 col-md-4 col-lg-2">
          <label className="form-label fw-semibold">Statut</label>
          <select
            className="form-select"
            style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="INACTIVE">Inactifs</option>
          </select>
        </div>

        <div className="col-12 col-md-4 col-lg-2">
          <label className="form-label fw-semibold">Période revenus</label>
          <select
            className="form-select"
            style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
            value={globalPeriod}
            onChange={(e) => onGlobalPeriodChange(e.target.value as RevenuePeriod)}
          >
            <option value="DAY">Jour</option>
            <option value="WEEK">Semaine</option>
            <option value="MONTH">Mois</option>
            <option value="YEAR">Année</option>
          </select>
        </div>

        <div className="col-12 col-md-4 col-lg-2">
          <label className="form-label fw-semibold">Taille page</label>
          <select
            className="form-select"
            style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) || 10)}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="col-6 col-lg-1">
          <button
            type="submit"
            className="btn w-100"
            style={{
              minHeight: 48,
              background: DUU.black,
              color: DUU.yellow,
              borderRadius: 16,
              fontWeight: 800,
            }}
          >
            Go
          </button>
        </div>

        <div className="col-6 col-lg-1">
          <button
            type="button"
            className="btn w-100"
            style={{
              minHeight: 48,
              background: DUU.white,
              color: DUU.black,
              border: `1px solid ${DUU.line}`,
              borderRadius: 16,
              fontWeight: 700,
            }}
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
