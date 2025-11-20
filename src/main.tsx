// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./theme.css";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext"; // ✅

import { registerSW } from "virtual:pwa-register";

// ⚠️ Ancien toast conservé mais NON utilisé (tu peux le supprimer si tu veux)

/* =========
 * PWA + actualisation auto silencieuse
 * ========= */

// flag interne pour savoir qu’une nouvelle version est prête
let refreshPending = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 👉 Une nouvelle version du service worker est prête
    // On ne montre PAS de toast, on déclenche juste un flag.
    refreshPending = true;
  },
  onOfflineReady() {
    // rien de visible, tu peux loguer si tu veux
    // console.log("[PWA] Offline ready");
  },
});

// ⏱️ Vérifie toutes les 20 secondes si une MAJ est prête, et recharge silencieusement
if (typeof window !== "undefined") {
  window.setInterval(() => {
    if (refreshPending) {
      // recharge l’app avec la nouvelle version, sans popup
      updateSW(true);
      refreshPending = false;
    }
  }, 20_000); // 20 secondes (tu peux mettre 10_000 pour 10s)
}

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
