// src/context/LocationContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "duumini_city";

/**
 * ✅ Avant: "CASABLANCA" | "MARRAKECH"
 * ✅ Maintenant: ville libre (string)
 */
export type CityCode = string;

/**
 * ✅ Suggestions par défaut (peuvent être remplacées/complétées par la DB dans LocationGate)
 * On garde la structure pour compat avec ton UI.
 */
export const CITY_OPTIONS: { code: CityCode; label: string }[] = [
  { code: "Casablanca", label: "Casablanca" },
  { code: "Marrakech", label: "Marrakech" },
  { code: "Rabat", label: "Rabat" },
  { code: "Tanger", label: "Tanger" },
  { code: "Fès", label: "Fès" },
  { code: "Agadir", label: "Agadir" },
];

type LocationContextType = {
  /**
   * Ville courante (libre)
   * Ex: "Casablanca", "Kénitra", "Oujda", etc.
   */
  city: CityCode | null;
  setCity: (city: CityCode | null) => void;
  isReady: boolean;
};

const LocationContext = createContext<LocationContextType>({
  city: null,
  setCity: () => {},
  isReady: false,
});

function normalizeCityLabel(v?: string | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // On garde la casse telle quelle, mais on peut légèrement uniformiser :
  // -> "casablanca" => "Casablanca"
  // Si tu préfères ne pas toucher, supprime le bloc ci-dessous.
  const lower = s.toLowerCase();
  if (lower === "casablanca") return "Casablanca";
  if (lower === "marrakech") return "Marrakech";
  if (lower === "rabat") return "Rabat";
  if (lower === "tanger") return "Tanger";
  if (lower === "fes" || lower === "fès") return "Fès";
  if (lower === "agadir") return "Agadir";
  return s;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [city, setCityState] = useState<CityCode | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Ville du profil user (si connecté)
  const userVille = useMemo(() => {
    return normalizeCityLabel((user as any)?.ville ?? null);
  }, [user]);

  useEffect(() => {
    // ✅ Si user connecté : on privilégie son profil
    if (user) {
      setCityState(userVille);
      setIsReady(true);
      return;
    }

    // ✅ Invité : lecture depuis localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setCityState(normalizeCityLabel(saved));
    } catch {
      setCityState(null);
    } finally {
      setIsReady(true);
    }
  }, [user?.id, userVille]);

  function setCity(next: CityCode | null) {
    const normalized = normalizeCityLabel(next);

    setCityState(normalized);

    // ✅ On persiste seulement pour les invités
    if (!user) {
      try {
        if (normalized) localStorage.setItem(STORAGE_KEY, normalized);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }

  return (
    <LocationContext.Provider value={{ city, setCity, isReady }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationCity() {
  return useContext(LocationContext);
}
