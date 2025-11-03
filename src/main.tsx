// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./theme.css";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";

// 👉 PWA: registre l’auto-update (vite-plugin-pwa)
import { registerSW } from "virtual:pwa-register";

// Petit helper: toast Bootstrap "Nouvelle version"
function showUpdateToast(onReload: () => void) {
  // Si Bootstrap n’est pas dispo, fallback prompt
  const bs = (window as any).bootstrap;
  if (!bs?.Toast) {
    if (confirm("Une nouvelle version de Duumini est disponible. Recharger maintenant ?")) {
      onReload();
    }
    return;
  }

  // Conteneur (une seule fois)
  let container = document.getElementById("pwa-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "pwa-toast-container";
    container.className = "position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = "1080";
    document.body.appendChild(container);
  }

  // Toast
  const el = document.createElement("div");
  el.className = "toast align-items-center text-bg-dark border-0";
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        Nouvelle version de <strong>Duumini</strong> disponible.
      </div>
      <div class="d-flex align-items-center gap-2 me-2">
        <button type="button" class="btn btn-light btn-sm" data-pwa-reload>Recharger</button>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fermer"></button>
      </div>
    </div>
  `;
  container.appendChild(el);

  el.querySelector<HTMLButtonElement>("[data-pwa-reload]")?.addEventListener("click", () => {
    onReload();
  });

  const toast = new bs.Toast(el, { autohide: false });
  toast.show();
}

// Enregistre le SW & gère l’update UX
const updateSW = registerSW({
  immediate: true, // installe le SW dès le premier chargement
  onNeedRefresh() {
    showUpdateToast(() => updateSW(true)); // -> skipWaiting + reload
  },
  onOfflineReady() {
    // Optionnel : console.log("Duumini prête hors-ligne");
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
