import type { ReactNode } from "react";
import { DUU, cardStyle, formatNumber, type PageInfo } from "./shared";

export function SectionTitle({
  icon,
  title,
  sub,
  right,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
      <div className="d-flex align-items-start gap-3">
        <div
          className="d-inline-flex align-items-center justify-content-center"
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: DUU.yellowSoft,
            color: DUU.black,
            border: `1px solid ${DUU.yellowBorder}`,
          }}
        >
          {icon}
        </div>
        <div>
          <div className="fw-bold" style={{ color: DUU.black, fontSize: "1.15rem" }}>
            {title}
          </div>
          {sub ? <div className="small" style={{ color: DUU.gray }}>{sub}</div> : null}
        </div>
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className="h-100 p-3" style={cardStyle()}>
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="small mb-2" style={{ color: DUU.gray }}>
            {title}
          </div>
          <div
            className="fw-bold"
            style={{ color: DUU.black, fontSize: "1.55rem", lineHeight: 1.1 }}
          >
            {value}
          </div>
          {hint ? (
            <div className="small mt-2" style={{ color: DUU.gray }}>
              {hint}
            </div>
          ) : null}
        </div>

        <div
          className="d-inline-flex align-items-center justify-content-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: DUU.yellowSoft,
            border: `1px solid ${DUU.yellowBorder}`,
            color: DUU.black,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function TinyBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(8, (value / max) * 100) : 8;

  return (
    <div
      style={{
        width: "100%",
        height: 8,
        borderRadius: 999,
        background: "rgba(17,17,17,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, width)}%`,
          height: "100%",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${DUU.yellow} 0%, #F5B700 100%)`,
        }}
      />
    </div>
  );
}

export function PaginationBar({
  pageInfo,
  onChange,
}: {
  pageInfo: PageInfo;
  onChange: (page: number) => void;
}) {
  const totalItems = Number(pageInfo.totalItems ?? pageInfo.total ?? 0);
  if (!totalItems) return null;

  const page = pageInfo.page || 1;
  const totalPages = pageInfo.totalPages || 1;
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
      <div className="small" style={{ color: DUU.gray }}>
        Page {page} / {totalPages} — {formatNumber(totalItems)} élément(s)
      </div>

      <div className="btn-group">
        <button
          type="button"
          className="btn btn-sm"
          style={{ borderColor: DUU.line, color: DUU.black, background: DUU.white }}
          disabled={!pageInfo.hasPrevPage}
          onClick={() => onChange(page - 1)}
        >
          Précédent
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className="btn btn-sm"
            style={{
              borderColor: p === page ? DUU.black : DUU.line,
              background: p === page ? DUU.black : DUU.white,
              color: p === page ? DUU.yellow : DUU.black,
              fontWeight: 700,
            }}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          className="btn btn-sm"
          style={{ borderColor: DUU.line, color: DUU.black, background: DUU.white }}
          disabled={!pageInfo.hasNextPage}
          onClick={() => onChange(page + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

export function HistoryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const toneStyle =
    tone === "success"
      ? { background: DUU.greenSoft, color: DUU.green }
      : tone === "warning"
        ? { background: DUU.yellowSoft, color: "#8A6200" }
        : { background: DUU.blueSoft, color: DUU.black };

  return (
    <div
      className="px-3 py-2"
      style={{
        borderRadius: 14,
        ...toneStyle,
      }}
    >
      <div className="small" style={{ opacity: 0.8 }}>
        {label}
      </div>
      <div className="fw-bold">{value}</div>
    </div>
  );
}

export function InlineHistoryMetrics({
  clicks,
  orders,
  sales,
  pending,
  paid,
}: {
  clicks: ReactNode;
  orders: ReactNode;
  sales: ReactNode;
  pending: ReactNode;
  paid: ReactNode;
}) {
  const itemStyle = {
    minWidth: 110,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(17,17,17,0.04)",
    border: `1px solid ${DUU.line}`,
    flex: "1 1 110px",
  } as const;

  return (
    <div className="d-flex flex-wrap align-items-stretch gap-2">
      <div style={itemStyle}>
        <div className="small" style={{ color: DUU.gray }}>Clics</div>
        <div className="fw-bold" style={{ color: DUU.black }}>{clicks}</div>
      </div>

      <div style={itemStyle}>
        <div className="small" style={{ color: DUU.gray }}>Commandes</div>
        <div className="fw-bold" style={{ color: DUU.black }}>{orders}</div>
      </div>

      <div style={itemStyle}>
        <div className="small" style={{ color: DUU.gray }}>Ventes</div>
        <div className="fw-bold" style={{ color: DUU.black }}>{sales}</div>
      </div>

      <div
        style={{
          ...itemStyle,
          background: DUU.yellowSoft,
          border: `1px solid ${DUU.yellowBorder}`,
        }}
      >
        <div className="small" style={{ color: "#8A6200" }}>En attente</div>
        <div className="fw-bold" style={{ color: "#8A6200" }}>{pending}</div>
      </div>

      <div
        style={{
          ...itemStyle,
          background: DUU.greenSoft,
          border: `1px solid rgba(31,169,113,0.18)`,
        }}
      >
        <div className="small" style={{ color: DUU.green }}>Payé</div>
        <div className="fw-bold" style={{ color: DUU.green }}>{paid}</div>
      </div>
    </div>
  );
}
