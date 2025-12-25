// src/hooks/usePWAInstall.ts
import { useCallback, useEffect, useMemo, useState } from "react";

type BIPOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: BIPOutcome; platform: string }>;
};

function isStandalone() {
  // iOS + Android/desktop
  const iosStandalone =
    typeof navigator !== "undefined" && (navigator as any).standalone === true;

  const dmStandalone =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return iosStandalone || dmStandalone;
}

export function usePWAInstall() {
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  // état installé + listener appinstalled
  useEffect(() => {
    setInstalled(isStandalone());

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // capture beforeinstallprompt (Chrome/Android/Desktop)
  useEffect(() => {
    const onBIP = (e: Event) => {
      // ✅ si on empêche la bannière auto, on DOIT afficher plus tard via prompt()
      e.preventDefault();

      // certains navigateurs peuvent émettre plusieurs fois : on garde le dernier
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBIP as any);
    return () => window.removeEventListener("beforeinstallprompt", onBIP as any);
  }, []);

  const supportsPrompt = useMemo(() => !!deferredPrompt?.prompt, [deferredPrompt]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt?.prompt) {
      return { shown: false, outcome: null as BIPOutcome | null };
    }

    // ⚠️ l’event est “one-shot” : on le consomme et on l’efface avant prompt()
    const e = deferredPrompt;
    setDeferredPrompt(null);

    try {
      await e.prompt(); // ✅ affiche la bannière
      const choice = await e.userChoice;

      if (choice?.outcome === "accepted") {
        // appinstalled arrivera souvent après, mais on met déjà à jour
        setInstalled(true);
      }

      return { shown: true, outcome: choice?.outcome || "dismissed" };
    } catch {
      return { shown: false, outcome: null as BIPOutcome | null };
    }
  }, [deferredPrompt]);

  return { installed, supportsPrompt, promptInstall };
}
