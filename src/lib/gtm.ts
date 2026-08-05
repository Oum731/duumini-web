// src/lib/gtm.ts
// Chargement paresseux de Google Tag Manager, sur le même modèle que
// loadMetaPixelOnce() dans metaPixel.ts. Auparavant injecté en dur dans
// index.html (donc avant même le montage de React et tout consentement) —
// déplacé ici pour n'être appelé qu'une fois le consentement "Mesure
// d'audience" accordé (voir consentStorage.ts / ConsentContext.tsx).
declare global {
  interface Window {
    dataLayer?: any[];
  }
}

const GTM_ID: string = (import.meta as any).env?.VITE_GTM_ID || "GTM-W28W9XJ3";

let injected = false;

export function loadGtmOnce() {
  if (typeof window === "undefined") return;
  if (!GTM_ID) return;
  if (injected) return;
  injected = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
}
