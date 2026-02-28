// src/services/push.ts
import Pushy from "pushy-sdk-web";
import { api } from "./http";

const APP_ID = import.meta.env.VITE_PUSHY_APP_ID as string | undefined;

let pushyInitialized = false;

/**
 * Initialise Pushy côté web :
 * - demande permission
 * - enregistre le service worker unique
 * - enregistre le device
 */
export async function initPush(): Promise<string | null> {
  try {
    if (!APP_ID) {
      console.warn("[Push] VITE_PUSHY_APP_ID manquant");
      return null;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return null;
    }

    if (Notification.permission === "denied") return null;

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") return null;

    // ✅ Enregistrer le Service Worker UNE seule fois
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      const already = regs.some((r) =>
        r.active?.scriptURL.includes("/service-worker.js")
      );

      if (!already) {
        await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
        });
      }
    }

    // ✅ Enregistrer le device Pushy
    const deviceToken = await Pushy.register({ appId: APP_ID });

    // ✅ Listener une seule fois
    if (!pushyInitialized) {
      Pushy.setNotificationListener((data: any) => {
        const title =
          data?.notification?.title ||
          data?.payload?.title ||
          "Duumini";

        const body =
          data?.notification?.body ||
          data?.payload?.body ||
          "";

        // Toast interne
        (window as any)?.duuminiToast?.({
          title,
          message: body,
        });
      });

      pushyInitialized = true;
    }

    return deviceToken;
  } catch (e) {
    console.error("[Push] initPush error", e);
    return null;
  }
}

/**
 * Enregistre le device côté API
 */
export async function registerDevice(push_token: string, provider = "pushy") {
  if (!push_token) return;

  return api.post<{ ok: true }>("/api/devices", {
    push_token,
    provider,
  });
}

export const registerDeviceWithApi = registerDevice;

/**
 * Désenregistre device
 */
export async function unregisterDevice(
  push_token?: string,
  provider = "pushy"
) {
  return api.post<{ ok: true }>("/api/devices/unregister", {
    push_token,
    provider,
  });
}

/**
 * Helper complet
 */
export async function enablePushForCurrentUser(): Promise<string | null> {
  const token = await initPush();
  if (!token) return null;

  try {
    await registerDevice(token, "pushy");
  } catch (e) {
    console.error("[Push] registerDevice error", e);
  }

  return token;
}