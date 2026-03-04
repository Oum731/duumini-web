// src/services/orders.ts
import { api, API_BASE } from "./http";

/** ✅ Aligné backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: { page: number; pageSize: number; total: number };
};

/* ===== Types ===== */
export type OrderStatus =
  | "OPEN"
  | "PREPARATION"
  | "DELIVERY"
  | "DONE"
  | "CANCELLED";

/** DB status (orders.payment_status) */
export type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

/** UI status : inclut PENDING (virement en attente) */
export type PayStatus = PaymentStatus | "PENDING";

/** ✅ Payment object renvoyé par le backend */
export type OrderPayment = {
  status: PayStatus;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  method?: string | null;
  note?: string | null;
};

/** ✅ Input envoyé au backend */
export type OrderItemInput = {
  product_id: number;
  qty: number;
  variant_id?: number | null;

  // UI-only (toléré côté API, ignoré si backend ne l'utilise pas)
  name?: string;
  price?: number;
  variant_key?: string | null;
  variant_label?: string | null;
};

export type CreateOrderPayload = {
  contact?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    phone?: string; // ✅ backend accepte aussi contact vide en auth (fallback user)
  };

  address?: {
    ville?: string;
    commune?: string;
    quartier?: string | null;
    gps?: { lat: number; lng: number } | null;
  };

  delivery?: {
    mode?: "EXPRESS" | "SIMPLE" | "PROMO_FREE" | "CASABLANCA" | "CITY";
    fee?: number;
    currency?: "MAD" | string;
  };

  items: OrderItemInput[];

  totals?: {
    items_count?: number;
    items_amount?: number;
    delivery_fee?: number;
    amount?: number;
    currency?: string;
  };

  /** ✅ align backend buildPaymentFromPayload() */
  payment?: {
    paid_amount?: number;
    amount?: number; // alias compat
    add_amount?: number; // (si tu veux l’utiliser plus tard)
    method?:
      | "CASH"
      | "COD"
      | "BANK_TRANSFER"
      | "BANK"
      | "TRANSFER"
      | "VIREMENT"
      | string;
    note?: string | null;
    status?: PaymentStatus; // optionnel, backend recalcule
  };

  // compat legacy
  address_city?: string;
  address_commune?: string | null;
  address_district?: string | null;
  address_gps_lat?: number | null;
  address_gps_lng?: number | null;
};

/** ✅ ADMIN: créer une commande (user OU guest) (backend: POST /api/orders/admin) */
export type CreateAdminOrderPayload = CreateOrderPayload & {
  /** ✅ user existant */
  customer_id?: number;

  /** ✅ guest (sans compte) - compat si le front envoie "customer" */
  customer?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    phone?: string;
  };
};

export type CreateOrderResult = {
  id: number;
  display_code?: string;
  status: OrderStatus | string;
  total?: number;
  currency?: string;
  geo_link?: string | null;
  payment?: OrderPayment | null;

  receipt_number?: string | null;
  receipt_token?: string | null;
};

export type OrderTotals = {
  items_amount?: number;
  delivery_fee?: number;
  amount?: number;
  currency?: string;

  // ✅ backend mis à jour: duumini_commission
  duumini_commission?: number | null;

  // compat ancien champ (au cas où)
  duumini_amount?: number | null;
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

  address?: any | null;
  geo_link?: string | null;

  total?: number | null;
  currency?: string | null;

  status: OrderStatus;
  created_at: string;
  updated_at?: string | null;

  // admin (peut être masqué côté backend)
  commission_duumini?: number | null;

  // list endpoint calc
  items_amount?: number | null;

  totals?: OrderTotals | null;

  payment?: OrderPayment | null;

  payment_status?: PayStatus | string | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;

  // ✅ reçu
  receipt_number?: string | null;
  receipt_token?: string | null;
};

export type OrderItem = {
  id?: number;
  order_id?: number;

  product_id: number;

  variant_id?: number | null;
  variant_key?: string | null;
  variant_label?: string | null;

  qty: number;
  unit_price: number;

  product_name?: string | null;
  product_cover?: string | null;

  name?: string | null;
  price?: number | null;

  // backend join:
  variant_size?: string | null;
  variant_color?: string | null;
  variant_sku?: string | null;

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
    duumini_commission?: number | null;
    duumini_amount?: number | null; // compat
  };

  payment?: OrderPayment | null;
};

/* ===== List options ===== */
export type ListOrdersOptions = {
  page?: number;
  pageSize?: number;

  /** simple status (backend accepte status=OPEN) */
  status?: OrderStatus | "ALL";

  /** multi status (backend accepte statuses=OPEN,DONE) */
  statuses?: OrderStatus[] | null;

  mineOnly?: boolean;
  q?: string;

  payment_status?: PayStatus | "ALL";
  pay?: PayStatus | "ALL"; // alias
};

/* ===== Update payment ===== */
export type UpdateOrderPaymentPayload = {
  mode?: "SET" | "ADD";
  paid_amount?: number; // required si SET
  add_amount?: number; // required si ADD
  method?: string;
  note?: string | null;
};

export type UpdateOrderPaymentResult = {
  ok: true;
  id: number;
  status?: OrderStatus | string;
  display_code?: string;
  payment: OrderPayment;
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

function toNumOrNull(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ✅ Normalise un item (tolère plusieurs clés UI) */
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

  if (x.name != null) out.name = cleanString(x.name) || undefined;
  if (x.price != null && Number.isFinite(Number(x.price))) out.price = Number(x.price);

  if (x.variant_key != null) out.variant_key = cleanString(x.variant_key) || null;
  if (x.variant_label != null) out.variant_label = cleanString(x.variant_label) || null;

  return out;
}

function normalizeCreatePayload(payload: CreateOrderPayload): CreateOrderPayload {
  const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
  const cleanItems = itemsRaw.map(normalizeItemInput).filter(Boolean) as OrderItemInput[];

  const phone = cleanString(payload?.contact?.phone);
  const paidAmount = payload?.payment?.paid_amount ?? payload?.payment?.amount ?? null;

  return {
    ...payload,
    contact: payload.contact
      ? {
          ...payload.contact,
          ...(phone ? { phone } : {}),
        }
      : payload.contact,
    items: cleanItems,
    payment: payload.payment
      ? {
          ...payload.payment,
          ...(paidAmount != null ? { paid_amount: toNumOrNull(paidAmount) ?? 0 } : {}),
        }
      : undefined,
  };
}

function normalizeAdminCreatePayload(
  payload: CreateAdminOrderPayload
): CreateAdminOrderPayload {
  const base = normalizeCreatePayload(payload);

  const cid = (payload as any)?.customer_id;
  const customer_id =
    cid == null || cid === "" ? undefined : toPositiveInt(cid, 0) || undefined;

  // ✅ si customer_id absent => guest: le backend utilisera contact/customer
  return { ...(base as any), ...(customer_id ? { customer_id } : {}) };
}

function normalizeBase(u?: string | null) {
  return String(u || "").replace(/\/+$/, "");
}

/* ===== API ===== */
export async function listOrders(opts: ListOrdersOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const query: Record<string, any> = { page, pageSize };

  // simple status
  if (opts.status && opts.status !== "ALL") query.status = opts.status;

  // multi statuses (backend: statuses=OPEN,DONE)
  if (opts.statuses && Array.isArray(opts.statuses) && opts.statuses.length) {
    query.statuses = opts.statuses.join(",");
  }

  if (opts.mineOnly) query.mine = 1;
  if (opts.q && cleanString(opts.q)) query.q = cleanString(opts.q);

  const pay =
    opts.payment_status && opts.payment_status !== "ALL"
      ? opts.payment_status
      : opts.pay && opts.pay !== "ALL"
      ? opts.pay
      : null;

  if (pay) query.payment_status = pay;

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
  return api.post<CreateOrderResult>(
    "/api/orders/guest",
    normalizeCreatePayload(payload)
  );
}

/** ✅ ADMIN peut passer commande (compte OU invité) */
export async function createAdminOrder(payload: CreateAdminOrderPayload) {
  return api.post<CreateOrderResult>(
    "/api/orders/admin",
    normalizeAdminCreatePayload(payload)
  );
}

export async function updateOrderPayment(id: number, payload: UpdateOrderPaymentPayload) {
  return api.put<UpdateOrderPaymentResult>(`/api/orders/${id}/payment`, payload);
}

/** ✅ Récupérer le PDF reçu (streamed by backend)
 * Important: en dev, évite l’URL relative si pas de proxy Vite.
 */
export function getOrderReceiptPdfUrl(orderId: number) {
  const base = normalizeBase(API_BASE);
  return base
    ? `${base}/api/orders/${orderId}/receipt.pdf`
    : `/api/orders/${orderId}/receipt.pdf`;
}

/** ✅ PDF PUBLIC (sans auth) via token (backend: /api/orders/receipt/:token.pdf) */
export function getPublicReceiptPdfUrl(token: string) {
  const base = normalizeBase(API_BASE);
  const t = encodeURIComponent(String(token || "").trim());
  if (!t) return "";
  return base ? `${base}/api/orders/receipt/${t}.pdf` : `/api/orders/receipt/${t}.pdf`;
}

/** ✅ Reçu JSON public (backend: /api/orders/receipt/:token) */
export function getPublicReceiptJsonUrl(token: string) {
  const base = normalizeBase(API_BASE);
  const t = encodeURIComponent(String(token || "").trim());
  if (!t) return "";
  return base ? `${base}/api/orders/receipt/${t}` : `/api/orders/receipt/${t}`;
}

/** ✅ Envoyer le reçu via WhatsApp (admin only) */
export async function sendReceiptWhatsApp(orderId: number) {
  return api.post<{ ok: true; to: string; pdfUrl: string }>(
    `/api/orders/${orderId}/send-receipt-whatsapp`,
    {}
  );
}