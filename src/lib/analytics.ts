// src/lib/analytics.ts
import { metaPageView, metaAddToCart, metaPurchase } from "./metaPixel";

declare global {
  interface Window {
    dataLayer?: any[];
  }
}

/** Petit helper pour pousser dans dataLayer proprement */
function pushToDataLayer(event: Record<string, any>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

/** Page vue SPA (React Router) */
export function trackPageView(path?: string) {
  const pagePath = path || (typeof window !== "undefined" ? window.location.pathname : "/");

  // ✅ GTM
  pushToDataLayer({
    event: "page_view",
    page_path: pagePath,
  });

  // ✅ Meta Pixel
  metaPageView(pagePath);
}

/** Ajout au panier */
export function trackAddToCart(args: {
  productId: number | string;
  name: string;
  price: number;
  currency?: string; // ✅ optionnel
  quantity?: number;
  category?: string;
}) {
  const { productId, name, price, currency = "MAD", quantity = 1, category } = args;

  // ✅ GTM
  pushToDataLayer({
    event: "add_to_cart",
    item_id: productId,
    item_name: name,
    price,
    currency,
    quantity,
    item_category: category,
  });

  // ✅ Meta Pixel (simple)
  metaAddToCart(
    { id: productId, name, price },
    quantity
  );
}

/** Achat / commande confirmée */
export function trackPurchase(args: {
  orderId: number | string;
  value: number;
  currency?: string; // ✅ optionnel
  items: {
    id: number | string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }[];
}) {
  const { orderId, value, currency = "MAD", items } = args;

  // ✅ GTM
  pushToDataLayer({
    event: "purchase",
    transaction_id: orderId,
    value,
    currency,
    items: items.map((it) => ({
      item_id: it.id,
      item_name: it.name,
      price: it.price,
      quantity: it.quantity,
      item_category: it.category,
    })),
  });

  // ✅ Meta Pixel (simple)
  metaPurchase({
    order_id: String(orderId),
    value: Number(value || 0),
    product_ids: (items || []).map((it) => it.id),
  });
}