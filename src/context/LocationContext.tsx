// src/context/LocationContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "duumini_city";

export type CityCode = "CASABLANCA" | "MARRAKECH";

export const CITY_OPTIONS: { code: CityCode; label: string }[] = [
  { code: "CASABLANCA", label: "Casablanca" },
  { code: "MARRAKECH", label: "Marrakech" },
];

type LocationContextType = {
  city: CityCode | null;
  setCity: (city: CityCode | null) => void;
  isReady: boolean; // true quand on a lu le localStorage / profil
};

const LocationContext = createContext<LocationContextType>({
  city: null,
  setCity: () => {},
  isReady: false,
});

// petit helper pour mapper "Casablanca" / "Marrakech" du profil user -> CityCode
function normalizeUserVille(v?: string | null): CityCode | null {
  const raw = (v || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("cas")) return "CASABLANCA";
  if (raw.startsWith("mar")) return "MARRAKECH";
  return null;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [city, setCityState] = useState<CityCode | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Lecture initiale : si user connecté → on utilise son profil,
  // sinon → on lit le localStorage (invité).
  useEffect(() => {
    // User connecté → on NE propose PAS le choix de ville
    if (user) {
      const code = normalizeUserVille((user as any).ville);
      if (code) {
        setCityState(code);
      } else {
        // ville inconnue → on laisse null, mais on ne forcera pas de modal
        setCityState(null);
      }
      setIsReady(true);
      return;
    }

    // Invité → lecture depuis localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "CASABLANCA" || saved === "MARRAKECH") {
        setCityState(saved);
      }
    } catch {
      // ignore
    } finally {
      setIsReady(true);
    }
  }, [user?.id, (user as any)?.ville]);

  function setCity(next: CityCode | null) {
    setCityState(next);

    // On ne persiste que pour les invités
    if (!user) {
      try {
        if (next) {
          localStorage.setItem(STORAGE_KEY, next);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
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
