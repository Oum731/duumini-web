// src/services/subscriptions.ts
import { api } from "./http";

export type BillingCycle = "MONTHLY" | "YEARLY";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
export type EffectiveStatus = SubscriptionStatus | "NONE";

export type SubscriptionPlan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_amount: number;
  price_currency: string;
  billing_cycle: BillingCycle;
  trial_days: number;
  is_active: 0 | 1;
  created_at?: string;
  updated_at?: string;
};

export type CompanySubscriptionRow = {
  company_id: number;
  legal_name: string;
  slug: string;
  supplier_type: string | null;
  company_is_active: 0 | 1;
  subscription_id: number | null;
  plan_id: number | null;
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  note: string | null;
  subscription_updated_at: string | null;
  plan_name: string | null;
  plan_code: string | null;
  effective_status: EffectiveStatus;
};

export type SubscriptionEvent = {
  id: number;
  event_type: "TRIAL_STARTED" | "ACTIVATED" | "RENEWED" | "EXPIRED" | "CANCELLED" | "PLAN_CHANGED";
  plan_id: number | null;
  plan_name?: string | null;
  performed_by: number | null;
  performed_by_first_name?: string | null;
  performed_by_last_name?: string | null;
  note: string | null;
  created_at: string;
};

export type CompanySubscriptionDetail = {
  id: number;
  company_id: number;
  plan_id: number | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  note: string | null;
  plan_name?: string | null;
  plan_code?: string | null;
  price_amount?: number;
  price_currency?: string;
  billing_cycle?: BillingCycle;
  effective_status: EffectiveStatus;
};

function unwrap<T = any>(r: any): T {
  return (r?.data ?? r) as T;
}

export async function listSubscriptionPlans(all = false): Promise<{ items: SubscriptionPlan[] }> {
  const r = await api.get("/api/subscriptions/plans", all ? { query: { all: "1" } } : undefined);
  return unwrap(r);
}

export async function createSubscriptionPlan(payload: {
  code: string;
  name: string;
  description?: string;
  price_amount: number;
  price_currency?: string;
  billing_cycle: BillingCycle;
  trial_days?: number;
}): Promise<{ id: number; ok: true }> {
  const r = await api.post("/api/subscriptions/plans", payload);
  return unwrap(r);
}

export async function updateSubscriptionPlan(
  id: number,
  payload: Partial<Pick<SubscriptionPlan, "name" | "description" | "price_amount" | "price_currency" | "billing_cycle" | "trial_days" | "is_active">>
): Promise<{ ok: true }> {
  const r = await api.patch(`/api/subscriptions/plans/${id}`, payload);
  return unwrap(r);
}

export async function listCompanySubscriptions(): Promise<{ items: CompanySubscriptionRow[] }> {
  const r = await api.get("/api/subscriptions/companies");
  return unwrap(r);
}

export async function getCompanySubscription(
  companyId: number
): Promise<{ subscription: CompanySubscriptionDetail | null; events: SubscriptionEvent[] }> {
  const r = await api.get(`/api/subscriptions/companies/${companyId}`);
  return unwrap(r);
}

export async function startCompanyTrial(
  companyId: number,
  payload: { plan_id: number; trial_days?: number; note?: string }
): Promise<{ ok: true }> {
  const r = await api.post(`/api/subscriptions/companies/${companyId}/start-trial`, payload);
  return unwrap(r);
}

export async function activateCompanySubscription(
  companyId: number,
  payload: { plan_id: number; current_period_end: string; note?: string }
): Promise<{ ok: true }> {
  const r = await api.post(`/api/subscriptions/companies/${companyId}/activate`, payload);
  return unwrap(r);
}

export async function cancelCompanySubscription(
  companyId: number,
  note?: string
): Promise<{ ok: true }> {
  const r = await api.post(`/api/subscriptions/companies/${companyId}/cancel`, { note });
  return unwrap(r);
}

export function subscriptionErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const data = err?.payload ?? err?.data ?? err?.response?.data ?? null;
  return data?.error || data?.message || err?.message || fallback;
}
