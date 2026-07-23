// src/components/admin/adminUI.tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";

type Accent = "orange" | "green" | "neutral" | "purple" | "blue";

function accentVars(accent: Accent) {
  if (accent === "green") {
    return { bg: "rgba(var(--duu-green-rgb), .12)", fg: "var(--duu-green)" };
  }
  if (accent === "neutral") {
    return { bg: "rgba(17,17,17,.06)", fg: "#111111" };
  }
  if (accent === "purple") {
    return { bg: "rgba(124, 92, 252, .14)", fg: "#7C5CFC" };
  }
  if (accent === "blue") {
    return { bg: "rgba(47, 111, 237, .14)", fg: "#2F6FED" };
  }
  return { bg: "rgba(var(--duu-orange-rgb), .14)", fg: "var(--duu-orange)" };
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-3 mb-sm-4">
      <div>
        <h1
          className="h4 mb-1 fw-bold"
          style={{ color: "#111111", letterSpacing: "-0.01em" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div className="text-muted" style={{ fontSize: "0.95rem" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div className="d-flex align-items-center gap-2 flex-wrap">{right}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  accent = "orange",
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: Accent;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { bg, fg } = accentVars(accent);
  return (
    <div
      className={`card h-100 border-0 ${className}`}
      style={{
        borderRadius: "var(--duu-radius-lg)",
        boxShadow: "var(--duu-shadow-sm)",
      }}
    >
      <div className="card-body p-3 p-sm-4">
        {(title || right) && (
          <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
              {Icon ? (
                <span
                  className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--duu-radius-md)",
                    background: bg,
                    color: fg,
                  }}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </span>
              ) : null}
              <div>
                {title ? (
                  <div className="fw-semibold" style={{ color: "#111111", fontSize: "1rem" }}>
                    {title}
                  </div>
                ) : null}
                {subtitle ? (
                  <div className="text-muted small">{subtitle}</div>
                ) : null}
              </div>
            </div>
            {right}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent = "orange",
  to,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  sublabel?: string;
  accent?: Accent;
  to?: string;
}) {
  const { bg, fg } = accentVars(accent);
  const content = (
    <div
      className="card h-100 border-0"
      style={{
        borderRadius: "var(--duu-radius-lg)",
        boxShadow: "var(--duu-shadow-sm)",
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
    >
      <div className="card-body p-3 p-sm-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="text-muted small text-truncate">{label}</div>
          {Icon ? (
            <span
              className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--duu-radius-md)",
                background: bg,
                color: fg,
              }}
            >
              <Icon size={16} strokeWidth={2.2} />
            </span>
          ) : null}
        </div>
        <div
          className="fw-bold text-truncate"
          style={{ color: "#111111", fontSize: "1.4rem", letterSpacing: "-0.01em" }}
        >
          {value}
        </div>
        {sublabel ? (
          <div className="text-muted small mt-1">{sublabel}</div>
        ) : null}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="text-decoration-none d-block h-100 admin-kpi-link">
        {content}
      </Link>
    );
  }
  return content;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-4 py-sm-5">
      {Icon ? (
        <div
          className="d-inline-flex align-items-center justify-content-center mb-3"
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--duu-radius-md)",
            background: "rgba(var(--duu-orange-rgb), .12)",
            color: "var(--duu-orange)",
          }}
        >
          <Icon size={24} strokeWidth={2} />
        </div>
      ) : null}
      <div className="fw-semibold" style={{ color: "#111111" }}>
        {title}
      </div>
      {description ? (
        <div className="text-muted small mt-1">{description}</div>
      ) : null}
    </div>
  );
}

/** Mini graphe sans axes, utilisé dans les cartes KPI. */
export function Sparkline({
  data,
  color = "var(--duu-orange)",
  height = 44,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const points = data.map((v, i) => ({ i, v }));
  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type PeriodOption = { value: string; label: string };

/**
 * Carte KPI "façon Dataflow" : badge icône coloré, sélecteur de période
 * optionnel, tendance optionnelle (jamais affichée sans donnée réelle),
 * grande valeur, mini sparkline en bas.
 */
export function KpiSparkCard({
  icon: Icon,
  accent = "orange",
  label,
  value,
  trendPercent,
  periodOptions,
  period,
  onPeriodChange,
  sparklineData,
  to,
  valueColor,
}: {
  icon: LucideIcon;
  accent?: Accent;
  label: string;
  value: ReactNode;
  /** Variation en % vs période précédente ; omettre si non calculable (pas de fausse donnée). */
  trendPercent?: number | null;
  periodOptions?: PeriodOption[];
  period?: string;
  onPeriodChange?: (value: string) => void;
  sparklineData?: number[];
  to?: string;
  /** Couleur explicite de la valeur (ex: solde négatif en rouge) ; sinon #111111. */
  valueColor?: string;
}) {
  const { bg, fg } = accentVars(accent);
  const hasTrend = typeof trendPercent === "number" && Number.isFinite(trendPercent);
  const trendUp = hasTrend && (trendPercent as number) >= 0;

  const card = (
    <div
      className="card h-100 border-0"
      style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
    >
      <div className="card-body p-3 p-sm-4">
        <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
          <span
            className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--duu-radius-md)",
              background: bg,
              color: fg,
            }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </span>

          {hasTrend ? (
            <span
              className="d-inline-flex align-items-center gap-1 px-2 py-1"
              style={{
                borderRadius: 999,
                fontSize: ".72rem",
                fontWeight: 700,
                background: trendUp ? "rgba(var(--duu-green-rgb), .12)" : "rgba(229,57,53,.12)",
                color: trendUp ? "var(--duu-green)" : "var(--duu-red)",
              }}
            >
              {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trendPercent as number).toFixed(2)}%
            </span>
          ) : null}

          {periodOptions && periodOptions.length > 0 ? (
            <select
              className="form-select form-select-sm"
              style={{ width: "auto", fontSize: ".78rem" }}
              value={period}
              onChange={(e) => onPeriodChange?.(e.target.value)}
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="text-muted small text-truncate mb-1">{label}</div>
        <div
          className="fw-bold text-truncate mb-2"
          style={{ color: valueColor || "#111111", fontSize: "1.4rem", letterSpacing: "-0.01em" }}
        >
          {value}
        </div>

        {sparklineData && sparklineData.length > 1 ? (
          <Sparkline data={sparklineData} color={fg} />
        ) : null}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="text-decoration-none d-block h-100 admin-kpi-link">
        {card}
      </Link>
    );
  }
  return card;
}

export type DonutSegment = { label: string; value: number; color: string };

/** Donut avec valeur centrale, façon "Promotional Sales" du modèle. */
export function DonutStat({
  centerLabel,
  centerValue,
  segments,
}: {
  centerLabel: string;
  centerValue: ReactNode;
  segments: DonutSegment[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);

  return (
    <div>
      <div style={{ position: "relative", width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {segments.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div className="text-muted small">{centerLabel}</div>
          <div className="fw-bold" style={{ fontSize: "1.3rem", color: "#111111" }}>
            {centerValue}
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-center gap-3 mt-2">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="d-flex align-items-center gap-2 small">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: s.color,
                  display: "inline-block",
                }}
              />
              <span className="text-muted">{s.label}</span>
              <span className="fw-semibold" style={{ color: "#111111" }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type RankedListItem = {
  id: string | number;
  thumb?: string | null;
  title: string;
  subtitle?: string;
  valueLabel: string;
  to?: string;
};

/** Liste classée avec vignette, façon "Top sale" du modèle. */
export function RankedList({ items }: { items: RankedListItem[] }) {
  if (items.length === 0) {
    return <div className="text-muted small">Aucune donnée pour le moment.</div>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {items.map((it) => {
        const row = (
          <div className="d-flex align-items-center gap-2">
            {it.thumb ? (
              <img
                src={it.thumb}
                alt=""
                width={38}
                height={38}
                className="rounded-3 flex-shrink-0"
                style={{ objectFit: "cover", background: "#f5f5f5" }}
              />
            ) : (
              <div
                className="rounded-3 flex-shrink-0 d-flex align-items-center justify-content-center"
                style={{
                  width: 38,
                  height: 38,
                  background: "rgba(var(--duu-orange-rgb), .12)",
                  color: "var(--duu-orange)",
                  fontWeight: 700,
                  fontSize: ".8rem",
                }}
              >
                {it.title.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-grow-1 text-truncate">
              <div className="text-truncate fw-semibold" style={{ color: "#111111", fontSize: ".88rem" }}>
                {it.title}
              </div>
              {it.subtitle ? (
                <div className="text-muted text-truncate" style={{ fontSize: ".78rem" }}>
                  {it.subtitle}
                </div>
              ) : null}
            </div>
            <div className="text-end flex-shrink-0" style={{ fontSize: ".82rem", fontWeight: 700, color: "#111111" }}>
              {it.valueLabel}
            </div>
          </div>
        );

        return it.to ? (
          <Link key={it.id} to={it.to} className="text-decoration-none">
            {row}
          </Link>
        ) : (
          <div key={it.id}>{row}</div>
        );
      })}
    </div>
  );
}

export type CountryBreakdownItem = { label: string; value: ReactNode; percent: number };

/** Répartition (Maroc / Côte d'Ivoire / …) avec barres, remplace la carte géo du modèle. */
export function CountryBreakdownList({ items }: { items: CountryBreakdownItem[] }) {
  if (items.length === 0) {
    return <div className="text-muted small">Aucune commande pour le moment.</div>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="fw-semibold" style={{ color: "#111111", fontSize: ".88rem" }}>
              {it.label}
            </span>
            <span className="text-muted small">{it.value}</span>
          </div>
          <div
            className="w-100"
            style={{ height: 8, borderRadius: 999, background: "rgba(17,17,17,.06)", overflow: "hidden" }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, it.percent))}%`,
                height: "100%",
                borderRadius: 999,
                background: "var(--duu-orange)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
