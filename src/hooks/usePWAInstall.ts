// src/hooks/usePWAInstall.ts
import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function usePWAInstall() {
  const [supportsPrompt, setSupportsPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);

  // detect installé (Chrome) : display-mode ou related apps
  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(isStandalone);

    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // capture beforeinstallprompt (Android/Chrome)
  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setSupportsPrompt(true);
      try {
        // facultatif : analytics "eligible"
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", onBIP as any);
    return () => window.removeEventListener("beforeinstallprompt", onBIP as any);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { shown: false, outcome: null as any };
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);            // le prompt ne peut être montré qu’une fois
    setSupportsPrompt(false);
    return { shown: true, outcome: choice.outcome };
  }, [deferredPrompt]);

  return {
    installed,
    supportsPrompt,
    promptInstall,
  };
}
