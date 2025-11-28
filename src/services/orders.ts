// src/services/orders.ts
import { api } from "./http";
import type { Paginated } from "./types";

/* ===== Types ===== */
export type OrderStatus = "OPEN" | "PREPARATION" | "DELIVERY" | "DONE" | "CANCELLED";

export type OrderItemInput = {
  product_id: number;
  name: string;
  /**
   * 💡 Prix indicatif envoyé au backend (pour logs / message WhatsApp).
   *
   * Le montant réellement facturé au client est toujours recalculé côté serveur
   * à partir des données en BDD (prix produit + commission Duumini) et stocké
   * dans order_items.unit_price.
   *
   * 👉 Donc côté front, ce champ "price" sert uniquement à :
   *    - générer un récap texte lisible dans WhatsApp,
   *    - éventuellement faire un affichage provisoire,
   *    mais il n’est JAMAIS utilisé pour la facturation finale.
   */
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
  /**
   * Items envoyés par le front.
   * - product_id / qty sont utilisés réellement pour créer la commande
   *   + recalculer les vrais prix (unit_price) côté backend.
   * - name / price servent uniquement à composer le message WhatsApp backoffice.
   */
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

  /** 💰 Montant total payé par le client (produits + livraison) */
  total?: number | null;
  currency?: string | null;

  status: OrderStatus;
  created_at: string;
  updated_at?: string;

  /** 🔹 Commission totale Duumini pour cette commande (ADMIN / VENDEUR) */
  commission_duumini?: number | null;

  /**
   * 🔹 Montant total des articles (hors frais de livraison, côté client)
   *     = somme(oi.qty * oi.unit_price) pour cette commande.
   */
  items_amount?: number | null;

  /** 🔹 Totaux pré-calculés par le backend (facultatif mais pratique) */
  totals?: {
    items_amount?: number;   // sous-total articles (prix client, hors livraison)
    delivery_fee?: number;
    amount?: number;         // total TTC payé (articles + livraison)
    currency?: string;
  } | null;
};

/** Item détaillé renvoyé par GET /api/orders/:id (ex: avec image/noms) */
export type OrderItem = {
  id?: number;
  order_id?: number;
  product_id: number;
  qty: number;

  /**
   * 💰 Prix unitaire payé par le client (inclut la commission Duumini).
   *
   * C'est la valeur calculée côté backend au moment de la commande, puis
   * stockée dans order_items.unit_price (snapshot). Les éventuelles
   * modifications futures du prix produit n'impactent PAS cette commande.
   */
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

/* ===== Types pour la liste ===== */

export type ListOrdersOptions = {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | "ALL";
  /** ✅ Si true, on demande explicitement "mes commandes uniquement" */
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
    query.mine = 1; // flag qui sera lu par le backend
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
