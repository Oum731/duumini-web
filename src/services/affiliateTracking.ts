const AFFILIATE_STORAGE_KEY = "duumini_affiliate_code";
const AFFILIATE_TS_KEY = "duumini_affiliate_code_ts";
const AFFILIATE_TTL_DAYS = 30;

function nowMs(): number {
  return Date.now();
}

function ttlMs(days = AFFILIATE_TTL_DAYS): number {
  return days * 24 * 60 * 60 * 1000;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function normalizeAffiliateCode(value: unknown): string | null {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!v) return null;

  // optionnel : validation plus stricte
  if (!/^[A-Z0-9_-]+$/.test(v)) return null;

  return v;
}

export function setStoredAffiliateCode(code: unknown): string | null {
  if (!canUseStorage()) return null;

  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return null;

  localStorage.setItem(AFFILIATE_STORAGE_KEY, normalized);
  localStorage.setItem(AFFILIATE_TS_KEY, String(nowMs()));

  return normalized;
}

export function clearStoredAffiliateCode(): void {
  if (!canUseStorage()) return;

  localStorage.removeItem(AFFILIATE_STORAGE_KEY);
  localStorage.removeItem(AFFILIATE_TS_KEY);
}

export function getStoredAffiliateCode(options?: {
  refreshTtl?: boolean;
}): string | null {
  if (!canUseStorage()) return null;

  const refreshTtl = options?.refreshTtl ?? false;

  const code = localStorage.getItem(AFFILIATE_STORAGE_KEY);
  const tsRaw = localStorage.getItem(AFFILIATE_TS_KEY);

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

  if (refreshTtl) {
    localStorage.setItem(AFFILIATE_TS_KEY, String(nowMs()));
  }

  return normalized;
}

export function getAffiliateCodeFromUrl(url?: string): string | null {
  try {
    const href =
      url || (typeof window !== "undefined" ? window.location.href : "");

    if (!href) return null;

    const parsed = new URL(href);
    return normalizeAffiliateCode(parsed.searchParams.get("ref"));
  } catch {
    return null;
  }
}

export function removeAffiliateCodeFromCurrentUrl(): void {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("ref")) return;

    url.searchParams.delete("ref");
    const clean =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
      url.hash;

    window.history.replaceState({}, "", clean);
  } catch {
    // ignore
  }
}

export function captureAffiliateCodeFromUrl(url?: string): string | null {
  const code = getAffiliateCodeFromUrl(url);
  if (!code) return null;

  const stored = setStoredAffiliateCode(code);

  if (!url && stored) {
    removeAffiliateCodeFromCurrentUrl();
  }

  return stored;
}

export function initAffiliateTracking(url?: string): string | null {
  const captured = captureAffiliateCodeFromUrl(url);
  if (captured) return captured;

  return getStoredAffiliateCode({ refreshTtl: true });
}

export function hasStoredAffiliateCode(): boolean {
  return !!getStoredAffiliateCode();
}

export function attachAffiliateCodeToOrderPayload<
  T extends Record<string, unknown>,
>(payload: T): T & { affiliate_code?: string | null } {
  const basePayload = { ...payload };
  const affiliateCode = getStoredAffiliateCode({ refreshTtl: true });

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
  };
}