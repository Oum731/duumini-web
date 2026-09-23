// src/components/ui/dzClass.ts
// Classes du nouveau design system (2026), séparées des composants React
// (voir Button.tsx) pour rester compatibles avec React Fast Refresh — un
// fichier de composant ne doit exporter que des composants.
export type ButtonVariant = "primary" | "outline";

/** Classe du bouton `.dz-btn` — utilisable directement sur un <Link>. */
export function btnClass(variant: ButtonVariant = "primary", extra = "") {
  return `dz-btn dz-btn-${variant} ${extra}`.trim();
}
