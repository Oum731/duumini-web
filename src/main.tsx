// src/main.tsx
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

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

function MetaPageTracker() {
  const location = useLocation();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;

    if (lastTrackedRef.current === currentPath) return;
    lastTrackedRef.current = currentPath;

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [location]);

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
        <MetaPageTracker />
        <AuthProvider>
          <RealtimeProvider>
            <LocationProvider>
              <App />
            </LocationProvider>
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);