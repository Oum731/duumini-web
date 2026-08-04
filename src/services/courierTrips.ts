// src/services/courierTrips.ts
import { api } from "./http";
import type { Paginated } from "./types";
import type { PaymentMethod } from "../pages/checkout/types";

export type TripStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "CANCELLED";

export type CommissionStatus = "PENDING" | "PAID";

export type TripType = "PICKUP" | "SHOPPING";

export type CourierTrip = {
  id: number;
  requester_user_id: number;
  livreur_user_id: number | null;
  country_code: string;
  zone_code: string | null;
  livreur_lat: string | null;
  livreur_lng: string | null;
  livreur_location_at: string | null;
  pickup_address: string;
  pickup_lat: string;
  pickup_lng: string;
  dropoff_address: string;
  dropoff_lat: string;
  dropoff_lng: string;
  distance_km: string;
  package_description: string | null;
  trip_type: TripType;
  is_heavy_package: 0 | 1;
  price: string;
  commission_rate: string;
  commission_amount: string;
  commission_status: CommissionStatus;
  commission_paid_at: string | null;
  payment_method: PaymentMethod;
  status: TripStatus;
  requester_phone: string;
  requester_name: string | null;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

function extractApiErrorData(err: any): any | null {
  return err?.payload ?? err?.data ?? err?.response?.data ?? err?.body ?? err?.error ?? null;
}

export function courierTripErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const d = extractApiErrorData(err);
  return (typeof d?.error === "string" && d.error) || err?.message || fallback;
}

export type CreateCourierTripPayload = {
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  package_description?: string | null;
  trip_type: TripType;
  is_heavy_package: boolean;
  payment_method: PaymentMethod;
  country_code: string;
  requester_phone: string;
  requester_name?: string | null;
};

export async function createCourierTrip(payload: CreateCourierTripPayload) {
  return api.post<{
    id: number;
    distance_km: number;
    price: number;
    commission_amount: number;
    status: TripStatus;
  }>("/api/courier-trips", payload);
}

export async function getCourierTrip(id: number) {
  return api.get<CourierTrip>(`/api/courier-trips/${id}`);
}

export async function updateTripPosition(id: number, lat: number, lng: number) {
  return api.patch<{ ok: true }>(`/api/courier-trips/${id}/position`, { lat, lng });
}

export async function listMyCourierTrips(opts: { page?: number; pageSize?: number } = {}) {
  return api.get<Paginated<CourierTrip>>("/api/courier-trips/mine", {
    query: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 20 },
  });
}

export async function listAvailableCourierTrips(opts: { page?: number; pageSize?: number } = {}) {
  return api.get<Paginated<CourierTrip>>("/api/courier-trips/available", {
    query: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 20 },
  });
}

export async function acceptCourierTrip(id: number) {
  return api.patch<{ ok: true }>(`/api/courier-trips/${id}/accept`);
}

export async function updateCourierTripStatus(id: number, status: "IN_PROGRESS" | "DELIVERED") {
  return api.patch<{ ok: true }>(`/api/courier-trips/${id}/status`, { status });
}

export async function cancelCourierTrip(id: number) {
  return api.patch<{ ok: true }>(`/api/courier-trips/${id}/cancel`);
}

/** ===== Admin ===== */

export async function listAllCourierTrips(opts: {
  page?: number;
  pageSize?: number;
  status?: TripStatus;
  country_code?: string;
} = {}) {
  return api.get<Paginated<CourierTrip>>("/api/courier-trips", {
    query: {
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 50,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.country_code ? { country_code: opts.country_code } : {}),
    },
  });
}

export async function setCourierTripCommissionStatus(id: number, commission_status: CommissionStatus) {
  return api.patch<{ ok: true }>(`/api/courier-trips/${id}/commission-status`, {
    commission_status,
  });
}
