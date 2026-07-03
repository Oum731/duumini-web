// src/components/admin/adminUI.tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

type Accent = "orange" | "green" | "neutral";

function accentVars(accent: Accent) {
  if (accent === "green") {
    return { bg: "rgba(var(--duu-green-rgb), .12)", fg: "var(--duu-green)" };
  }
  if (accent === "neutral") {
    return { bg: "rgba(17,17,17,.06)", fg: "#111111" };
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
