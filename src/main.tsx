import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import "./theme.css";

import App from "./App";

import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { LocationProvider } from "./context/LocationContext";
import { CompanyProvider } from "./context/CompanyContext";
import { ConsentProvider } from "./context/ConsentContext";
import { VisitorPreferencesProvider } from "./context/VisitorPreferencesContext";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { initAffiliateTracking } from "./services/affiliateTracking";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 20 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function AffiliateTrackerBootstrap() {
  const location = useLocation();
  const lastTrackedRef = useRef("");

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;

    if (lastTrackedRef.current === currentPath) return;

    lastTrackedRef.current = currentPath;

    initAffiliateTracking(undefined, {
      source: "WEB_REF",
      trackClick: false,
      removeFromUrl: false,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AffiliateTrackerBootstrap />

        <ConsentProvider>
          <AuthProvider>
            <RealtimeProvider>
              <LocationProvider>
                <CompanyProvider>
                  <VisitorPreferencesProvider>
                    <App />
                  </VisitorPreferencesProvider>
                </CompanyProvider>
              </LocationProvider>
            </RealtimeProvider>
          </AuthProvider>
        </ConsentProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);