// src/services/companies.ts
import { api } from "./http";

export type SupplierType =
  | "FABRICANT"
  | "IMPORTATEUR"
  | "GROSSISTE"
  | "DISTRIBUTEUR"
  | "AUTRE";

export type InternalRole =
  | "OWNER"
  | "MANAGER"
  | "SALES"
  | "WAREHOUSE"
  | "ACCOUNTANT"
  | "VIEWER";

export type KybStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type Company = {
  id: number;
  owner_id: number;
  legal_name: string;
  slug: string;
  description?: string | null;
  supplier_type?: SupplierType | null;
  country_code: string;
  kyb_status: KybStatus;
  is_active: boolean | number;
  created_at?: string;
  my_role?: InternalRole;
};

export type CompanyMember = {
  id: number;
  company_id: number;
  user_id: number;
  internal_role: InternalRole;
  status: "ACTIVE" | "INVITED" | "REMOVED";
  created_at?: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

function extractApiErrorData(err: any): any | null {
  return err?.payload ?? err?.data ?? err?.response?.data ?? err?.body ?? err?.error ?? null;
}

export function companyErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const d = extractApiErrorData(err);
  return (typeof d?.error === "string" && d.error) || err?.message || fallback;
}

/** Entreprises dont l'utilisateur connecté est membre actif */
export async function listMyCompanies() {
  const res = await api.get<{ items: Company[] }>("/api/companies/mine");
  return res.items;
}

/** Détail d'une entreprise (public si active, sinon réservé aux membres) */
export async function getCompany(id: number) {
  return api.get<Company>(`/api/companies/${id}`);
}

export type CreateCompanyPayload = {
  legal_name: string;
  description?: string | null;
  supplier_type?: SupplierType | null;
  country_code?: string;
};

export async function createCompany(payload: CreateCompanyPayload) {
  return api.post<Company>("/api/companies", payload);
}

export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

export async function updateCompany(id: number, payload: UpdateCompanyPayload) {
  return api.put<Company>(`/api/companies/${id}`, payload);
}

export async function deleteCompany(id: number) {
  return api.delete<{ ok: true }>(`/api/companies/${id}`);
}

/** ===== Membres ===== */

export async function listCompanyMembers(companyId: number) {
  const res = await api.get<{ items: CompanyMember[] }>(
    `/api/companies/${companyId}/members`
  );
  return res.items;
}

export async function addCompanyMember(
  companyId: number,
  payload: { user_id: number; internal_role: InternalRole }
) {
  return api.post<{ ok: true }>(`/api/companies/${companyId}/members`, payload);
}

export async function updateCompanyMemberRole(
  companyId: number,
  userId: number,
  internal_role: InternalRole
) {
  return api.patch<{ ok: true }>(`/api/companies/${companyId}/members/${userId}`, {
    internal_role,
  });
}

export async function removeCompanyMember(companyId: number, userId: number) {
  return api.delete<{ ok: true }>(`/api/companies/${companyId}/members/${userId}`);
}
