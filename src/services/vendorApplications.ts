// src/services/vendorApplications.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type ApplicantType = "VENDEUR" | "FOURNISSEUR" | "RESTAURANT";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type VendorApplication = {
  id: number;
  applicant_type: ApplicantType;
  legal_name: string;
  contact_phone: string;
  contact_email: string | null;
  country_code: string;
  city: string | null;
  message: string | null;
  dfe_url: string | null;
  rc_url: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
};

function extractApiErrorData(err: any): any | null {
  return err?.payload ?? err?.data ?? err?.response?.data ?? err?.body ?? err?.error ?? null;
}

export function applicationErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const d = extractApiErrorData(err);
  return (typeof d?.error === "string" && d.error) || err?.message || fallback;
}

export type SubmitVendorApplicationPayload = {
  applicant_type: ApplicantType;
  legal_name: string;
  contact_phone: string;
  contact_email?: string | null;
  country_code: string;
  city?: string | null;
  message?: string | null;
};

/** Soumission publique — aucune authentification requise. */
export async function submitVendorApplication(
  payload: SubmitVendorApplicationPayload,
  files: { dfe?: File | null; rc?: File | null }
) {
  const fd = new FormData();
  fd.append("applicant_type", payload.applicant_type);
  fd.append("legal_name", payload.legal_name);
  fd.append("contact_phone", payload.contact_phone);
  if (payload.contact_email) fd.append("contact_email", payload.contact_email);
  fd.append("country_code", payload.country_code);
  if (payload.city) fd.append("city", payload.city);
  if (payload.message) fd.append("message", payload.message);
  if (files.dfe) fd.append("dfe_file", files.dfe);
  if (files.rc) fd.append("rc_file", files.rc);

  return api.post<{ id: number; status: ApplicationStatus }>(
    "/api/vendor-applications",
    fd
  );
}

/** ===== Admin ===== */

export async function listVendorApplications(opts: {
  page?: number;
  pageSize?: number;
  status?: ApplicationStatus;
  q?: string;
} = {}) {
  return api.get<Paginated<VendorApplication>>("/api/vendor-applications", {
    query: {
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 50,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.q ? { q: opts.q } : {}),
    },
  });
}

export async function getVendorApplication(id: number) {
  return api.get<VendorApplication>(`/api/vendor-applications/${id}`);
}

export async function approveVendorApplication(id: number, password: string) {
  return api.patch<{ ok: true; user_id: number }>(
    `/api/vendor-applications/${id}/approve`,
    { password }
  );
}

export async function rejectVendorApplication(id: number, admin_notes?: string) {
  return api.patch<{ ok: true }>(`/api/vendor-applications/${id}/reject`, {
    admin_notes: admin_notes || null,
  });
}
