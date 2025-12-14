// src/services/orders.ts
import { api } from "./http";
import type { Paginated } from "./types";

/* ===== Types ===== */
export type OrderStatus = "OPEN" | "PREPARATION" | "DELIVERY" | "DONE" | "CANCELLED";

export type OrderItemInput = {
  product_id: number;
  name: string;
  price: number;
  qty: number;
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
    mode: "EXPRESS" | "SIMPLE" | "PROMO_FREE";
    fee: number;
    currency: "MAD";
  };
  items: OrderItemInput[];
  totals: {
    items_count: number;
    items_amount: number;
    delivery_fee: number;
    amount: number;
    currency: string;
  };
  payment?: {
    method: "COD" | string;
    note?: string | null;
  };

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
  user_id?: number;
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
  updated_at?: string;

  commission_duumini?: number | null;

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
  qty: number;
  unit_price: number;

  product_name?: string | null;
  product_cover?: string | null;
  image_url?: string | null;
  cover?: string | null;

  name?: string | null;
  price?: number | null;

  product?: {
    id?: number;
    name?: string | null;
    cover?: string | null;
    product_cover?: string | null;
    image_url?: string | null;
  } | null;
};

export type OrderDetail = Order & {
  items: OrderItem[];
  delivery?: {
    mode?: "EXPRESS" | "SIMPLE" | "PROMO_FREE";
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
};

/* ===== API ===== */

export async function listOrders(opts: ListOrdersOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const query: Record<string, any> = { page, pageSize };

  if (opts.status && opts.status !== "ALL") {
    query.status = opts.status;
  }
  if (opts.mineOnly) {
    query.mine = 1;
  }

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
  return api.post<CreateOrderResult>("/api/orders", payload);
}

export async function createGuestOrder(payload: CreateOrderPayload) {
  return api.post<CreateOrderResult>("/api/orders/guest", payload);
}
