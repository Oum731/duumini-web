// src/context/CompanyContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "../services/auth";
import { listMyCompanies, type Company } from "../services/companies";

const STORAGE_KEY = "duumini:activeCompanyId";

type CompanyContextType = {
  myCompanies: Company[];
  activeCompanyId: number | null;
  activeCompany: Company | null;
  setActiveCompany: (id: number | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType>({
  myCompanies: [],
  activeCompanyId: null,
  activeCompany: null,
  setActiveCompany: () => {},
  loading: false,
  refresh: async () => {},
});

function readStoredCompanyId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeStoredCompanyId(id: number | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [myCompanies, setMyCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(
    readStoredCompanyId
  );
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!getAccessToken()) {
      setMyCompanies([]);
      return;
    }
    setLoading(true);
    try {
      const items = await listMyCompanies();
      setMyCompanies(items);

      // Si l'entreprise active stockée n'est plus valide (retirée, etc.),
      // retomber sur la première disponible.
      setActiveCompanyId((prev) => {
        if (prev && items.some((c) => c.id === prev)) return prev;
        const fallback = items[0]?.id ?? null;
        writeStoredCompanyId(fallback);
        return fallback;
      });
    } catch {
      setMyCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function setActiveCompany(id: number | null) {
    setActiveCompanyId(id);
    writeStoredCompanyId(id);
  }

  const activeCompany = useMemo(
    () => myCompanies.find((c) => c.id === activeCompanyId) ?? null,
    [myCompanies, activeCompanyId]
  );

  return (
    <CompanyContext.Provider
      value={{
        myCompanies,
        activeCompanyId,
        activeCompany,
        setActiveCompany,
        loading,
        refresh,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
