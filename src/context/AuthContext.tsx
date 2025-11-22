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

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: noopAsync,
  register: noopAsync,
  logout: noopAsync,
  refreshUser: noopAsync,
  updateProfile: noopAsync,
});

/* ===== Helper: broadcast changement d’auth dans l’app + autres onglets ===== */
function broadcastAuthChange(user: User | null) {
  try {
    if (typeof window === "undefined") return;

    // Événement CustomEvent pour le même onglet (RealtimeContext, etc.)
    window.dispatchEvent(
      new CustomEvent("duumini:auth-changed", {
        detail: {
          user,
        },
      })
    );

    // Événement via localStorage pour les autres onglets
    const payload = {
      ts: Date.now(),
      user: user
        ? { id: user.id, role: user.role }
        : null,
    };
    window.localStorage.setItem(
      "duumini:auth-changed",
      JSON.stringify(payload)
    );
  } catch {
    // silencieux
  }
}

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
        // Changement de rôle → on recharge toute l’app (menus, droits, etc.)
        window.location.reload();
      }
    },
    []
  );

  // 🔔 Init Pushy + enregistrement device pour l'utilisateur courant
  const setupPush = useCallback(async () => {
    try {
      const token = await initPush();
      if (token) {
        await registerDevice(token, "pushy");
        console.log("[Auth] device registered", token);
      }
    } catch (e) {
      console.warn("[Auth] init push failed", e);
    }
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

  // 🔁 Keep-alive: maintenir la connexion vivante (refresh silencieux régulier)
  const keepAlive = useCallback(
    async () => {
      try {
        const token = getAccessToken();
        if (!token) return; // pas connecté → rien à faire

        // On rafraîchit le token côté backend (si refresh cookie dispo)
        await apiRefresh();

        // Puis on met à jour le user (au cas où rôle ou infos changent)
        await refreshUser();
      } catch (e) {
        console.warn("[Auth] keep-alive failed", e);
        // En cas d’erreur, on ne déconnecte pas brutalement ici.
      }
    },
    [refreshUser]
  );

  // Chargement initial : récupérer le user si token présent
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

  // Refresh user sur focus / visibilité / intervalle
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

  // ✅ Keep-alive régulier pour garder la connexion vivante (token + user)
  useEffect(() => {
    // ex: toutes les 10 minutes (à ajuster selon l’expiration du token)
    const iv = window.setInterval(() => {
      keepAlive();
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(iv);
    };
  }, [keepAlive]);

  // ✅ Réaction aux changements d’auth dans les AUTRES onglets (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === "duumini:auth-changed" && e.newValue) {
        // Un autre onglet a loggé / déloggé → on rafraîchit le user local
        refreshUser();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      const before = getCurrentUser();
      const u = await apiLogin(phone, password);
      setUser(u);

      // 🔔 Broadcast dans l’app + autres onglets
      broadcastAuthChange(u);

      await applyRoleChangeIfNeeded(before, u);

      // Après login, on initialise Pushy + enregistre le device
      await setupPush();

      // On force un keep-alive immédiat après connexion pour partir sur un token fresh
      keepAlive().catch(() => {});
    },
    [applyRoleChangeIfNeeded, setupPush, keepAlive]
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

    // 🔔 Broadcast logout (user = null)
    broadcastAuthChange(null);
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      const before = getCurrentUser();
      const updated = await apiUpdateProfile(data);
      setUser(updated);

      // 🔔 Si tu veux que certaines parties de l’app réagissent aussi
      // aux changements de profil (ex: nom affiché dans header)
      broadcastAuthChange(updated);

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
