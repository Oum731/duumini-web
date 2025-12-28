// src/services/orders.ts
import { api } from "./http";

/** ✅ Aligné avec ton backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

/* ===== Types ===== */
export type OrderStatus = "OPEN" | "PREPARATION" | "DELIVERY" | "DONE" | "CANCELLED";

/** ✅ Input envoyé au backend */
export type OrderItemInput = {
  product_id: number;
  qty: number;
  variant_id?: number | null;

  // (optionnels, UI only, pas utilisés par backend)
  name?: string;
  price?: number;
  variant_key?: string | null;
  variant_label?: string | null;
};

export type CreateOrderPayload = {
  contact: {
    first_name?: string;
    last_name?: string;
    name?: string;
    phone: string;
  };

  address: {
    ville?: string;
    commune?: string;
    quartier?: string | null;
    gps?: { lat: number; lng: number } | null;
  };

  delivery: {
    mode: "EXPRESS" | "SIMPLE" | "PROMO_FREE" | "CASABLANCA" | "CITY";
    fee: number;
    currency: "MAD" | string;
  };

  items: OrderItemInput[];

  totals?: {
    items_count?: number;
    items_amount?: number;
    delivery_fee?: number;
    amount?: number;
    currency?: string;
  };

  payment?: {
    method?: "COD" | string;
    note?: string | null;
  };

  // compat (si certains endpoints attendent encore ces champs plats)
  address_city?: string;
  address_commune?: string | null;
  address_district?: string | null;
  address_gps_lat?: number | null;
  address_gps_lng?: number | null;
};

export type CreateOrderResult = {
  id: number;
  display_code?: string;
  status: OrderStatus | string;
  total?: number;
  currency?: string;
  geo_link?: string | null;
};

export type Order = {
  id: number;
  display_code?: string | null;

  user_id?: number | null;

  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;

  user?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;

  address?: any | null;
  geo_link?: string | null;

  total?: number | null;
  currency?: string | null;

  status: OrderStatus;
  created_at: string;
  updated_at?: string | null;

  // champs admin (peuvent être masqués côté backend selon rôle)
  commission_duumini?: number | null;

  // champs calculés / list endpoint
  items_amount?: number | null;

  totals?: {
    items_amount?: number;
    delivery_fee?: number;
    amount?: number;
    currency?: string;
  } | null;
};

export type OrderItem = {
  id?: number;
  order_id?: number;

  product_id: number;

  /** ✅ variante choisie (si applicable) */
  variant_id?: number | null;
  variant_key?: string | null;
  variant_label?: string | null;

  qty: number;
  unit_price: number;

  // infos produit
  product_name?: string | null;
  product_cover?: string | null;

  // compat anciens payloads
  name?: string | null;
  price?: number | null;

  // optionnel: infos variante joinées si ton backend les renvoie
  variant?: {
    id: number;
    size?: string | null;
    color?: string | null;
    sku?: string | null;
    price_override?: number | null;
  } | null;

  // optionnel: si tu renvoies un objet produit
  product?: {
    id?: number;
    name?: string | null;
    cover?: string | null;
    product_cover?: string | null;
    image_url?: string | null;
  } | null;

  // ✅ promo figée (si colonnes existent et si ton backend les renvoie)
  promo_applied?: 0 | 1 | number | null;
  promo_type?: "PERCENT" | "AMOUNT" | string | null;
  promo_value?: number | null;
  base_unit_price?: number | null;
};

export type OrderDetail = Order & {
  items: OrderItem[];

  delivery?: {
    mode?: "EXPRESS" | "SIMPLE" | "PROMO_FREE" | "CASABLANCA" | "CITY";
    fee?: number | null;
    currency?: string | null;
  } | null;

  totals?: {
    items_amount: number;
    delivery_fee: number;
    amount: number;
    currency: string;
  };

  payment?: {
    method: string;
    note?: string | null;
  };
};

/* ===== Types pour la liste ===== */
export type ListOrdersOptions = {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | "ALL";
  mineOnly?: boolean;
  q?: string;
};

/* ===== Helpers ===== */
function toPositiveInt(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function cleanString(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

/** ✅ Normalise un item, sans exiger name/price (UI only) */
function normalizeItemInput(x: any): OrderItemInput | null {
  if (!x || typeof x !== "object") return null;

  const product_id = toPositiveInt(x.product_id, 0);
  const qty = toPositiveInt(x.qty ?? x.quantity ?? x.count, 0);
  if (!product_id || !qty) return null;

  const variant_id =
    x.variant_id == null || x.variant_id === ""
      ? null
      : toPositiveInt(x.variant_id, 0) || null;

  const out: OrderItemInput = { product_id, qty, variant_id };

  // UI-only (optionnels)
  if (x.name != null) out.name = cleanString(x.name) || undefined;
  if (x.price != null && Number.isFinite(Number(x.price))) out.price = Number(x.price);

  if (x.variant_key != null) out.variant_key = cleanString(x.variant_key) || null;
  if (x.variant_label != null) out.variant_label = cleanString(x.variant_label) || null;

  return out;
}

function normalizeCreatePayload(payload: CreateOrderPayload): CreateOrderPayload {
  const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
  const cleanItems = itemsRaw.map(normalizeItemInput).filter(Boolean) as OrderItemInput[];

  return {
    ...payload,
    contact: {
      ...payload.contact,
      phone: cleanString(payload?.contact?.phone),
    },
    items: cleanItems,
  };
}

/* ===== API ===== */
export async function listOrders(opts: ListOrdersOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const query: Record<string, any> = { page, pageSize };

  if (opts.status && opts.status !== "ALL") query.status = opts.status;
  if (opts.mineOnly) query.mine = 1;
  if (opts.q && cleanString(opts.q)) query.q = cleanString(opts.q);

  return api.get<Paginated<Order>>("/api/orders", { query });
}

export async function getOrder(id: number) {
  return api.get<OrderDetail>(`/api/orders/${id}`);
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  return api.put<{ ok: true }>(`/api/orders/${id}/status`, { status });
}

export async function cancelOrder(id: number) {
  return api.post<{ ok: true; status: "CANCELLED" }>(`/api/orders/${id}/cancel`, {});
}

export async function createOrder(payload: CreateOrderPayload) {
  return api.post<CreateOrderResult>("/api/orders", normalizeCreatePayload(payload));
}

export async function createGuestOrder(payload: CreateOrderPayload) {
  return api.post<CreateOrderResult>("/api/orders/guest", normalizeCreatePayload(payload));
}
