// src/services/supplierProducts.ts
import { api } from "./http";

export type SupplierProduct = {
  id: number;
  supplier_shop_id: number;
  title: string;
  slug: string | null;
  description: string | null;
  unit: string | null;
  stock_qty: number;
  price_wholesale: number;
  is_active: 0 | 1;
  created_at?: string;
  updated_at?: string;

  supplier_name?: string | null;
  supplier_city?: string | null;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export async function listSupplierProducts(query?: {
  page?: number;
  pageSize?: number;
  supplier_shop_id?: number;
  q?: string;
  onlyActive?: 0 | 1;
}) {
  return api.get<{ items: SupplierProduct[]; pageInfo: PageInfo }>(
    "/api/supplier-products",
    { query }
  );
}

export async function createSupplierProduct(payload: {
  supplier_shop_id?: number;
  title: string;
  slug?: string | null;
  description?: string | null;
  unit?: string | null;
  stock_qty?: number;
  price_wholesale?: number;
  is_active?: 0 | 1;
}) {
  return api.post<SupplierProduct>("/api/supplier-products", payload);
}

export async function updateSupplierProduct(
  id: number,
  patch: Partial<{
    title: string;
    slug: string | null;
    description: string | null;
    unit: string | null;
    stock_qty: number;
    price_wholesale: number;
    is_active: 0 | 1;
  }>
) {
  return api.put<SupplierProduct>(`/api/supplier-products/${id}`, patch);
}

export async function deleteSupplierProduct(id: number) {
  return api.delete<{ ok: true }>(`/api/supplier-products/${id}`);
}