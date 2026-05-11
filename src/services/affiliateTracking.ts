import { trackAffiliateClick } from "../services/affiliates";

const AFFILIATE_STORAGE_KEY = "duumini_affiliate_code";
const AFFILIATE_TS_KEY = "duumini_affiliate_code_ts";
const AFFILIATE_PRODUCT_KEY = "duumini_affiliate_product_id";
const AFFILIATE_SOURCE_KEY = "duumini_affiliate_source";
const AFFILIATE_TTL_DAYS = 30;

function nowMs(): number {
  return Date.now();
}

function ttlMs(days = AFFILIATE_TTL_DAYS): number {
  return days * 24 * 60 * 60 * 1000;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
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
  source?: unknown,
): string | null {
  if (!canUseStorage()) return null;

  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return null;

  window.localStorage.setItem(AFFILIATE_STORAGE_KEY, normalized);
  window.localStorage.setItem(AFFILIATE_TS_KEY, String(nowMs()));

  const cleanProductId = normalizePositiveInt(productId);
  if (cleanProductId) {
    window.localStorage.setItem(AFFILIATE_PRODUCT_KEY, String(cleanProductId));
  } else {
    window.localStorage.removeItem(AFFILIATE_PRODUCT_KEY);
  }

  const cleanSource = String(source || "").trim();
  if (cleanSource) {
    window.localStorage.setItem(AFFILIATE_SOURCE_KEY, cleanSource);
  }

  return normalized;
}

export function clearStoredAffiliateCode(): void {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(AFFILIATE_STORAGE_KEY);
  window.localStorage.removeItem(AFFILIATE_TS_KEY);
  window.localStorage.removeItem(AFFILIATE_PRODUCT_KEY);
  window.localStorage.removeItem(AFFILIATE_SOURCE_KEY);
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

export function getStoredAffiliateSource(): string | null {
  if (!canUseStorage()) return null;

  const source = String(window.localStorage.getItem(AFFILIATE_SOURCE_KEY) || "")
    .trim();

  return source || null;
}

export function getAffiliateCodeFromUrl(url?: string): string | null {
  try {
    const href =
      url || (typeof window !== "undefined" ? window.location.href : "");

    if (!href) return null;

    const parsed = new URL(href, typeof window !== "undefined" ? window.location.origin : undefined);

    return normalizeAffiliateCode(
      parsed.searchParams.get("ref") ||
        parsed.searchParams.get("affiliate_code") ||
        parsed.searchParams.get("affiliate") ||
        parsed.searchParams.get("code"),
    );
  } catch {
    return null;
  }
}

export function getProductIdFromUrl(url?: string): number | null {
  try {
    const href =
      url || (typeof window !== "undefined" ? window.location.href : "");

    if (!href) return null;

    const parsed = new URL(href, typeof window !== "undefined" ? window.location.origin : undefined);

    const queryProductId =
      normalizePositiveInt(parsed.searchParams.get("product_id")) ||
      normalizePositiveInt(parsed.searchParams.get("productId")) ||
      normalizePositiveInt(parsed.searchParams.get("pid"));

    if (queryProductId) return queryProductId;

    const path = parsed.pathname || "";

    const productByProduct = path.match(/\/product\/(\d+)/i);
    if (productByProduct) return normalizePositiveInt(productByProduct[1]);

    const productByProducts = path.match(/\/products\/(\d+)/i);
    if (productByProducts) return normalizePositiveInt(productByProducts[1]);

    const productByP = path.match(/\/p\/(\d+)/i);
    if (productByP) return normalizePositiveInt(productByP[1]);

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
      url.searchParams.has("affiliate_code") ||
      url.searchParams.has("affiliate") ||
      url.searchParams.has("code");

    if (!hasAffiliateParam) return;

    url.searchParams.delete("ref");
    url.searchParams.delete("affiliate_code");
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
  const source = options?.source || "WEB_REF";
  const stored = setStoredAffiliateCode(code, productId, source);

  if (!stored) return null;

  if (options?.trackClick === true && typeof window !== "undefined") {
    try {
      const landingUrl =
        url ||
        window.location.pathname + window.location.search + window.location.hash;

      await trackAffiliateClick({
        affiliate_code: stored,
        landing_url: landingUrl,
        product_id: productId,
        source,
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
    trackClick: options?.trackClick ?? false,
    source: options?.source || "WEB_REF",
  });

  if (captured) return captured;

  return getStoredAffiliateCode({ refreshTtl: true });
}

export function hasStoredAffiliateCode(): boolean {
  return !!getStoredAffiliateCode();
}

export function attachAffiliateCodeToOrderPayload<
  T extends Record<string, unknown>,
>(
  payload: T,
  manualCode?: unknown,
): T & {
  affiliate_code?: string | null;
  affiliate?: {
    code?: string | null;
    product_id?: number | null;
    source?: string;
    [key: string]: unknown;
  };
} {
  const basePayload = { ...payload };

  const manualAffiliateCode = normalizeAffiliateCode(manualCode);
  const storedAffiliateCode = getStoredAffiliateCode({ refreshTtl: true });
  const affiliateCode = manualAffiliateCode || storedAffiliateCode;

  const productId = getStoredAffiliateProductId();
  const source = manualAffiliateCode ? "ADMIN_MANUAL" : getStoredAffiliateSource() || "WEB_REF";

  if (!affiliateCode) {
    return basePayload;
  }

  return {
    ...basePayload,
    affiliate_code: affiliateCode,
    affiliate: {
      ...((basePayload as any).affiliate || {}),
      code: affiliateCode,
      product_id: productId,
      source,
    },
  };
}