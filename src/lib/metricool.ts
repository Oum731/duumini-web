// src/lib/metricool.ts
declare global {
  interface Window {
    beTracker?: { t: (args: { hash: string }) => void };
  }
}

const METRICOOL_HASH = "a5a92e3aed658a4f3d4c3d6645b66a61";

/**
 * Metricool - Page view SPA
 * (le script be.js est chargé dans index.html)
 */
export function trackMetricoolPageView() {
  if (typeof window === "undefined") return;
  if (window.beTracker?.t) {
    window.beTracker.t({ hash: METRICOOL_HASH });
  }
}
