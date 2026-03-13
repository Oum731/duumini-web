import { api } from "./http";

export type ReportType = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

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
  details_json?: any;

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

function unwrap<T = any>(r: any): T {
  return (r?.data ?? r) as T;
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

  if (params.type) query.type = params.type;
  if (params.currency) query.currency = params.currency;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;

  const r = await api.get("/api/reports/sales", {
    params: query,
  });

  const body = unwrap<any>(r);

  if (body && Array.isArray(body.items)) {
    return { items: body.items };
  }

  if (Array.isArray(body)) {
    return { items: body };
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
    period_type: payload.period_type,
  };

  if (payload.date) body.date = payload.date;
  if (payload.currency) body.currency = payload.currency;

  const r = await api.post("/api/reports/sales/run", body);
  return unwrap<RunSalesReportResponse>(r);
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