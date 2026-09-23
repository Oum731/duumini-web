// src/components/ui/Badge.tsx
import type { HTMLAttributes } from "react";

export type BadgeVariant = "green" | "terracotta" | "neutral" | "red";

export function Badge({
  variant = "neutral",
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={`dz-badge dz-badge-${variant} ${className}`.trim()} {...rest} />;
}
