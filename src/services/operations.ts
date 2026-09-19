// src/services/operations.ts
import { api } from "./http";
import type { Paginated } from "./types";

export type OperationStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export type Operation = {
  id: number;
  op_date: string;
  subject: string;
  city: string | null;
  type: string | null;
  responsible_user_id: number | null;
  status: OperationStatus;
  due_date: string | null;
  resolution: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  responsible_first_name?: string | null;
  responsible_last_name?: string | null;
  created_by_first_name?: string | null;
  created_by_last_name?: string | null;
};

export async function listOperations(params: {
  page?: number;
  pageSize?: number;
  status?: OperationStatus;
  city?: string;
  responsible_user_id?: number;
} = {}): Promise<Paginated<Operation>> {
  const query: Record<string, any> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.status) query.status = params.status;
  if (params.city) query.city = params.city;
  if (params.responsible_user_id) query.responsible_user_id = params.responsible_user_id;

  return api.get<Paginated<Operation>>("/api/operations", { query });
}

export async function createOperation(payload: {
  op_date: string;
  subject: string;
  city?: string | null;
  type?: string | null;
  responsible_user_id?: number | null;
  due_date?: string | null;
  resolution?: string | null;
}): Promise<{ id: number; ok: true }> {
  return api.post("/api/operations", payload);
}

export async function updateOperation(
  id: number,
  payload: Partial<{
    op_date: string;
    subject: string;
    city: string | null;
    type: string | null;
    responsible_user_id: number | null;
    status: OperationStatus;
    due_date: string | null;
    resolution: string | null;
  }>
): Promise<{ ok: true }> {
  return api.put(`/api/operations/${id}`, payload);
}

export async function removeOperation(id: number): Promise<{ ok: true }> {
  return api.delete(`/api/operations/${id}`);
}

export function operationErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const data = err?.payload ?? err?.data ?? err?.response?.data ?? null;
  return data?.error || data?.message || err?.message || fallback;
}
