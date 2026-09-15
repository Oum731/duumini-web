// src/services/warehouses.ts
import { api } from "./http";

export type Warehouse = {
  id: number;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country_code: string;
  is_active: 0 | 1;
  created_at?: string;
  updated_at?: string;
};

export type WarehouseStockRow = {
  id: number;
  warehouse_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  min_threshold: number;
  updated_at: string;
  product_name: string;
  product_brand?: string | null;
  variant_size?: string | null;
  variant_color?: string | null;
  variant_sku?: string | null;
};

export type StockMovement = {
  id: number;
  warehouse_id: number;
  product_id: number | null;
  variant_id: number | null;
  type:
    | "IN_PURCHASE"
    | "IN_RETURN_CANCEL"
    | "IN_ADJUSTMENT"
    | "OUT_SALE"
    | "OUT_ADJUSTMENT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT";
  qty: number;
  unit_cost: number | null;
  reference_type: "ORDER" | "SUPPLIER_DELIVERY" | "MANUAL" | "TRANSFER";
  reference_id: number | null;
  performed_by: number | null;
  note: string | null;
  created_at: string;
  product_name?: string | null;
  performed_by_first_name?: string | null;
  performed_by_last_name?: string | null;
};

export type WarehouseManager = {
  id: number;
  user_id: number;
  is_active: 0 | 1;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
};

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

export async function listWarehouses(): Promise<{ items: Warehouse[] }> {
  const r = await api.get("/api/warehouses");
  return unwrap(r);
}

export async function createWarehouse(payload: {
  name: string;
  code: string;
  address?: string;
  city?: string;
  country_code?: string;
}): Promise<Warehouse> {
  const r = await api.post("/api/warehouses", payload);
  return unwrap(r);
}

export async function updateWarehouse(
  id: number,
  payload: Partial<Pick<Warehouse, "name" | "address" | "city" | "country_code" | "is_active">>
): Promise<{ ok: true }> {
  const r = await api.patch(`/api/warehouses/${id}`, payload);
  return unwrap(r);
}

export async function getWarehouseStock(
  warehouseId: number,
  params: { page?: number; pageSize?: number; q?: string; lowOnly?: boolean } = {}
): Promise<{ items: WarehouseStockRow[]; pageInfo: PageInfo }> {
  const query: Record<string, any> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.q) query.q = params.q;
  if (params.lowOnly) query.lowOnly = "1";

  const r = await api.get(`/api/warehouses/${warehouseId}/stock`, { query });
  return unwrap(r);
}

export async function adjustWarehouseStock(
  warehouseId: number,
  payload: { product_id: number; variant_id?: number | null; delta_qty: number; reason: string }
): Promise<{ ok: true }> {
  const r = await api.post(`/api/warehouses/${warehouseId}/stock/adjust`, payload);
  return unwrap(r);
}

export async function getWarehouseMovements(
  warehouseId: number,
  params: { page?: number; pageSize?: number; product_id?: number; type?: string } = {}
): Promise<{ items: StockMovement[]; pageInfo: PageInfo }> {
  const query: Record<string, any> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.product_id) query.product_id = params.product_id;
  if (params.type) query.type = params.type;

  const r = await api.get(`/api/warehouses/${warehouseId}/movements`, { query });
  return unwrap(r);
}

export async function getWarehouseManagers(
  warehouseId: number
): Promise<{ items: WarehouseManager[] }> {
  const r = await api.get(`/api/warehouses/${warehouseId}/managers`);
  return unwrap(r);
}

export async function assignWarehouseManager(
  warehouseId: number,
  userId: number
): Promise<{ ok: true }> {
  const r = await api.post(`/api/warehouses/${warehouseId}/managers`, { user_id: userId });
  return unwrap(r);
}

export async function removeWarehouseManager(
  warehouseId: number,
  userId: number
): Promise<{ ok: true }> {
  const r = await api.delete(`/api/warehouses/${warehouseId}/managers/${userId}`);
  return unwrap(r);
}

export function warehouseErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const data = err?.payload ?? err?.data ?? err?.response?.data ?? null;
  return data?.error || data?.message || err?.message || fallback;
}
