// src/lib/metaPixel.ts
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

const PIXEL_ID: string = (import.meta as any).env?.VITE_META_PIXEL_ID || "";

let loaded = false;

function injectScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadMetaPixelOnce() {
  if (typeof window === "undefined") return;
  if (!PIXEL_ID) return;
  if (loaded || window.fbq) {
    loaded = true;
    return;
  }

  // ✅ Création de fbq sans le pattern "!(function...)"
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

  injectScript("https://connect.facebook.net/en_US/fbevents.js");

  window.fbq?.("init", PIXEL_ID);
  loaded = true;
}

function track(event: string, payload?: Record<string, any>) {
  loadMetaPixelOnce();
  if (!window.fbq) return;
  if (payload) window.fbq("track", event, payload);
  else window.fbq("track", event);
}

/** ✅ Appel à chaque changement de page (SPA) */
export function metaPageView(path?: string) {
  track("PageView", path ? { page_path: path } : undefined);
}

/** ✅ Page produit */
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
    currency: "MAD",
  });
}

/** ✅ Ajout panier */
export function metaAddToCart(
  p: { id: number | string; name?: string | null; price?: number | null },
  qty = 1
) {
  track("AddToCart", {
    content_ids: [String(p.id)],
    content_name: p.name || "",
    content_type: "product",
    value: Number(p.price || 0) * Number(qty || 1),
    currency: "MAD",
  });
}

/** ✅ Début checkout */
export function metaInitiateCheckout(payload: {
  product_ids: Array<number | string>;
  value: number;
}) {
  track("InitiateCheckout", {
    content_ids: payload.product_ids.map((x) => String(x)),
    content_type: "product",
    value: Number(payload.value || 0),
    currency: "MAD",
  });
}

/** ✅ Achat */
export function metaPurchase(payload: {
  product_ids: Array<number | string>;
  value: number;
  order_id?: string | number;
}) {
  track("Purchase", {
    content_ids: payload.product_ids.map((x) => String(x)),
    content_type: "product",
    value: Number(payload.value || 0),
    currency: "MAD",
    order_id: payload.order_id ? String(payload.order_id) : undefined,
  });
}