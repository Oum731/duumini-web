// src/context/VisitorPreferencesContext.tsx
// Contexte séparé de LocationContext.tsx (qui gère déjà la ville, avec sa
// propre logique GPS/IP/profil bien rodée — pas touché ici pour ne pas
// risquer de régression). Celui-ci ne gère qu'une seule préférence
// supplémentaire : la verticale préférée (Market/Food/Fashion), détectée
// passivement selon la navigation, pour personnaliser l'accueil plus tard.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

export type Vertical = "market" | "food" | "fashion";
type Source = "manual" | "inferred";

const STORAGE_KEY = "duumini:visitorPrefs:v1";
const INFER_THRESHOLD = 2; // visites sur une verticale avant auto-détection

type Stored = {
  preferredVertical: Vertical | null;
  source: Source | null;
  visitCounts: Record<Vertical, number>;
};

const DEFAULT_STORED: Stored = {
  preferredVertical: null,
  source: null,
  visitCounts: { market: 0, food: 0, fashion: 0 },
};

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORED;
    const parsed = JSON.parse(raw);
    return {
      preferredVertical: parsed?.preferredVertical ?? null,
      source: parsed?.source ?? null,
      visitCounts: {
        market: Number(parsed?.visitCounts?.market || 0),
        food: Number(parsed?.visitCounts?.food || 0),
        fashion: Number(parsed?.visitCounts?.fashion || 0),
      },
    };
  } catch {
    return DEFAULT_STORED;
  }
}

function writeStored(stored: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

function verticalForPath(pathname: string): Vertical | null {
  if (pathname.startsWith("/african-market")) return "market";
  if (pathname.startsWith("/african-food")) return "food";
  if (pathname.startsWith("/fashion")) return "fashion";
  return null;
}

type VisitorPreferencesContextType = {
  preferredVertical: Vertical | null;
  setPreferredVertical: (v: Vertical | null) => void; // choix manuel, prioritaire sur l'inférence
};

const VisitorPreferencesContext = createContext<VisitorPreferencesContextType | null>(null);

export function VisitorPreferencesProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [stored, setStored] = useState<Stored>(() =>
    typeof window === "undefined" ? DEFAULT_STORED : readStored()
  );

  useEffect(() => {
    const vertical = verticalForPath(location.pathname);
    if (!vertical) return;
    if (stored.source === "manual") return; // ne jamais écraser un choix explicite

    setStored((prev) => {
      const nextCounts = { ...prev.visitCounts, [vertical]: prev.visitCounts[vertical] + 1 };
      const shouldInfer =
        nextCounts[vertical] >= INFER_THRESHOLD && prev.preferredVertical !== vertical;
      const next: Stored = {
        preferredVertical: shouldInfer ? vertical : prev.preferredVertical,
        source: shouldInfer ? "inferred" : prev.source,
        visitCounts: nextCounts,
      };
      writeStored(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const setPreferredVertical = useCallback((v: Vertical | null) => {
    setStored((prev) => {
      const next: Stored = { ...prev, preferredVertical: v, source: v ? "manual" : null };
      writeStored(next);
      return next;
    });
  }, []);

  const value = useMemo<VisitorPreferencesContextType>(
    () => ({ preferredVertical: stored.preferredVertical, setPreferredVertical }),
    [stored.preferredVertical, setPreferredVertical]
  );

  return (
    <VisitorPreferencesContext.Provider value={value}>
      {children}
    </VisitorPreferencesContext.Provider>
  );
}

export function useVisitorPreferences(): VisitorPreferencesContextType {
  const ctx = useContext(VisitorPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useVisitorPreferences() doit être utilisé sous <VisitorPreferencesProvider>"
    );
  }
  return ctx;
}
