// src/services/push.ts
import Pushy from 'pushy-sdk-web';
import { api } from './http';

const APP_ID = import.meta.env.VITE_PUSHY_APP_ID as string;

export async function initPush(): Promise<string | null> {
  if (!APP_ID) {
    console.warn('[Push] VITE_PUSHY_APP_ID manquant');
    return null;
  }

  // Permission (idéalement sur geste utilisateur)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  // Enregistrement du SW unique PWA+Pushy
  if ('serviceWorker' in navigator) {
    // évite les doubles registrations en dev HMR
    const regs = await navigator.serviceWorker.getRegistrations();
    const already = regs.some(r => r.active?.scriptURL.includes('/service-worker.js'));
    if (!already) {
      await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    }
  }

  // Device Pushy → token
  const deviceToken = await Pushy.register({ appId: APP_ID });

  // Foreground
  Pushy.setNotificationListener((data: any) => {
    const title = data?.payload?.title || 'Duumini';
    const body  = data?.payload?.body  || '';
    // @ts-ignore — ton toast global
    window?.duuminiToast?.({ title, message: body });
  });

  return deviceToken;
}

export async function registerDeviceWithApi(deviceToken: string) {
  await api.post('/api/devices/register', {
    push_token: deviceToken,
    provider: 'pushy',
    platform: 'web',
  });
}

export async function unregisterDeviceFromApi() {
  try {
    await api.post('/api/devices/unregister', { provider: 'pushy' });
  } catch {}
}
