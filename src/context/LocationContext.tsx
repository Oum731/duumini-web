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
import { geoByIp } from "../services/geo";

const STORAGE_KEY = "duumini_city";
const STORAGE_SRC = "duumini_city_source";

export type CityCode = string;

export const CITY_OPTIONS: { code: CityCode; label: string }[] = [
  { code: "Casablanca", label: "Casablanca" },
  { code: "Marrakech", label: "Marrakech" },
  { code: "Rabat", label: "Rabat" },
  { code: "Tanger", label: "Tanger" },
  { code: "Fès", label: "Fès" },
  { code: "Agadir", label: "Agadir" },
];

type CitySource = "manual" | "profile" | "gps" | "ip" | "unknown";

type LocationContextType = {
  city: CityCode | null;
  setCity: (city: CityCode | null, source?: CitySource) => void;

  // ✅ auto-detect pour guests
  autoDetectCity: () => Promise<CityCode | null>;

  isReady: boolean;
  detecting: boolean;
  source: CitySource;
};

const LocationContext = createContext<LocationContextType>({
  city: null,
  setCity: () => {},
  autoDetectCity: async () => null,
  isReady: false,
  detecting: false,
  source: "unknown",
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

  const lower = s.toLowerCase();

  if (lower === "casablanca" || lower === "casa") return "Casablanca";
  if (lower === "marrakech" || lower === "marrakesh" || lower === "marr")
    return "Marrakech";
  if (lower === "rabat") return "Rabat";
  if (lower === "tanger" || lower === "tangier") return "Tanger";
  if (lower === "fes" || lower === "fès" || lower === "fez") return "Fès";
  if (lower === "agadir") return "Agadir";

  return titleCase(s);
}

function readStorageCity(): string | null {
  try {
    return normalizeCityLabel(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStorageCity(city: string | null, source: CitySource) {
  try {
    if (city) localStorage.setItem(STORAGE_KEY, city);
    else localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_SRC, source);
  } catch {
    // ignore
  }
}

function readStorageSource(): CitySource {
  try {
    const s = String(localStorage.getItem(STORAGE_SRC) || "").trim();
    if (
      s === "manual" ||
      s === "profile" ||
      s === "gps" ||
      s === "ip" ||
      s === "unknown"
    )
      return s;
  } catch {}
  return "unknown";
}

/** GPS -> obtenir lat/lng */
function getBrowserPosition(timeoutMs = 4500): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GEO_UNSUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 10 * 60 * 1000,
    });
  });
}

/** Reverse geocoding via Nominatim (OpenStreetMap) */
async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
  // ⚠️ Nominatim: respecter un User-Agent / referrer OK en front,
  // mais si tu préfères, on peut le faire côté backend.
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;
  const data: any = await res.json();
  const a = data?.address || {};

  // On prend city/town/village/municipality/county
  const raw =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.county ||
    a.state ||
    null;

  return normalizeCityLabel(raw);
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [city, setCityState] = useState<CityCode | null>(null);
  const [source, setSource] = useState<CitySource>("unknown");
  const [isReady, setIsReady] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const userVille = useMemo(() => {
    const u: any = user || null;
    return normalizeCityLabel(u?.ville ?? u?.city ?? null);
  }, [user]);

  // ✅ API: setCity unique
  function setCity(next: CityCode | null, src: CitySource = "manual") {
    const normalized = normalizeCityLabel(next);
    setCityState(normalized);
    setSource(src);
    writeStorageCity(normalized, src);
  }

  // ✅ auto detect (GPS -> IP)
  async function autoDetectCity(): Promise<CityCode | null> {
    // si déjà en storage, stop
    const already = readStorageCity();
    if (already) return already;

    setDetecting(true);
    try {
      // 1) GPS (permission)
      try {
        const pos = await getBrowserPosition(4500);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const fromGps = await reverseGeocodeCity(lat, lon);
        if (fromGps) {
          setCity(fromGps, "gps");
          return fromGps;
        }
      } catch {
        // ignore -> fallback IP
      }

      // 2) IP (pas de permission)
      try {
        const r = await geoByIp();
        const fromIp = normalizeCityLabel(r?.city ?? null);
        if (fromIp) {
          setCity(fromIp, "ip");
          return fromIp;
        }
      } catch {
        // ignore -> unknown
      }

      // 3) rien trouvé
      setSource("unknown");
      return null;
    } finally {
      setDetecting(false);
    }
  }

  useEffect(() => {
    // 1) localStorage
    const fromStorage = readStorageCity();
    if (fromStorage) {
      setCityState(fromStorage);
      setSource(readStorageSource());
      setIsReady(true);
      return;
    }

    // 2) profil (connecté) fallback
    if (user && userVille) {
      setCityState(userVille);
      setSource("profile");
      writeStorageCity(userVille, "profile");
      setIsReady(true);
      return;
    }

    // 3) guest: auto detect
    (async () => {
      await autoDetectCity();
      setIsReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userVille, user]);

  return (
    <LocationContext.Provider
      value={{
        city,
        setCity,
        autoDetectCity,
        isReady,
        detecting,
        source,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationCity() {
  return useContext(LocationContext);
}