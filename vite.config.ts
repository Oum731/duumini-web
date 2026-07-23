// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { compression } from "vite-plugin-compression2";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = (env.VITE_BASE && env.VITE_BASE.startsWith("/")) ? env.VITE_BASE : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",          // vérif d’update en arrière-plan
        manifest: false,                      // tu gardes ton manifest public/
        includeAssets: [
          "manifest.webmanifest",
          "icons/icon-192x192.png",
          "icons/icon-512x512.png",
          "favicon.ico",
          "robots.txt",
        ],
        workbox: {
          cleanupOutdatedCaches: true,        // supprime les vieux caches Workbox
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
          globPatterns: ["**/*.{js,css,html,ico,svg,webmanifest,woff2}"],
          // SPA fallback (mais on évite l’API et les assets versionnés)
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api\//, /\/admin\/api\//],
          // stratégies runtime
          runtimeCaching: [
            // Images en cache à la demande
            {
              urlPattern: /\.(?:png|jpg|jpeg|gif|webp|avif)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            // API : pas de précache, on veut du frais (offline -> fallback navigateur)
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "api",
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          clientsClaim: true,
          skipWaiting: false, // <- on laisse l’UX décider (voir code ci-dessous)
        },
        devOptions: { enabled: false },
      }),
      // Génère des .gz et .br à côté de chaque asset au build. Utile
      // uniquement si l'hébergeur sert ces fichiers pré-compressés
      // (Content-Encoding) — sinon la compression doit être activée
      // côté serveur/CDN directement (voir diagnostic perf).
      compression({ algorithms: ["gzip", "brotliCompress"] }),
    ],
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            router: ["react-router-dom"],
          },
        },
      },
    },
  };
});
