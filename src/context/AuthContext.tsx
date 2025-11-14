// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from "react";
import {
  getCurrentUser,
  getAccessToken,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  me as apiMe,
  refresh as apiRefresh,
  updateProfile as apiUpdateProfile,
  type User,
} from "../services/auth";

import {
  initPush,
  registerDevice,
  unregisterDevice,
} from "../services/push";

type RegisterPayload = {
  phone: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  sexe?: "M" | "F" | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
};

const noopAsync = async () => {};

// ⚠️ Exports stables et nommés (pas d’export default)
// Garder exactement ces deux exports: AuthProvider, useAuth
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: noopAsync,
  register: noopAsync,
  logout: noopAsync,
  refreshUser: noopAsync,
  updateProfile: noopAsync,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [loading, setLoading] = useState<boolean>(true);

  const applyRoleChangeIfNeeded = useCallback(
    async (prev: User | null, next: User | null) => {
      const prevRole = (prev?.role || "").toString().trim().toUpperCase();
      const nextRole = (next?.role || "").toString().trim().toUpperCase();
      if (prevRole && nextRole && prevRole !== nextRole) {
        try {
          await apiRefresh();
        } catch {}
        window.location.reload();
      }
    },
    []
  );

  // Petit helper pour initialiser Pushy + enregistrer le device côté API
  const setupPush = useCallback(async () => {
    try {
      const token = await initPush();
      if (token) {
        await registerDevice(token, "pushy");
      }
    } catch (e) {
      console.warn("[Auth] init push failed", e);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getAccessToken();
      if (!token) {
        if (alive) setLoading(false);
        return;
      }
      try {
        const before = getCurrentUser();
        const u = await apiMe();
        if (!alive) return;
        setUser(u);
        await applyRoleChangeIfNeeded(before, u);

        if (u) {
          // Si l'utilisateur est connecté au chargement, on initialise Pushy
          await setupPush();
        }
      } catch {
        if (!alive) return;
        setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyRoleChangeIfNeeded, setupPush]);

  useEffect(() => {
    const onFocus = () => refreshUser();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshUser();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => refreshUser(), 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      const before = getCurrentUser();
      const u = await apiLogin(phone, password);
      setUser(u);
      await applyRoleChangeIfNeeded(before, u);

      // Après login, on initialise Pushy + enregistre le device
      await setupPush();
    },
    [applyRoleChangeIfNeeded, setupPush]
  );

  const register = useCallback(async (data: RegisterPayload) => {
    await apiRegister(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Désenregistrer les devices pushy de cet utilisateur
      await unregisterDevice();
    } catch {}
    await apiLogout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(
    async () => {
      try {
        const before = getCurrentUser();
        const u = await apiMe();
        setUser(u);
        await applyRoleChangeIfNeeded(before, u);
      } catch {
        setUser(null);
      }
    },
    [applyRoleChangeIfNeeded]
  );

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      const before = getCurrentUser();
      const updated = await apiUpdateProfile(data);
      setUser(updated);
      await applyRoleChangeIfNeeded(before, updated);
    },
    [applyRoleChangeIfNeeded]
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
