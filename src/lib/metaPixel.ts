// src/lib/metaPixel.ts
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

const PIXEL_ID: string = (import.meta as any).env?.VITE_META_PIXEL_ID || "";

let loaded = false;
let injected = false;

function injectScriptOnce(src: string) {
  if (injected) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
  injected = true;
}

function loadMetaPixelOnce() {
  if (typeof window === "undefined") return;
  if (!PIXEL_ID) return;
  if (loaded || window.fbq) {
    loaded = true;
    return;
  }

  const fbq = function (...args: any[]) {
    // @ts-ignore
    (fbq as any).callMethod
      ? // @ts-ignore
        (fbq as any).callMethod.apply(fbq, args)
      : // @ts-ignore
        (fbq as any).queue.push(args);
  };

  // @ts-ignore
  (fbq as any).queue = [];
  // @ts-ignore
  (fbq as any).loaded = true;
  // @ts-ignore
  (fbq as any).version = "2.0";

  window.fbq = window.fbq || fbq;
  window._fbq = window._fbq || fbq;

  injectScriptOnce("https://connect.facebook.net/en_US/fbevents.js");

  window.fbq?.("init", PIXEL_ID);
  loaded = true;
}

function cleanUndefined<T extends Record<string, any>>(obj: T) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function track(event: string, payload?: Record<string, any>) {
  loadMetaPixelOnce();
  if (!window.fbq) return;

  if (payload) window.fbq("track", event, cleanUndefined(payload));
  else window.fbq("track", event);
}

/** ✅ Appel à chaque changement de page (SPA) */
export function metaPageView(path?: string) {
  track("PageView", path ? { page_path: path } : undefined);
}

/** ✅ Page produit (simple) */
export function metaViewContent(p: {
  id: number | string;
  name?: string | null;
  price?: number | null;
}) {
  track("ViewContent", {
    content_ids: [String(p.id)],
    content_name: p.name || "",
    content_type: "product",
    value: Number(p.price || 0),
    currency: "MAD", // ✅ interne (ne pas passer depuis l'appel)
  });
}

/** ✅ Ajout panier (simple) */
export function metaAddToCart(
  p: { id: number | string; name?: string | null; price?: number | null },
  qty = 1
) {
  track("AddToCart", {
    content_ids: [String(p.id)],
    content_name: p.name || "",
    content_type: "product",
    value: Number(p.price || 0) * Number(qty || 1),
    currency: "MAD", // ✅ interne
  });
}

/** ✅ Début checkout (signature SIMPLE) */
export function metaInitiateCheckout(payload: {
  product_ids: Array<number | string>;
  value: number;
}) {
  track("InitiateCheckout", {
    content_ids: payload.product_ids.map((x) => String(x)),
    content_type: "product",
    value: Number(payload.value || 0),
    currency: "MAD", // ✅ interne
  });
}

/** ✅ Achat (signature SIMPLE) */
export function metaPurchase(payload: {
  product_ids: Array<number | string>;
  value: number;
  order_id?: string | number;
}) {
  track("Purchase", {
    content_ids: payload.product_ids.map((x) => String(x)),
    content_type: "product",
    value: Number(payload.value || 0),
    currency: "MAD", // ✅ interne
    order_id: payload.order_id ? String(payload.order_id) : undefined,
  });
}