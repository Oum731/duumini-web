// src/lib/consentStorage.ts
// Module pur (pas de React) — lu par les traceurs eux-mêmes (metaPixel.ts,
// gtm.ts, metricool.ts) et par ConsentContext.tsx, qui l'enveloppe pour
// exposer l'état + les actions au reste de l'app. Une seule source de
// vérité pour le stockage, même style défensif (try/catch) que
// SellIntentGate.tsx/affiliateTracking.ts.

const STORAGE_KEY = "duumini:cookieConsent:v1";
// ✅ 12 mois : au-delà, on considère le consentement caduc et on ré-affiche
// le bandeau. Ce chiffre doit rester cohérent avec le texte de
// PrivacyPolicy.tsx §9 (durée de conservation du consentement).
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type ConsentMethod = "accept_all" | "reject_all" | "custom";

export type ConsentCategories = {
  /** Toujours vrai — panier, session : jamais désactivable. */
  essential: true;
  /** Mesure d'audience (GTM, Metricool). */
  audience: boolean;
  /** Marketing (Meta Pixel). */
  marketing: boolean;
};

export type StoredConsent = {
  version: 1;
  categories: ConsentCategories;
  decidedAt: string;
  method: ConsentMethod;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function isExpired(decidedAt: string): boolean {
  const t = new Date(decidedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > CONSENT_MAX_AGE_MS;
}

/** Lit le consentement stocké — null si absent, expiré ou corrompu. */
export function readConsent(): StoredConsent | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed?.version !== 1 || !parsed?.categories || !parsed?.decidedAt) return null;
    if (isExpired(parsed.decidedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Écrit un nouveau consentement. */
export function writeConsent(
  categories: Omit<ConsentCategories, "essential">,
  method: ConsentMethod
): StoredConsent {
  const payload: StoredConsent = {
    version: 1,
    categories: { essential: true, ...categories },
    decidedAt: new Date().toISOString(),
    method,
  };
  try {
    if (canUseStorage()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // ignore — l'app continue de fonctionner, juste sans persistance
  }
  return payload;
}

/**
 * Helper léger utilisé par les modules traceurs (metaPixel.ts, gtm.ts,
 * metricool.ts) — pas besoin du contexte React, juste un yes/no par
 * catégorie non-essentielle.
 */
export function readConsentCategories(): { audience: boolean; marketing: boolean } {
  const stored = readConsent();
  return {
    audience: !!stored?.categories.audience,
    marketing: !!stored?.categories.marketing,
  };
}
