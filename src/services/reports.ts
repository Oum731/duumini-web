// src/services/reports.ts
import { api } from "./http";

export type ReportType = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type SalesReport = {
  id: number;

  period_type: ReportType;
  period_start: string; // YYYY-MM-DD ou ISO
  period_end: string;   // YYYY-MM-DD ou ISO
  currency: string;

  // JSON agrégé (selon ton schema)
  data?: any;

  created_at?: string | null;
  updated_at?: string | null;
};

export type ListSalesReportsParams = {
  type?: ReportType;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  currency?: string;
};

export type ListSalesReportsResponse = { items: SalesReport[] };

function unwrap<T = any>(r: any): T {
  // axios => r.data
  // fetch wrapper => r
  return (r?.data ?? r) as T;
}

/** GET /api/reports/sales?type=DAILY&from=...&to=...&currency=MAD */
export async function listSalesReports(
  params: ListSalesReportsParams = {},
): Promise<ListSalesReportsResponse> {
  const qs: Record<string, any> = {};
  if (params.type) qs.type = params.type;
  if (params.currency) qs.currency = params.currency;
  if (params.from) qs.from = params.from;
  if (params.to) qs.to = params.to;

  const r = await api.get("/api/reports/sales", { params: qs });
  const body = unwrap<any>(r);

  // attendu: { items: [...] }
  if (body && Array.isArray(body.items)) return { items: body.items };

  // fallback si API renvoie tableau direct
  if (Array.isArray(body)) return { items: body };

  return { items: [] };
}

/** GET /api/reports/sales/:id */
export async function getSalesReport(id: number): Promise<SalesReport> {
  const r = await api.get(`/api/reports/sales/${id}`);
  return unwrap<SalesReport>(r);
}

/** POST /api/reports/sales/run { period_type, date, currency } */
export async function runSalesReport(payload: {
  period_type: ReportType;
  date?: string; // ISO ou YYYY-MM-DD (anchor)
  currency?: string;
}): Promise<{ ok: true; report: SalesReport }> {
  const r = await api.post("/api/reports/sales/run", payload);
  return unwrap(r);
}