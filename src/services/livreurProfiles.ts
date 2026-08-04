// src/services/livreurProfiles.ts
import { api } from "./http";
import type { IdDocumentType } from "./vendorApplications";

export type VerificationStatus = "PENDING_VISIT" | "VALIDATED";

export type MyLivreurProfile = {
  country_code: string;
  city: string | null;
  verification_status: VerificationStatus;
  is_blocked: 0 | 1;
  is_available: 0 | 1;
  pending_commission: number;
};

export type AdminLivreurProfile = {
  user_id: number;
  country_code: string;
  city: string | null;
  vehicle_type: string | null;
  id_document_url: string | null;
  id_document_type: IdDocumentType | null;
  photo_url: string | null;
  verification_status: VerificationStatus;
  is_blocked: 0 | 1;
  created_at: string;
  phone: string;
  first_name: string | null;
  pending_commission: string;
};

function extractApiErrorData(err: any): any | null {
  return err?.payload ?? err?.data ?? err?.response?.data ?? err?.body ?? err?.error ?? null;
}

export function livreurProfileErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const d = extractApiErrorData(err);
  return (typeof d?.error === "string" && d.error) || err?.message || fallback;
}

/** Le livreur connecté consulte son propre statut + solde dû. */
export async function getMyLivreurProfile() {
  return api.get<MyLivreurProfile>("/api/livreur-profiles/me");
}

/** Ping de position basse fréquence tant que le livreur est en ligne — sert
 * au matching de proximité pour de nouvelles courses. */
export async function updateMyPosition(lat: number, lng: number) {
  return api.patch<{ ok: true }>("/api/livreur-profiles/me/position", { lat, lng });
}

export async function updateMyAvailability(isAvailable: boolean) {
  return api.patch<{ ok: true; is_available: boolean }>("/api/livreur-profiles/me/availability", {
    is_available: isAvailable,
  });
}

/** ===== Admin ===== */

export async function listLivreurProfiles() {
  return api.get<{ items: AdminLivreurProfile[] }>("/api/livreur-profiles");
}

export async function validateLivreurProfile(userId: number) {
  return api.patch<{ ok: true }>(`/api/livreur-profiles/${userId}/validate`);
}

export async function settleLivreurBalance(userId: number) {
  return api.patch<{ ok: true; settled_trips: number }>(`/api/livreur-profiles/${userId}/settle`);
}
