// src/components/ui/Card.tsx
import type { HTMLAttributes } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`dz-card ${className}`.trim()} {...rest} />;
}
