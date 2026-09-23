// src/components/ui/ImagePlaceholder.tsx
import type { CSSProperties } from "react";

/** Remplace une photo produit/boutique manquante — même traitement visuel
 * que les maquettes de la refonte (motif diagonal + légende), plutôt qu'un
 * cadre vide ou une icône générique. */
export function ImagePlaceholder({
  label = "Photo",
  className = "",
  style,
}: {
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`dz-placeholder ${className}`.trim()} style={style}>
      {label}
    </div>
  );
}
