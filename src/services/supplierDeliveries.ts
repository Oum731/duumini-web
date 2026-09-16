// src/services/supplierDeliveries.ts
import { api } from "./http";

export type SupplierDeliveryItem = {
  id: number;
  product_id: number;
  variant_id: number | null;
  qty: number;
  unit: "PIECE" | "CARTON";
  base_qty: number;
  unit_cost: number;
  product_name?: string | null;
  variant_size?: string | null;
  variant_color?: string | null;
  variant_sku?: string | null;
};

export type SupplierDelivery = {
  id: number;
  supplier_shop_id: number;
  warehouse_id: number;
  reference: string | null;
  status: "RECEIVED" | "CANCELLED";
  received_by: number | null;
  note: string | null;
  created_at: string;
  supplier_name?: string | null;
  warehouse_name?: string | null;
  received_by_first_name?: string | null;
  received_by_last_name?: string | null;
  total_qty?: number;
  total_cost?: number;
};

export type SupplierDeliveryDetail = SupplierDelivery & { items: SupplierDeliveryItem[] };

export type PageInfo = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

function unwrap<T = any>(r: any): T {
  return (r?.data ?? r) as T;
}

export async function listSupplierDeliveries(params: {
  supplier_shop_id?: number;
  warehouse_id?: number;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ items: SupplierDelivery[]; pageInfo: PageInfo }> {
  const query: Record<string, any> = {};
  if (params.supplier_shop_id) query.supplier_shop_id = params.supplier_shop_id;
  if (params.warehouse_id) query.warehouse_id = params.warehouse_id;
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;

  const r = await api.get("/api/supplier-deliveries", { query });
  return unwrap(r);
}

export async function getSupplierDelivery(id: number): Promise<SupplierDeliveryDetail> {
  const r = await api.get(`/api/supplier-deliveries/${id}`);
  return unwrap(r);
}

export async function createSupplierDelivery(payload: {
  supplier_shop_id?: number;
  warehouse_id: number;
  reference?: string;
  note?: string;
  items: Array<{
    product_id: number;
    variant_id?: number | null;
    qty: number;
    unit_cost: number;
    unit?: "PIECE" | "CARTON";
  }>;
}): Promise<{ id: number; ok: true }> {
  const r = await api.post("/api/supplier-deliveries", payload);
  return unwrap(r);
}

export function supplierDeliveryErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const data = err?.payload ?? err?.data ?? err?.response?.data ?? null;
  return data?.error || data?.message || err?.message || fallback;
}
