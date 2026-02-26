// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import {
  getCurrentUser,
  getAccessToken,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  me as apiMe,
  updateProfile as apiUpdateProfile,
  type User,
  type Sexe,
} from "../services/auth";

import { initPush, registerDevice, unregisterDevice } from "../services/push";

/* =========================
 * Types additionnels
 * =======================*/
export type ShopType = "VENDOR" | "SUPPLIER" | "RESTAURANT" | string;

export type ShopLite = {
  id: number;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  owner_id?: number | null;
  shop_type?: ShopType | null;
};

export type ImpersonationInfo = {
  actor_admin_id: number | null;
  impersonate_shop_id: number;
};

export type UserWithShops = User & {
  shops?: ShopLite[];
  impersonation?: ImpersonationInfo | null;
};

type RegisterPayload = {
  phone: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  sexe?: Sexe | null;
};

type AuthContextType = {
  user: UserWithShops | null;
  loading: boolean;

  shops: ShopLite[];
  activeShopId: number | null;
  actingShopId: number | null; // shop utilisé réellement (impersonation > activeShopId)
  isImpersonating: boolean;

  setActiveShopId: (shopId: number | null) => void;

  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
};

const noopAsync = async () => {};

function hardReload() {
  if (typeof window === "undefined") return;
  window.location.reload();
}

function broadcastAuthChange(user: UserWithShops | null) {
  try {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("duumini:auth-changed", {
        detail: { user },
      })
    );

    const payload = {
      ts: Date.now(),
      user: user ? { id: user.id, role: user.role } : null,
      // utile si tu veux invalider le shop actif sur d’autres onglets
      activeShopId: (() => {
        const v = window.localStorage.getItem("duumini:activeShopId");
        return v ? Number(v) : null;
      })(),
    };
    window.localStorage.setItem("duumini:auth-changed", JSON.stringify(payload));
  } catch {}
}

/* =========================
 * Helpers UI / Routing
 * =======================*/
export function getProHomePath(u: User | null): string {
  const role = String(u?.role || "").trim().toUpperCase();
  if (role === "ADMIN") return "/admin";
  if (role === "FOURNISSEUR") return "/pro/supplier";
  if (role === "RESTAURANT") return "/pro/restaurant";
  if (role === "VENDEUR") return "/pro/vendor";
  return "/";
}

function normalizeShopType(s?: any): string {
  return String(s || "").trim().toUpperCase();
}

function readStoredActiveShopId(): number | null {
  try {
    const v = window.localStorage.getItem("duumini:activeShopId");
    const n = v ? Number(v) : null;
    return Number.isFinite(n as any) && (n as number) > 0 ? (n as number) : null;
  } catch {
    return null;
  }
}

function writeStoredActiveShopId(shopId: number | null) {
  try {
    if (shopId && shopId > 0) {
      window.localStorage.setItem("duumini:activeShopId", String(shopId));
    } else {
      window.localStorage.removeItem("duumini:activeShopId");
    }
  } catch {}
}

function pickDefaultShopId(user: UserWithShops | null): number | null {
  const shops = (user?.shops || []).filter((s) => Number(s?.id) > 0);
  if (!shops.length) return null;

  const stored = readStoredActiveShopId();
  if (stored && shops.some((s) => Number(s.id) === stored)) return stored;

  // Option: priorité selon rôle
  const role = String(user?.role || "").trim().toUpperCase();
  if (role === "FOURNISSEUR") {
    const s = shops.find((x) => normalizeShopType(x.shop_type) === "SUPPLIER");
    if (s) return Number(s.id);
  }
  if (role === "RESTAURANT") {
    const s = shops.find((x) => normalizeShopType(x.shop_type) === "RESTAURANT");
    if (s) return Number(s.id);
  }
  if (role === "VENDEUR") {
    const s = shops.find((x) => normalizeShopType(x.shop_type) === "VENDOR");
    if (s) return Number(s.id);
  }

  return Number(shops[0].id);
}

/* =========================
 * Context
 * =======================*/
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,

  shops: [],
  activeShopId: null,
  actingShopId: null,
  isImpersonating: false,

  setActiveShopId: () => {},

  login: noopAsync,
  register: noopAsync,
  logout: noopAsync,
  refreshUser: noopAsync,
  updateProfile: noopAsync,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithShops | null>(() => getCurrentUser() as any);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeShopId, _setActiveShopId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    return readStoredActiveShopId();
  });

  const shops = useMemo<ShopLite[]>(() => (user?.shops || []) as ShopLite[], [user]);

  const isImpersonating = !!user?.impersonation?.impersonate_shop_id;

  const actingShopId = useMemo(() => {
    const imp = user?.impersonation?.impersonate_shop_id;
    if (imp && Number(imp) > 0) return Number(imp);
    return activeShopId && activeShopId > 0 ? activeShopId : null;
  }, [user, activeShopId]);

  const setActiveShopId = useCallback(
    (shopId: number | null) => {
      const n = shopId && Number(shopId) > 0 ? Number(shopId) : null;

      // Si on est en impersonation, on laisse le shop actif se mettre à jour,
      // mais actingShopId restera l'impersonate_shop_id.
      _setActiveShopId(n);
      if (typeof window !== "undefined") writeStoredActiveShopId(n);

      // Option: broadcast pour les autres onglets
      broadcastAuthChange(user);
    },
    [user]
  );

  const applyRoleChangeIfNeeded = useCallback(
    async (prev: UserWithShops | null, next: UserWithShops | null) => {
      const prevRole = (prev?.role || "").toString().trim().toUpperCase();
      const nextRole = (next?.role || "").toString().trim().toUpperCase();
      if (prevRole && nextRole && prevRole !== nextRole) hardReload();
    },
    []
  );

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

  const refreshUser = useCallback(async () => {
    try {
      const before = getCurrentUser() as any;
      const u = (await apiMe()) as any as UserWithShops;

      setUser(u);

      // ✅ recalcul shop actif si nécessaire
      const nextDefaultShopId = pickDefaultShopId(u);
      if (nextDefaultShopId !== activeShopId) {
        _setActiveShopId(nextDefaultShopId);
        if (typeof window !== "undefined") writeStoredActiveShopId(nextDefaultShopId);
      }

      await applyRoleChangeIfNeeded(before, u);
    } catch {
      setUser(null);
      _setActiveShopId(null);
      if (typeof window !== "undefined") writeStoredActiveShopId(null);
    }
  }, [applyRoleChangeIfNeeded, activeShopId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getAccessToken();
      if (!token) {
        if (alive) setLoading(false);
        return;
      }
      try {
        const before = getCurrentUser() as any;
        const u = (await apiMe()) as any as UserWithShops;
        if (!alive) return;

        setUser(u);

        const nextDefaultShopId = pickDefaultShopId(u);
        _setActiveShopId(nextDefaultShopId);
        if (typeof window !== "undefined") writeStoredActiveShopId(nextDefaultShopId);

        await applyRoleChangeIfNeeded(before, u);
        if (u) await setupPush();
      } catch {
        if (!alive) return;
        setUser(null);
        _setActiveShopId(null);
        if (typeof window !== "undefined") writeStoredActiveShopId(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === "duumini:auth-changed" && e.newValue) hardReload();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      const before = getCurrentUser() as any;
      const u = (await apiLogin(phone, password)) as any as UserWithShops;
      setUser(u);

      const nextDefaultShopId = pickDefaultShopId(u);
      _setActiveShopId(nextDefaultShopId);
      if (typeof window !== "undefined") writeStoredActiveShopId(nextDefaultShopId);

      broadcastAuthChange(u);
      await applyRoleChangeIfNeeded(before, u);

      await setupPush();
      hardReload();
    },
    [applyRoleChangeIfNeeded, setupPush]
  );

  const register = useCallback(async (data: RegisterPayload) => {
    await apiRegister(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterDevice();
    } catch {}
    await apiLogout();
    setUser(null);

    _setActiveShopId(null);
    if (typeof window !== "undefined") writeStoredActiveShopId(null);

    broadcastAuthChange(null);
    hardReload();
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      const before = getCurrentUser() as any;
      const updated = (await apiUpdateProfile(data)) as any as UserWithShops;
      setUser(updated);

      const nextDefaultShopId = pickDefaultShopId(updated);
      _setActiveShopId(nextDefaultShopId);
      if (typeof window !== "undefined") writeStoredActiveShopId(nextDefaultShopId);

      broadcastAuthChange(updated);
      await applyRoleChangeIfNeeded(before, updated);
    },
    [applyRoleChangeIfNeeded]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,

        shops,
        activeShopId,
        actingShopId,
        isImpersonating,

        setActiveShopId,

        login,
        register,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}