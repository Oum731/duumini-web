import { api } from "./http";

export type ReportType = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type PaymentBreakdownRow = {
  payment_status: string;
  cnt: number;
  amount: number;
  paid_amount: number;
  remaining_amount?: number;
};

export type SalesReportDetails = {
  gross_items_amount?: number;
  admin_discount_amount?: number;
  net_items_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  payment_breakdown?: PaymentBreakdownRow[];

  included_statuses?: string[];
  date_column_used?: string | null;
  delivery_column_used?: string | null;

  item_qty_column_used?: string | null;
  item_price_column_used?: string | null;
  item_price_mode?:
    | "PURCHASE_PRICE_SNAPSHOT"
    | "ORDER_ITEM_SALE_PRICE_FALLBACK"
    | "ORDER_SUMMARY_FALLBACK"
    | string
    | null;
};

export type SalesReport = {
  id: number;
  period_type: ReportType;
  period_start: string;
  period_end: string;
  currency: string;

  orders_count?: number;
  items_amount?: number;
  delivery_amount?: number;
  total_amount?: number;
  duumini_commission?: number;
  details_json?: SalesReportDetails | string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

export type ListSalesReportsParams = {
  type?: ReportType;
  from?: string;
  to?: string;
  currency?: string;
};

export type ListSalesReportsResponse = {
  items: SalesReport[];
};

export type RunSalesReportPayload = {
  period_type: ReportType;
  date?: string;
  currency?: string;
};

export type RunSalesReportResponse = {
  ok: true;
  report: SalesReport;
};

export type BackfillSalesReportsPayload = {
  period_type: ReportType;
  currency?: string;
  fromDate?: string;
  toDate?: string;
};

export type BackfillSalesReportsResponse = {
  ok: true;
  period_type: ReportType;
  currency: string;
  generated: number;
  skipped?: boolean;
  message?: string;
  from?: string;
  to?: string;
};

export type BackfillAllSalesReportsPayload = {
  currency?: string;
  fromDate?: string;
  toDate?: string;
};

export type BackfillAllSalesReportsResponse = {
  ok: true;
  currency: string;
  results: BackfillSalesReportsResponse[];
};

function unwrap<T = any>(r: any): T {
  return (r?.data ?? r) as T;
}

export function parseSalesReportDetails(
  value: SalesReport["details_json"]
): SalesReportDetails | null {
  if (!value) return null;
  if (typeof value === "object") return value as SalesReportDetails;

  try {
    return JSON.parse(value) as SalesReportDetails;
  } catch {
    return null;
  }
}

function filenameFromDisposition(
  disposition?: string | null,
  fallback = "download"
) {
  if (!disposition) return fallback;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const asciiMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (asciiMatch?.[1]) return asciiMatch[1];

  return fallback;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1200);
}

async function fetchBlob(
  url: string
): Promise<{ blob: Blob; disposition: string | null }> {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    "";

  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (!res.ok) {
    let msg = `Erreur HTTP ${res.status}`;

    try {
      const text = await res.text();
      if (text) msg = text;
    } catch {}

    throw new Error(msg);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition");

  return { blob, disposition };
}

export async function listSalesReports(
  params: ListSalesReportsParams = {}
): Promise<ListSalesReportsResponse> {
  const query: Record<string, any> = {};

  if (params.type) query.type = String(params.type).toUpperCase();
  if (params.currency) query.currency = String(params.currency).toUpperCase();
  if (params.from) query.from = String(params.from).slice(0, 19);
  if (params.to) query.to = String(params.to).slice(0, 19);

  const r = await api.get("/api/reports/sales", { query });
  const body = unwrap<any>(r);

  if (body && Array.isArray(body.items)) {
    return { items: body.items as SalesReport[] };
  }

  if (Array.isArray(body)) {
    return { items: body as SalesReport[] };
  }

  return { items: [] };
}

export async function getSalesReport(id: number): Promise<SalesReport> {
  const r = await api.get(`/api/reports/sales/${id}`);
  return unwrap<SalesReport>(r);
}

export async function runSalesReport(
  payload: RunSalesReportPayload
): Promise<RunSalesReportResponse> {
  const body: Record<string, any> = {
    period_type: String(payload.period_type).toUpperCase(),
  };

  if (payload.date) body.date = payload.date;
  if (payload.currency) body.currency = String(payload.currency).toUpperCase();

  const r = await api.post("/api/reports/sales/run", body);
  return unwrap<RunSalesReportResponse>(r);
}

export async function backfillSalesReports(
  payload: BackfillSalesReportsPayload
): Promise<BackfillSalesReportsResponse> {
  const body: Record<string, any> = {
    period_type: String(payload.period_type).toUpperCase(),
  };

  if (payload.currency) body.currency = String(payload.currency).toUpperCase();
  if (payload.fromDate) body.fromDate = payload.fromDate;
  if (payload.toDate) body.toDate = payload.toDate;

  const r = await api.post("/api/reports/sales/backfill", body);
  return unwrap<BackfillSalesReportsResponse>(r);
}

export async function backfillAllSalesReports(
  payload: BackfillAllSalesReportsPayload = {}
): Promise<BackfillAllSalesReportsResponse> {
  const body: Record<string, any> = {};

  if (payload.currency) body.currency = String(payload.currency).toUpperCase();
  if (payload.fromDate) body.fromDate = payload.fromDate;
  if (payload.toDate) body.toDate = payload.toDate;

  const r = await api.post("/api/reports/sales/backfill-all", body);
  return unwrap<BackfillAllSalesReportsResponse>(r);
}

/* =========================
 * EXPORTS FICHIERS
 * ======================= */

export async function downloadSalesReportPdf(id: number): Promise<void> {
  const { blob, disposition } = await fetchBlob(`/api/reports/sales/${id}/pdf`);
  const filename = filenameFromDisposition(
    disposition,
    `sales-report-${id}.pdf`
  );
  triggerBlobDownload(blob, filename);
}

export async function getSalesReportPdfBlob(id: number): Promise<Blob> {
  const { blob } = await fetchBlob(`/api/reports/sales/${id}/pdf`);
  return blob;
}

export async function downloadSalesReportImage(id: number): Promise<void> {
  const { blob, disposition } = await fetchBlob(
    `/api/reports/sales/${id}/image`
  );
  const filename = filenameFromDisposition(
    disposition,
    `sales-report-${id}.png`
  );
  triggerBlobDownload(blob, filename);
}

export async function getSalesReportImageBlob(id: number): Promise<Blob> {
  const { blob } = await fetchBlob(`/api/reports/sales/${id}/image`);
  return blob;
}

export async function openSalesReportPdfInNewTab(id: number): Promise<void> {
  const blob = await getSalesReportPdfBlob(id);
  const url = window.URL.createObjectURL(blob);

  window.open(url, "_blank", "noopener,noreferrer");

  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 10000);
}