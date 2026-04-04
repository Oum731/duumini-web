declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

type MetaParams = Record<string, any>;

function canTrack() {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function toMetaNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.-]/g, "");

    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCurrency(currency?: string) {
  const c = String(currency || "MAD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : "MAD";
}

function cleanParams(params: MetaParams) {
  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (value === undefined || value === null) {
      delete params[key];
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      delete params[key];
      return;
    }

    if (typeof value === "string" && value.trim() === "") {
      delete params[key];
      return;
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      delete params[key];
    }
  });

  return params;
}

export function metaTrack(
  eventName: string,
  params?: MetaParams,
  options?: { eventID?: string }
) {
  if (!canTrack()) return;

  if (params && Object.keys(params).length > 0) {
    if (options?.eventID) {
      window.fbq!("track", eventName, params, { eventID: options.eventID });
      return;
    }

    window.fbq!("track", eventName, params);
    return;
  }

  if (options?.eventID) {
    window.fbq!("track", eventName, {}, { eventID: options.eventID });
    return;
  }

  window.fbq!("track", eventName);
}

export function trackPageView(event_id?: string) {
  metaTrack("PageView", undefined, {
    eventID: event_id,
  });
}

export function trackViewContent(input?: {
  content_name?: string;
  content_ids?: Array<string | number>;
  content_type?: string;
  value?: number | string;
  currency?: string;
  num_items?: number | string;
  category_name?: string;
  event_id?: string;
}) {
  const params: MetaParams = cleanParams({
    content_name: input?.content_name,
    content_ids: input?.content_ids?.map(String),
    content_type: input?.content_type || "product",
    value: toMetaNumber(input?.value, 0),
    currency: normalizeCurrency(input?.currency),
    num_items: toMetaNumber(input?.num_items, 1),
    content_category: input?.category_name,
  });

  metaTrack("ViewContent", params, {
    eventID: input?.event_id,
  });
}

export function trackAddToCart(input?: {
  content_name?: string;
  content_ids?: Array<string | number>;
  content_type?: string;
  value?: number | string;
  currency?: string;
  num_items?: number | string;
  event_id?: string;
}) {
  const params: MetaParams = cleanParams({
    content_name: input?.content_name,
    content_ids: input?.content_ids?.map(String),
    content_type: input?.content_type || "product",
    value: toMetaNumber(input?.value, 0),
    currency: normalizeCurrency(input?.currency),
    num_items: toMetaNumber(input?.num_items, 1),
  });

  metaTrack("AddToCart", params, {
    eventID: input?.event_id,
  });
}

export function trackInitiateCheckout(input?: {
  value?: number | string;
  currency?: string;
  num_items?: number | string;
  content_ids?: Array<string | number>;
  content_type?: string;
  event_id?: string;
}) {
  const params: MetaParams = cleanParams({
    value: toMetaNumber(input?.value, 0),
    currency: normalizeCurrency(input?.currency),
    num_items: toMetaNumber(input?.num_items, 1),
    content_ids: input?.content_ids?.map(String),
    content_type: input?.content_type || "product",
  });

  metaTrack("InitiateCheckout", params, {
    eventID: input?.event_id,
  });
}

export function trackPurchase(input: {
  value: number | string;
  currency?: string;
  order_id?: string | number;
  event_id?: string;
  content_ids?: Array<string | number>;
  content_type?: string;
  num_items?: number | string;
  content_name?: string;
}) {
  const value = toMetaNumber(input?.value, 0);
  const currency = normalizeCurrency(input?.currency);
  const eventID = input?.event_id || (input?.order_id ? `purchase_${input.order_id}` : undefined);

  if (value <= 0) {
    console.warn("[Meta Pixel] Purchase ignoré: valeur invalide", {
      rawValue: input?.value,
      normalizedValue: value,
      currency,
      input,
    });
    return;
  }

  const params: MetaParams = cleanParams({
    value,
    currency,
    order_id: input?.order_id ? String(input.order_id) : undefined,
    content_ids: input?.content_ids?.map(String),
    content_type: input?.content_type || "product",
    num_items: toMetaNumber(input?.num_items, 1),
    content_name: input?.content_name,
  });

  console.log("[Meta Pixel] Purchase envoyé", {
    eventID,
    params,
  });

  metaTrack("Purchase", params, {
    eventID,
  });
}