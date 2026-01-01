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
 * ✅ Ville libre (string)
 * Ex: "Casablanca", "Rabat", "Mohammedia", etc.
 */
export type CityCode = string;

/**
 * ✅ Suggestions par défaut (fallback si API indisponible)
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
  city: CityCode | null;
  setCity: (city: CityCode | null) => void;
  isReady: boolean;
};

const LocationContext = createContext<LocationContextType>({
  city: null,
  setCity: () => {},
  isReady: false,
});

/* ===== Helpers ===== */
function normSpaces(s: string) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function titleCase(s: string) {
  const t = normSpaces(s);
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function normalizeCityLabel(v?: string | null): string | null {
  const s = normSpaces(v ?? "");
  if (!s) return null;

  // Normalisation légère (sans être agressif)
  const lower = s.toLowerCase();

  if (lower === "casablanca" || lower === "casa") return "Casablanca";
  if (lower === "marrakech" || lower === "marrakesh" || lower === "marr")
    return "Marrakech";
  if (lower === "rabat") return "Rabat";
  if (lower === "tanger" || lower === "tangier") return "Tanger";
  if (lower === "fes" || lower === "fès" || lower === "fez") return "Fès";
  if (lower === "agadir") return "Agadir";

  // sinon on conserve mais avec une casse propre (permet saisie libre)
  return titleCase(s);
}

/**
 * ✅ IMPORTANT (prod)
 * On ne force PAS la ville du profil utilisateur.
 * La ville choisie via LocationGate est la source de vérité UI.
 * Le profil sert seulement de fallback au tout premier chargement (si rien en storage).
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [city, setCityState] = useState<CityCode | null>(null);
  const [isReady, setIsReady] = useState(false);

  const userVille = useMemo(() => {
    const u: any = user || null;
    // support "ville" ou "city"
    return normalizeCityLabel(u?.ville ?? u?.city ?? null);
  }, [user]);

  useEffect(() => {
    // 1) on tente localStorage (même connecté)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const fromStorage = normalizeCityLabel(saved);
      if (fromStorage) {
        setCityState(fromStorage);
        setIsReady(true);
        return;
      }
    } catch {
      // ignore
    }

    // 2) fallback profil si connecté (si aucune ville en storage)
    if (user && userVille) {
      setCityState(userVille);
      setIsReady(true);
      return;
    }

    // 3) rien
    setCityState(null);
    setIsReady(true);
  }, [user?.id, userVille, user]);

  function setCity(next: CityCode | null) {
    const normalized = normalizeCityLabel(next);
    setCityState(normalized);

    // ✅ On persiste TOUJOURS (même connecté) : la ville est un choix UI/commande
    try {
      if (normalized) localStorage.setItem(STORAGE_KEY, normalized);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
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
