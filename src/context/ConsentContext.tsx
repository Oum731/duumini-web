// src/context/ConsentContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readConsent,
  writeConsent,
  type ConsentCategories,
  type ConsentMethod,
} from "../lib/consentStorage";
import { loadGtmOnce } from "../lib/gtm";
import { loadMetricoolOnce } from "../lib/metricool";
import { metaPageView } from "../lib/metaPixel";

const DEFAULT_CATEGORIES: ConsentCategories = {
  essential: true,
  audience: false,
  marketing: false,
};

type ConsentContextType = {
  hasDecided: boolean;
  categories: ConsentCategories;
  acceptAll: () => void;
  rejectAll: () => void;
  setCategories: (partial: Partial<Pick<ConsentCategories, "audience" | "marketing">>) => void;
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const ConsentContext = createContext<ConsentContextType | null>(null);

/** Déclenche les chargeurs des traceurs autorisés par `categories`. */
function applyConsent(categories: ConsentCategories) {
  if (categories.audience) {
    loadGtmOnce();
    loadMetricoolOnce();
  }
  if (categories.marketing) {
    // Fait démarrer le suivi Meta immédiatement (sinon il faudrait attendre
    // le prochain changement de route pour que PageViewTracker le fasse).
    metaPageView(window.location.pathname);
  }
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState(() => readConsent());
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Visiteur revenant avec un consentement déjà accordé : déclenche les
  // traceurs autorisés dès le boot, sans attendre une interaction.
  useEffect(() => {
    if (stored) applyConsent(stored.categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (categories: Omit<ConsentCategories, "essential">, method: ConsentMethod) => {
      const next = writeConsent(categories, method);
      setStored(next);
      applyConsent(next.categories);
      setIsPanelOpen(false);
    },
    []
  );

  const acceptAll = useCallback(() => {
    commit({ audience: true, marketing: true }, "accept_all");
  }, [commit]);

  const rejectAll = useCallback(() => {
    commit({ audience: false, marketing: false }, "reject_all");
  }, [commit]);

  const setCategories = useCallback(
    (partial: Partial<Pick<ConsentCategories, "audience" | "marketing">>) => {
      const base = stored?.categories || DEFAULT_CATEGORIES;
      commit(
        {
          audience: partial.audience ?? base.audience,
          marketing: partial.marketing ?? base.marketing,
        },
        "custom"
      );
    },
    [stored, commit]
  );

  const value = useMemo<ConsentContextType>(
    () => ({
      hasDecided: !!stored,
      categories: stored?.categories || DEFAULT_CATEGORIES,
      acceptAll,
      rejectAll,
      setCategories,
      isPanelOpen,
      openPanel: () => setIsPanelOpen(true),
      closePanel: () => setIsPanelOpen(false),
    }),
    [stored, acceptAll, rejectAll, setCategories, isPanelOpen]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextType {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent() doit être utilisé sous <ConsentProvider>");
  return ctx;
}
