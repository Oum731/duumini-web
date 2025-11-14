// src/services/push.ts
import Pushy from "pushy-sdk-web";
import { api } from "./http";

const APP_ID = import.meta.env.VITE_PUSHY_APP_ID as string | undefined;

/**
 * Initialise Pushy côté web :
 * - demande la permission de notification
 * - enregistre le service worker /service-worker.js (PWA + Pushy)
 * - enregistre le device Pushy et renvoie le token
 */
export async function initPush(): Promise<string | null> {
  if (!APP_ID) {
    console.warn("[Push] VITE_PUSHY_APP_ID manquant");
    return null;
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("[Push] Notifications non supportées dans ce contexte");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  // Enregistrement du SW unique PWA + Pushy
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

  // Device Pushy → token
  const deviceToken = await Pushy.register({ appId: APP_ID });

  // Foreground : afficher un toast interne
  Pushy.setNotificationListener((data: any) => {
    const title = data?.payload?.title || "Duumini";
    const body = data?.payload?.body || "";
    // @ts-ignore — toast global défini dans ton HTML/app
    (window as any)?.duuminiToast?.({ title, message: body });
  });

  return deviceToken;
}

/**
 * Enregistre le device côté API (associe push_token ↔ user connecté)
 */
export async function registerDevice(push_token: string, provider = "pushy") {
  return api.post<{ ok: true }>("/api/devices", { push_token, provider });
}

/**
 * Alias pour compatibilité avec l'ancien nom utilisé dans EnableNotificationsButton
 */
export const registerDeviceWithApi = registerDevice;

/**
 * Désenregistre le device côté API.
 * - si push_token est fourni : supprime juste ce token
 * - sinon : supprime tous les devices de ce provider pour l'user
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
