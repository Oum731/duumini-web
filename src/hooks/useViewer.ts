// src/hooks/useViewer.ts
import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { normRole } from "../utils/roles";
import { getCaps } from "../utils/capabilities";

export function useViewer() {
  const { user, loading, shops, activeShopId, actingShopId, isImpersonating } = useAuth();
  const role = useMemo(() => normRole((user as any)?.role), [user]);
  const caps = useMemo(() => getCaps(role || "MEMBER"), [role]);

  const activeShop = useMemo(() => {
    const id = actingShopId || null;
    if (!id) return null;
    return (shops || []).find((s) => Number(s?.id) === Number(id)) || null;
  }, [shops, actingShopId]);

  const shopType = useMemo(() => {
    return String((activeShop as any)?.shop_type || "").trim().toUpperCase();
  }, [activeShop]);

  return {
    user,
    loading,
    role,
    caps,
    shops,
    activeShopId,
    actingShopId,
    isImpersonating,
    activeShop,
    shopType,
    isLogged: !!user,
  };
}