// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./theme.css";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";

import { registerSW } from "virtual:pwa-register";

/* =========
 * PWA + actualisation auto (une seule fois quand nouvelle version dispo)
 * ========= */

// flag interne pour savoir qu’une nouvelle version est prête
let refreshPending = false;

const updateSW = registerSW({
  immediate: true, // SW chargé dès le début
  onNeedRefresh() {
    // 👉 Une nouvelle version du service worker est prête
    // On marque juste le flag et on recharge une seule fois.
    if (!refreshPending) {
      refreshPending = true;
      // on déclenche directement la mise à jour + reload
      updateSW(true); // true = recharge la page après update
    }
  },
  onOfflineReady() {
    // pas de toast, juste prêt hors-ligne
    // console.log("[PWA] Offline ready");
  },
});

// ❌ Plus de setInterval → plus de reload périodique

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <RealtimeProvider>
          <App />
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
