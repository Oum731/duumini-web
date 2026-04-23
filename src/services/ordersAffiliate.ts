import { getStoredAffiliateCode } from "./affiliateTracking";

export function attachAffiliateCodeToOrderPayload<
  T extends Record<string, unknown>,
>(payload: T): T & { affiliate_code?: string | null } {
  // Toujours cloner pour éviter toute mutation inattendue
  const basePayload = { ...payload };

  const affiliateCode = getStoredAffiliateCode({
    refreshTtl: true, // 🔥 pro : garde le code actif tant que l’utilisateur est actif
  });

  if (!affiliateCode) {
    return basePayload;
  }

  // 🔥 évite d’écraser un code déjà présent (important côté admin / debug)
  if (typeof basePayload.affiliate_code === "string" && basePayload.affiliate_code.trim()) {
    return basePayload as T & { affiliate_code?: string | null };
  }

  return {
    ...basePayload,
    affiliate_code: affiliateCode,
  };
}