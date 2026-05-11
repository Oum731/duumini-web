import { api, API_BASE } from "./http";
import { attachAffiliateCodeToOrderPayload } from "./ordersAffiliate";

/** ✅ Aligné backend: { items, pageInfo } */
export type Paginated<T> = {
  items: T[];
  pageInfo: {
    [x: string]: number; page: number; pageSize: number; total: number 
};
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

export type AdminDiscountType = "NONE" | "AMOUNT" | "PERCENT";
export type CustomerRole = "CLIENT" | "VENDEUR";

export type AdminDiscount = {
  type: AdminDiscountType;
  value?: number;
  amount?: number;
  label?: string | null;
  by_admin_id?: number | null;
};

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

  name?: string;
  price?: number;
  variant_key?: string | null;
  variant_label?: string | null;
};

export type OrderContactInput = {
  first_name?: string;
  last_name?: string;
  name?: string;
  phone?: string;

  ville?: string;
  city?: string;
  commune?: string;
  quartier?: string | null;
  district?: string | null;
  address_line?: string | null;

  role?: CustomerRole | string;
  commercial_name?: string | null;
  ice?: string | null;
};

export type CreateOrderPayload = {
  contact?: OrderContactInput;

  address?: {
    ville?: string;
    city?: string;
    commune?: string;
    quartier?: string | null;
    district?: string | null;
    address_line?: string | null;
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

  payment?: {
    paid_amount?: number;
    amount?: number;
    add_amount?: number;
    method?:
      | "CASH"
      | "COD"
      | "BANK_TRANSFER"
      | "BANK"
      | "TRANSFER"
      | "VIREMENT"
      | string;
    note?: string | null;
    status?: PaymentStatus;
  };

  address_city?: string;
  address_commune?: string | null;
  address_district?: string | null;
  address_gps_lat?: number | null;
  address_gps_lng?: number | null;

  affiliate_code?: string | null;
};

export type CreateAdminOrderPayload = CreateOrderPayload & {
  customer_id?: number;
  customer_role?: CustomerRole | string;

  customer?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    phone?: string;
    ville?: string;
    city?: string;
    commune?: string;
    quartier?: string | null;
    district?: string | null;

    role?: CustomerRole | string;
    commercial_name?: string | null;
    ice?: string | null;
  };

  admin_discount?: {
    type?: AdminDiscountType;
    value?: number;
    label?: string | null;
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

  customer_role?: CustomerRole | string;
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    role?: CustomerRole | string | null;
    commercial_name?: string | null;
    ice?: string | null;
  } | null;

  affiliate?: {
    id?: number;
    affiliate_code?: string | null;
    commission_rate?: number;
    commission_amount?: number;
    base_amount?: number;
  } | null;

  admin_discount?: AdminDiscount | null;
  totals?: OrderTotals | null;
};

export type OrderTotals = {
  items_amount?: number;
  items_subtotal?: number;
  admin_discount_amount?: number;
  discounted_items_amount?: number;
  delivery_fee?: number;
  amount?: number;
  currency?: string;

  duumini_commission?: number | null;
  duumini_amount?: number | null;
};

export type Order = {
  id: number;
  display_code?: string | null;

  user_id?: number | null;
  customer_role?: CustomerRole | string | null;

  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;

    city?: string | null;
    ville?: string | null;
    commune?: string | null;
    district?: string | null;
    quartier?: string | null;
    address_line?: string | null;

    role?: CustomerRole | string | null;
    commercial_name?: string | null;
    ice?: string | null;
  } | null;

  address?: any | null;
  geo_link?: string | null;

  total?: number | null;
  currency?: string | null;

  status: OrderStatus;
  created_at: string;
  updated_at?: string | null;

  commission_duumini?: number | null;
  items_amount?: number | null;

  totals?: OrderTotals | null;
  admin_discount?: AdminDiscount | null;

  payment?: OrderPayment | null;

  payment_status?: PayStatus | string | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;

  receipt_number?: string | null;
  receipt_token?: string | null;

  affiliate_id?: number | null;
  affiliate_code?: string | null;
  affiliate_commission_rate?: number | null;
  affiliate_commission_amount?: number | null;
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
    items_subtotal?: number;
    admin_discount_amount?: number;
    discounted_items_amount?: number;
    delivery_fee: number;
    amount: number;
    currency: string;
    duumini_commission?: number | null;
    duumini_amount?: number | null;
  };

  admin_discount?: AdminDiscount | null;
  payment?: OrderPayment | null;
};

/* ===== List options ===== */
export type ListOrdersOptions = {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | "ALL";
  statuses?: OrderStatus[] | null;
  mineOnly?: boolean;
  q?: string;
  payment_status?: PayStatus | "ALL";
  pay?: PayStatus | "ALL";
};

/* ===== Update payment ===== */
export type UpdateOrderPaymentPayload = {
  mode?: "SET" | "ADD";
  paid_amount?: number;
  add_amount?: number;
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

function toPositiveInt(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function cleanString(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function cleanNullableString(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toNumOrNull(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCustomerRoleInput(value: any): CustomerRole {
  return String(value || "").trim().toUpperCase() === "VENDEUR"
    ? "VENDEUR"
    : "CLIENT";
}

function normalizeAffiliateCode(value: any) {
  const v = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return v || null;
}

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
  if (x.price != null && Number.isFinite(Number(x.price))) {
    out.price = Number(x.price);
  }

  if (x.variant_key != null) out.variant_key = cleanString(x.variant_key) || null;
  if (x.variant_label != null) out.variant_label = cleanString(x.variant_label) || null;

  return out;
}

function normalizeContactInput(input: any): OrderContactInput | undefined {
  if (!input || typeof input !== "object") return undefined;

  const first_name = cleanString(input.first_name) || undefined;
  const last_name = cleanString(input.last_name) || undefined;
  const name = cleanString(input.name) || undefined;
  const phone = cleanString(input.phone) || undefined;

  const ville = cleanString(input.ville) || undefined;
  const city = cleanString(input.city) || undefined;
  const commune = cleanString(input.commune) || undefined;
  const quartier = cleanNullableString(input.quartier);
  const district = cleanNullableString(input.district);
  const address_line = cleanNullableString(input.address_line);

  const role =
    input.role != null ? normalizeCustomerRoleInput(input.role) : undefined;

  const commercial_name = cleanNullableString(input.commercial_name);
  const ice = cleanNullableString(input.ice);

  const hasAny =
    first_name ||
    last_name ||
    name ||
    phone ||
    ville ||
    city ||
    commune ||
    quartier ||
    district ||
    address_line ||
    role ||
    commercial_name ||
    ice;

  if (!hasAny) return undefined;

  return {
    ...(first_name ? { first_name } : {}),
    ...(last_name ? { last_name } : {}),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(ville ? { ville } : {}),
    ...(city ? { city } : {}),
    ...(commune ? { commune } : {}),
    ...(quartier != null ? { quartier } : {}),
    ...(district != null ? { district } : {}),
    ...(address_line != null ? { address_line } : {}),
    ...(role ? { role } : {}),
    ...(commercial_name != null ? { commercial_name } : {}),
    ...(ice != null ? { ice } : {}),
  };
}

function normalizeAdminDiscountInput(input: any) {
  const type = String(input?.type || "NONE").trim().toUpperCase() as AdminDiscountType;
  const value = toNumOrNull(input?.value);
  const label = cleanString(input?.label) || null;

  if (!["NONE", "AMOUNT", "PERCENT"].includes(type)) {
    return { type: "NONE" as AdminDiscountType };
  }

  if (type === "NONE") {
    return { type: "NONE" as AdminDiscountType };
  }

  return {
    type,
    ...(value != null && value > 0 ? { value } : {}),
    ...(label ? { label } : {}),
  };
}

function normalizeCreatePayload(payload: CreateOrderPayload): CreateOrderPayload {
  const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
  const cleanItems = itemsRaw.map(normalizeItemInput).filter(Boolean) as OrderItemInput[];

  const paidAmount = payload?.payment?.paid_amount ?? payload?.payment?.amount ?? null;
  const contact = normalizeContactInput(payload?.contact);
  const affiliate_code = normalizeAffiliateCode((payload as any)?.affiliate_code);

  return {
    ...payload,
    ...(contact ? { contact } : {}),
    ...(affiliate_code ? { affiliate_code } : {}),
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

  const normalizedCustomer = normalizeContactInput(payload?.customer);
  const normalizedRole =
    payload?.customer_role != null
      ? normalizeCustomerRoleInput(payload.customer_role)
      : normalizedCustomer?.role != null
      ? normalizeCustomerRoleInput(normalizedCustomer.role)
      : base.contact?.role != null
      ? normalizeCustomerRoleInput(base.contact.role)
      : undefined;

  return {
    ...(base as any),
    ...(customer_id ? { customer_id } : {}),
    ...(normalizedRole ? { customer_role: normalizedRole } : {}),
    ...(normalizedCustomer ? { customer: normalizedCustomer } : {}),
    ...(payload?.admin_discount
      ? { admin_discount: normalizeAdminDiscountInput(payload.admin_discount) }
      : {}),
  };
}

function normalizeBase(u?: string | null) {
  return String(u || "").replace(/\/+$/, "");
}

function withAffiliateCode<T extends Record<string, unknown>>(
  payload: T,
): T & { affiliate_code?: string | null } {
  return attachAffiliateCodeToOrderPayload(payload);
}

/* ===== API ===== */
export async function listOrders(opts: ListOrdersOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const query: Record<string, any> = { page, pageSize };

  if (opts.status && opts.status !== "ALL") query.status = opts.status;

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
  return api.post<CreateOrderResult>(
    "/api/orders",
    withAffiliateCode(normalizeCreatePayload(payload)),
  );
}

export async function createGuestOrder(payload: CreateOrderPayload) {
  return api.post<CreateOrderResult>(
    "/api/orders/guest",
    withAffiliateCode(normalizeCreatePayload(payload)),
  );
}

export async function createAdminOrder(payload: CreateAdminOrderPayload) {
  return api.post<CreateOrderResult>(
    "/api/orders/admin",
    withAffiliateCode(normalizeAdminCreatePayload(payload)),
  );
}

export async function updateOrderPayment(id: number, payload: UpdateOrderPaymentPayload) {
  return api.put<UpdateOrderPaymentResult>(`/api/orders/${id}/payment`, payload);
}

export function getOrderReceiptPdfUrl(orderId: number) {
  const base = normalizeBase(API_BASE);
  return base
    ? `${base}/api/orders/${orderId}/receipt.pdf`
    : `/api/orders/${orderId}/receipt.pdf`;
}

export function getPublicReceiptPdfUrl(token: string) {
  const base = normalizeBase(API_BASE);
  const t = encodeURIComponent(String(token || "").trim());
  if (!t) return "";
  return base ? `${base}/api/orders/receipt/${t}.pdf` : `/api/orders/receipt/${t}.pdf`;
}

export function getPublicReceiptJsonUrl(token: string) {
  const base = normalizeBase(API_BASE);
  const t = encodeURIComponent(String(token || "").trim());
  if (!t) return "";
  return base ? `${base}/api/orders/receipt/${t}` : `/api/orders/receipt/${t}`;
}

export async function sendReceiptWhatsApp(orderId: number) {
  return api.post<{ ok: true; to: string; pdfUrl: string }>(
    `/api/orders/${orderId}/send-receipt-whatsapp`,
    {},
  );
}