import { trackAffiliateClick } from "../services/affiliates";

const AFFILIATE_STORAGE_KEY = "duumini_affiliate_code";
const AFFILIATE_TS_KEY = "duumini_affiliate_code_ts";
const AFFILIATE_PRODUCT_KEY = "duumini_affiliate_product_id";
const AFFILIATE_TTL_DAYS = 30;

function nowMs(): number {
  return Date.now();
}

function ttlMs(days = AFFILIATE_TTL_DAYS): number {
  return days * 24 * 60 * 60 * 1000;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function normalizeAffiliateCode(value: unknown): string | null {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!v) return null;
  if (!/^[A-Z0-9_-]+$/.test(v)) return null;

  return v;
}

function normalizePositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function setStoredAffiliateCode(
  code: unknown,
  productId?: unknown,
): string | null {
  if (!canUseStorage()) return null;

  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return null;

  window.localStorage.setItem(AFFILIATE_STORAGE_KEY, normalized);
  window.localStorage.setItem(AFFILIATE_TS_KEY, String(nowMs()));

  const cleanProductId = normalizePositiveInt(productId);
  if (cleanProductId) {
    window.localStorage.setItem(AFFILIATE_PRODUCT_KEY, String(cleanProductId));
  }

  return normalized;
}

export function clearStoredAffiliateCode(): void {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(AFFILIATE_STORAGE_KEY);
  window.localStorage.removeItem(AFFILIATE_TS_KEY);
  window.localStorage.removeItem(AFFILIATE_PRODUCT_KEY);
}

export function getStoredAffiliateCode(options?: {
  refreshTtl?: boolean;
}): string | null {
  if (!canUseStorage()) return null;

  const code = window.localStorage.getItem(AFFILIATE_STORAGE_KEY);
  const tsRaw = window.localStorage.getItem(AFFILIATE_TS_KEY);

  const normalized = normalizeAffiliateCode(code);
  if (!normalized) {
    clearStoredAffiliateCode();
    return null;
  }

  const ts = Number(tsRaw || 0);
  if (!Number.isFinite(ts) || ts <= 0) {
    clearStoredAffiliateCode();
    return null;
  }

  if (nowMs() - ts > ttlMs()) {
    clearStoredAffiliateCode();
    return null;
  }

  if (options?.refreshTtl) {
    window.localStorage.setItem(AFFILIATE_TS_KEY, String(nowMs()));
  }

  return normalized;
}

export function getStoredAffiliateProductId(): number | null {
  if (!canUseStorage()) return null;

  const n = Number(window.localStorage.getItem(AFFILIATE_PRODUCT_KEY) || 0);
  if (!Number.isFinite(n) || n <= 0) return null;

  return Math.trunc(n);
}

export function getAffiliateCodeFromUrl(url?: string): string | null {
  try {
    const href = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!href) return null;

    const parsed = new URL(href);

    return normalizeAffiliateCode(
      parsed.searchParams.get("ref") ||
        parsed.searchParams.get("affiliate") ||
        parsed.searchParams.get("code"),
    );
  } catch {
    return null;
  }
}

export function getProductIdFromUrl(url?: string): number | null {
  try {
    const href = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!href) return null;

    const parsed = new URL(href);

    const queryProductId = normalizePositiveInt(parsed.searchParams.get("product_id"));
    if (queryProductId) return queryProductId;

    const path = parsed.pathname || "";

    const productByProducts = path.match(/\/products\/(\d+)/i);
    if (productByProducts) return normalizePositiveInt(productByProducts[1]);

    const productByProduct = path.match(/\/product\/(\d+)/i);
    if (productByProduct) return normalizePositiveInt(productByProduct[1]);

    return null;
  } catch {
    return null;
  }
}

export function removeAffiliateCodeFromCurrentUrl(): void {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);

    const hasAffiliateParam =
      url.searchParams.has("ref") ||
      url.searchParams.has("affiliate") ||
      url.searchParams.has("code");

    if (!hasAffiliateParam) return;

    url.searchParams.delete("ref");
    url.searchParams.delete("affiliate");
    url.searchParams.delete("code");

    const clean =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
      url.hash;

    window.history.replaceState({}, "", clean);
  } catch {}
}

export async function captureAffiliateCodeFromUrl(
  url?: string,
  options?: {
    removeFromUrl?: boolean;
    trackClick?: boolean;
    source?: string;
  },
): Promise<string | null> {
  const code = getAffiliateCodeFromUrl(url);
  if (!code) return null;

  const productId = getProductIdFromUrl(url);
  const stored = setStoredAffiliateCode(code, productId);

  if (!stored) return null;

  if (options?.trackClick !== false && typeof window !== "undefined") {
    try {
      const landingUrl =
        url ||
        window.location.pathname + window.location.search + window.location.hash;

      await trackAffiliateClick({
        affiliate_code: stored,
        landing_url: landingUrl,
        product_id: productId,
        source: options?.source || "web",
      });
    } catch {}
  }

  if (!url && options?.removeFromUrl !== false) {
    removeAffiliateCodeFromCurrentUrl();
  }

  return stored;
}

export async function initAffiliateTracking(
  url?: string,
  options?: {
    removeFromUrl?: boolean;
    trackClick?: boolean;
    source?: string;
  },
): Promise<string | null> {
  const captured = await captureAffiliateCodeFromUrl(url, {
    removeFromUrl: options?.removeFromUrl ?? true,
    trackClick: options?.trackClick ?? true,
    source: options?.source || "production",
  });

  if (captured) return captured;

  return getStoredAffiliateCode({ refreshTtl: true });
}

export function hasStoredAffiliateCode(): boolean {
  return !!getStoredAffiliateCode();
}

export function attachAffiliateCodeToOrderPayload<
  T extends Record<string, unknown>,
>(payload: T): T & {
  affiliate_code?: string | null;
  affiliate?: {
    code?: string | null;
    product_id?: number | null;
    source?: string;
    [key: string]: unknown;
  };
} {
  const basePayload = { ...payload };
  const affiliateCode = getStoredAffiliateCode({ refreshTtl: true });
  const productId = getStoredAffiliateProductId();

  if (!affiliateCode) {
    return basePayload;
  }

  const existingCode =
    typeof (basePayload as { affiliate_code?: unknown }).affiliate_code === "string"
      ? String((basePayload as { affiliate_code?: unknown }).affiliate_code).trim()
      : "";

  if (existingCode) {
    return basePayload as T & { affiliate_code?: string | null };
  }

  return {
    ...basePayload,
    affiliate_code: affiliateCode,
    affiliate: {
      ...((basePayload as any).affiliate || {}),
      code: affiliateCode,
      product_id: productId,
      source: "WEB_REF",
    },
  };
}