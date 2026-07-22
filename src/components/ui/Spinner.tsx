// src/components/ui/Spinner.tsx
type SpinnerSize = "xs" | "sm" | "md" | "lg";
type SpinnerColor = "orange" | "green" | "yellow" | "white" | "current";

export function Spinner({
  size = "md",
  color = "orange",
  className = "",
}: {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}) {
  return (
    <span
      className={`duu-spinner duu-spinner-${size} duu-spinner-${color} ${className}`}
      role="status"
      aria-hidden="true"
    />
  );
}

/** Bloc de chargement en ligne — remplace les `<div>Chargement…</div>` isolés. */
export function LoadingState({
  label = "Chargement…",
  size = "md",
  color = "orange",
  centered = true,
  className = "",
}: {
  label?: string;
  size?: SpinnerSize;
  color?: SpinnerColor;
  centered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`d-flex align-items-center gap-2 text-muted ${
        centered ? "justify-content-center py-4" : ""
      } ${className}`}
      role="status"
    >
      <Spinner size={size} color={color} />
      <span>{label}</span>
    </div>
  );
}

/** Chargement plein écran / pleine section (Suspense, changement de page). */
export function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center text-muted"
      style={{ minHeight: "40vh" }}
      role="status"
    >
      <Spinner size="lg" />
      <div className="mt-3">{label}</div>
    </div>
  );
}
