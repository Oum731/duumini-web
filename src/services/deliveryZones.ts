// src/services/deliveryZones.ts
import { api } from "./http";

export type DeliveryZonePickupType = "ADDRESS" | "VENDOR_POINT";

export type DeliveryZone = {
  id: number;
  city: string;
  zone_name: string;
  base_fee: number;
  pickup_type: DeliveryZonePickupType;
  pickup_vendor_shop_id: number | null;
  is_active: 0 | 1;
  created_at?: string;
  updated_at?: string;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export async function listDeliveryZones(query?: {
  page?: number;
  pageSize?: number;
  city?: string;
  q?: string;
  onlyActive?: 0 | 1;
}) {
  return api.get<{ items: DeliveryZone[]; pageInfo: PageInfo }>(
    "/api/delivery-zones",
    { query }
  );
}

export async function createDeliveryZone(payload: {
  city: string;
  zone_name: string;
  base_fee: number;
  pickup_type?: DeliveryZonePickupType;
  pickup_vendor_shop_id?: number | null;
  is_active?: 0 | 1;
}) {
  return api.post<DeliveryZone>("/api/delivery-zones", payload);
}

export async function updateDeliveryZone(
  id: number,
  patch: Partial<{
    city: string;
    zone_name: string;
    base_fee: number;
    pickup_type: DeliveryZonePickupType;
    pickup_vendor_shop_id: number | null;
    is_active: 0 | 1;
  }>
) {
  return api.put<DeliveryZone>(`/api/delivery-zones/${id}`, patch);
}

export async function deleteDeliveryZone(id: number) {
  return api.delete<{ ok: true }>(`/api/delivery-zones/${id}`);
}