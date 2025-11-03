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
    first_name: string;
    last_name: string;
    phone: string; // +2126XXXXXXXX
  };
  address: {
    ville: string;                  // "Casablanca"
    commune: string;                // requis (string, pas null)
    quartier: string | null;        // null si GPS fourni
    gps: { lat: number; lng: number } | null;
  };
  delivery: {
    mode: "EXPRESS" | "SIMPLE";
    fee: number;
    currency: "MAD";
  };
  items: OrderItemInput[];
  totals: {
    items_count: number;
    items_amount: number;
    delivery_fee: number;
    amount: number;
    currency: string;               // "MAD"
  };
  payment?: {
    method: "COD" | string;
    note?: string | null;
  };

  // Compat SQL optionnelle (si backend lit des colonnes à plat)
  address_city?: string;
  address_commune?: string | null;
  address_district?: string | null;
  address_gps_lat?: number | null;
  address_gps_lng?: number | null;
};

export type CreateOrderResult = {
  id: number;
  status: OrderStatus | string;
  total?: number;
  currency?: string;
};

/** Format minimal d’une commande dans la liste */
export type Order = {
  id: number;
  user_id?: number;

  /** 💡 Pour l’Admin: infos client en priorité via contact, sinon via user */
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

  address?: any | null;      // JSON côté backend
  geo_link?: string | null;
  total?: number | null;
  currency?: string | null;  // "MAD"
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
};

/** Item détaillé renvoyé par GET /api/orders/:id (ex: avec image/noms) */
export type OrderItem = {
  id?: number;
  order_id?: number;
  product_id: number;
  qty: number;
  unit_price: number;
  // enrichissements
  product_name?: string | null;
  product_cover?: string | null;
  image_url?: string | null;
  // fallbacks possibles selon API
  name?: string | null;
  price?: number | null;
};

/** Détails d’une commande (GET /api/orders/:id) */
export type OrderDetail = Order & {
  items: OrderItem[];
  delivery?: {
    mode?: "EXPRESS" | "SIMPLE";
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

/* ===== API ===== */

/** Liste paginée — { items, pageInfo } */
export async function listOrders(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  return api.get<Paginated<Order>>("/api/orders", { query: { page, pageSize } });
}

/** Détails d’une commande (incl. contact/user/address/delivery/items/totals) */
export async function getOrder(id: number) {
  return api.get<OrderDetail>(`/api/orders/${id}`);
}

/** Mise à jour du statut */
export async function updateOrderStatus(id: number, status: OrderStatus) {
  return api.put<{ ok: true }>(`/api/orders/${id}/status`, { status });
}

/** Annulation */
export async function cancelOrder(id: number) {
  return api.post<{ ok: true; status: "CANCELLED" }>(`/api/orders/${id}/cancel`, {});
}

/** Création (payload conforme à Checkout.tsx) */
export async function createOrder(payload: CreateOrderPayload) {
  return api.post<CreateOrderResult>("/api/orders", payload);
}
