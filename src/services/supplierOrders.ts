// src/services/supplierOrders.ts
import { api } from "./http";

export type SupplierOrderStatus =
  | "OPEN"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "DONE"
  | "CANCELLED";

export type SupplierOrder = {
  id: number;
  vendor_shop_id: number;
  supplier_shop_id: number;
  zone_id: number | null;
  delivery_fee: number;
  address_text: string | null;
  status: SupplierOrderStatus;
  created_by_user_id: number | null;
  actor_admin_id: number | null;
  created_at?: string;
  updated_at?: string;

  zone_city?: string | null;
  zone_name?: string | null;
  vendor_shop_name?: string | null;
  supplier_shop_name?: string | null;
};

export type SupplierOrderItem = {
  id: number;
  supplier_order_id: number;
  supplier_product_id: number;
  qty: number;
  unit_price: number;
  line_total: number;
  created_at?: string;

  product_title?: string | null;
  product_unit?: string | null;
};

export type SupplierOrderDetail = SupplierOrder & { items: SupplierOrderItem[] };

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export async function listSupplierOrders(query?: {
  page?: number;
  pageSize?: number;
  status?: SupplierOrderStatus;
  vendor_shop_id?: number;
  supplier_shop_id?: number;
}) {
  return api.get<{ items: SupplierOrder[]; pageInfo: PageInfo }>(
    "/api/supplier-orders",
    { query }
  );
}

export async function getSupplierOrder(id: number) {
  return api.get<SupplierOrderDetail>(`/api/supplier-orders/${id}`);
}

export async function createSupplierOrder(payload: {
  supplier_shop_id: number;
  vendor_shop_id?: number;
  zone_id?: number | null;
  address_text?: string | null;
  items: Array<{
    supplier_product_id: number;
    qty: number;
    unit_price?: number;
  }>;
}) {
  return api.post<SupplierOrderDetail>("/api/supplier-orders", payload);
}

export async function updateSupplierOrderStatus(
  id: number,
  status: SupplierOrderStatus
) {
  return api.patch<SupplierOrder>(`/api/supplier-orders/${id}/status`, { status });
}