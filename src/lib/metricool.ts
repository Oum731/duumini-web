// src/lib/metricool.ts
declare global {
  interface Window {
    beTracker?: { t: (args: { hash: string }) => void };
  }
}

import { readConsentCategories } from "./consentStorage";

const METRICOOL_HASH = "a5a92e3aed658a4f3d4c3d6645b66a61";

let injected = false;

/**
 * Charge le script Metricool + le beacon image une seule fois. Reprend
 * exactement ce qui était en dur dans index.html — déplacé ici pour
 * n'être injecté qu'une fois le consentement "Mesure d'audience" accordé.
 */
export function loadMetricoolOnce() {
  if (typeof window === "undefined") return;
  if (injected) return;
  injected = true;

  const img = document.createElement("img");
  img.src = `https://tracker.metricool.com/c3po.jpg?hash=${METRICOOL_HASH}`;
  img.alt = "";
  img.style.display = "none";
  document.head.appendChild(img);

  const s = document.createElement("script");
  s.src = "https://tracker.metricool.com/resources/be.js";
  s.async = true;
  s.onload = () => {
    window.beTracker?.t({ hash: METRICOOL_HASH });
  };
  document.head.appendChild(s);
}

/**
 * Page view SPA — ne fait rien tant que le consentement "audience" n'est
 * pas accordé.
 */
export function trackMetricoolPageView() {
  if (typeof window === "undefined") return;
  if (!readConsentCategories().audience) return;

  loadMetricoolOnce();
  if (window.beTracker?.t) {
    window.beTracker.t({ hash: METRICOOL_HASH });
  }
}
