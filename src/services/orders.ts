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
    // Pour user connecté : on peut envoyer first/last
    first_name?: string;
    last_name?: string;
    // Pour invité : on peut simplement envoyer "name"
    name?: string;
    phone: string; // +2126XXXXXXXX (obligatoire pour invité ET connecté)
  };
  address: {
    // Pour user connecté : tu peux continuer à envoyer tout
    ville?: string;                  // "Casablanca" (optionnel si GPS seul)
    commune?: string;                // optionnel si GPS seul
    quartier?: string | null;        // null si GPS fourni
    gps?: { lat: number; lng: number } | null; // localisation si l'user l'indique
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
  display_code?: string;           // ✅ code alphanumérique
  status: OrderStatus | string;
  total?: number;
  currency?: string;
  geo_link?: string | null;        // 🔗 lien vers Google Maps si GPS fourni
};

/** Format minimal d’une commande dans la liste */
export type Order = {
  id: number;
  display_code?: string | null;    // ✅ affichage pour UI
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

  /** 💡 image principale du produit (JOIN sur product_images) */
  product_cover?: string | null;
  image_url?: string | null;
  /** compat éventuelle avec un alias "cover" */
  cover?: string | null;

  // fallbacks possibles selon API
  name?: string | null;
  price?: number | null;

  // compat si l’API renvoie un objet imbriqué product
  product?: {
    id?: number;
    name?: string | null;
    cover?: string | null;
    product_cover?: string | null;
    image_url?: string | null;
  } | null;
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

export async function listOrders(opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  return api.get<Paginated<Order>>("/api/orders", { query: { page, pageSize } });
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
