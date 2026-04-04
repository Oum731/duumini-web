declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

type MetaParams = Record<string, any>;

function canTrack() {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function toSafeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCurrency(currency?: string) {
  const c = String(currency || "MAD").trim().toUpperCase();
  return c.length === 3 ? c : "MAD";
}

export function metaTrack(eventName: string, params?: MetaParams) {
  if (!canTrack()) return;
  if (params && Object.keys(params).length > 0) {
    window.fbq!("track", eventName, params);
    return;
  }
  window.fbq!("track", eventName);
}

export function trackPageView() {
  metaTrack("PageView");
}

export function trackViewContent(input?: {
  content_name?: string;
  content_ids?: Array<string | number>;
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  category_name?: string;
}) {
  const params: MetaParams = {
    content_name: input?.content_name || undefined,
    content_ids: input?.content_ids || undefined,
    content_type: input?.content_type || "product",
    value: toSafeNumber(input?.value, 0),
    currency: normalizeCurrency(input?.currency),
    num_items: toSafeNumber(input?.num_items, 1),
    content_category: input?.category_name || undefined,
  };

  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });

  metaTrack("ViewContent", params);
}

export function trackAddToCart(input?: {
  content_name?: string;
  content_ids?: Array<string | number>;
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
}) {
  const params: MetaParams = {
    content_name: input?.content_name || undefined,
    content_ids: input?.content_ids || undefined,
    content_type: input?.content_type || "product",
    value: toSafeNumber(input?.value, 0),
    currency: normalizeCurrency(input?.currency),
    num_items: toSafeNumber(input?.num_items, 1),
  };

  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });

  metaTrack("AddToCart", params);
}

export function trackInitiateCheckout(input?: {
  value?: number;
  currency?: string;
  num_items?: number;
  content_ids?: Array<string | number>;
  content_type?: string;
}) {
  const params: MetaParams = {
    value: toSafeNumber(input?.value, 0),
    currency: normalizeCurrency(input?.currency),
    num_items: toSafeNumber(input?.num_items, 1),
    content_ids: input?.content_ids || undefined,
    content_type: input?.content_type || "product",
  };

  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });

  metaTrack("InitiateCheckout", params);
}

export function trackPurchase(input: {
  value: number;
  currency?: string;
  order_id?: string | number;
  content_ids?: Array<string | number>;
  content_type?: string;
  num_items?: number;
}) {
  const value = toSafeNumber(input?.value, 0);
  if (value <= 0) return;

  const params: MetaParams = {
    value,
    currency: normalizeCurrency(input?.currency),
    order_id: input?.order_id || undefined,
    content_ids: input?.content_ids || undefined,
    content_type: input?.content_type || "product",
    num_items: toSafeNumber(input?.num_items, 1),
  };

  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });

  metaTrack("Purchase", params);
}