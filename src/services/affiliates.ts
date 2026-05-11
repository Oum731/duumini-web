import { api } from "./http";

export type AffiliateStatus = "ACTIVE" | "INACTIVE";
export type AffiliateCommissionStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "CANCELLED";

export type RevenuePeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type Paginated<T> = {
  items: T[];
  pageInfo: {
    page: number;
    pageSize: number;
    total?: number;
    totalItems?: number;
    totalPages?: number;
    hasPrevPage?: boolean;
    hasNextPage?: boolean;
  };
};

export type AffiliateUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
} | null;

export type Affiliate = {
  id: number;
  user_id: number | null;
  affiliate_code: string | null;
  referral_slug: string | null;
  name: string | null;
  phone: string | null;
  commission_rate: number;
  status: AffiliateStatus;
  total_clicks: number;
  total_orders: number;
  total_earnings: number;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  share_url_by_code?: string | null;
  share_url_by_slug?: string | null;
  track_url_by_code?: string | null;
  track_url_by_slug?: string | null;
  user?: AffiliateUser;
};

export type AffiliateCommission = {
  id: number;
  affiliate_id: number;
  order_id?: number | null;
  amount?: number | null;
  base_amount?: number | null;
  commission_rate?: number | null;
  status: AffiliateCommissionStatus;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  product_id?: number | null;
  period_day?: string | null;
  period_week_start?: string | null;
  period_month?: string | null;
  period_year?: string | null;
  [key: string]: any;
};

export type AffiliateClick = {
  id: number;
  affiliate_id: number;
  affiliate_code?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  referer_url?: string | null;
  landing_url?: string | null;
  created_at?: string | null;
  product_id?: number | null;
  source?: string | null;
  device?: string | null;
  [key: string]: any;
};

export type AffiliateRevenueSnapshot = {
  affiliate_id?: number | null;
  period_type?: RevenuePeriod;
  period_key?: string;
  period_start?: string;
  period_end?: string;
  clicks_count: number;
  orders_count: number;
  sales_amount: number;
  commission_pending: number;
  commission_approved: number;
  commission_paid: number;
  commission_cancelled: number;
  commission_total: number;
  currency?: string;
};

export type AffiliateRevenueHistoryRow = AffiliateRevenueSnapshot & {
  id?: number;
};

export type AffiliateDashboardResponse = {
  affiliate: Affiliate;
  global?: Partial<AffiliateRevenueSnapshot>;
  today: Partial<AffiliateRevenueSnapshot>;
  week: Partial<AffiliateRevenueSnapshot>;
  month: Partial<AffiliateRevenueSnapshot>;
  year: Partial<AffiliateRevenueSnapshot>;
  recent_months?: AffiliateRevenueHistoryRow[];
};

export type AffiliateRevenueSummaryResponse = {
  period: RevenuePeriod;
  global: Partial<AffiliateRevenueSnapshot>;
};

export type RebuildAffiliateReportsPayload = {
  affiliate_id?: number | null;
  from?: string | null;
  to?: string | null;
};

export type CreateAffiliatePayload = {
  user_id?: number | null;
  affiliate_code?: string | null;
  referral_slug?: string | null;
  name: string;
  phone?: string | null;
  commission_rate?: number;
  status?: AffiliateStatus;
  notes?: string | null;
};

export type UpdateAffiliatePayload = Partial<CreateAffiliatePayload>;

export type UpdateAffiliateStatusPayload = {
  status: AffiliateStatus;
};

export type UpdateCommissionStatusPayload = {
  status: AffiliateCommissionStatus;
};

export type MyAffiliateResponse = {
  is_affiliate: boolean;
  affiliate: Affiliate | null;
};

export type MyAffiliateDashboardResponse = {
  affiliate: Affiliate;
  global: Partial<AffiliateRevenueSnapshot>;
  today: Partial<AffiliateRevenueSnapshot>;
  week: Partial<AffiliateRevenueSnapshot>;
  month: Partial<AffiliateRevenueSnapshot>;
  year: Partial<AffiliateRevenueSnapshot>;
};

export type TrackAffiliateClickPayload = {
  affiliate_code: string;
  landing_url?: string | null;
  product_id?: number | null;
  source?: string | null;
};

function cleanString(value: unknown) {
  const v = String(value ?? "").trim();
  return v || "";
}

function cleanNullableString(value: unknown) {
  const v = cleanString(value);
  return v || null;
}

function normalizeAffiliateCode(value: unknown) {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  return v || "";
}

function normalizeSlug(value: unknown) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return v || "";
}

function normalizePositiveInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function normalizeBase(value?: string | null) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizePath(path?: string | null, fallback = "/") {
  const raw = String(path || fallback).trim();
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function appendQueryParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function normalizeAffiliateStatus(value: unknown): AffiliateStatus | null {
  const v = String(value || "").trim().toUpperCase();
  if (v === "ACTIVE") return "ACTIVE";
  if (v === "INACTIVE") return "INACTIVE";
  return null;
}

function normalizeCommissionStatus(value: unknown): AffiliateCommissionStatus | null {
  const v = String(value || "").trim().toUpperCase();
  if (v === "PENDING") return "PENDING";
  if (v === "APPROVED") return "APPROVED";
  if (v === "PAID") return "PAID";
  if (v === "CANCELLED") return "CANCELLED";
  return null;
}

function normalizeRevenuePeriod(value: unknown): RevenuePeriod {
  const v = String(value || "").trim().toUpperCase();
  if (v === "DAY") return "DAY";
  if (v === "WEEK") return "WEEK";
  if (v === "YEAR") return "YEAR";
  return "MONTH";
}

function normalizeCreateAffiliatePayload(payload: CreateAffiliatePayload) {
  return {
    ...(payload.user_id != null
      ? { user_id: normalizePositiveInt(payload.user_id) }
      : {}),
    ...(payload.affiliate_code != null
      ? { affiliate_code: normalizeAffiliateCode(payload.affiliate_code) }
      : {}),
    ...(payload.referral_slug != null
      ? { referral_slug: normalizeSlug(payload.referral_slug) }
      : {}),
    name: cleanString(payload.name),
    ...(payload.phone != null
      ? { phone: cleanNullableString(payload.phone) }
      : {}),
    ...(payload.commission_rate != null
      ? { commission_rate: Number(payload.commission_rate || 0) }
      : {}),
    ...(payload.status
      ? { status: normalizeAffiliateStatus(payload.status) || "ACTIVE" }
      : {}),
    ...(payload.notes != null ? { notes: cleanNullableString(payload.notes) } : {}),
  };
}

function normalizeUpdateAffiliatePayload(payload: UpdateAffiliatePayload) {
  const out: Record<string, any> = {};

  if (payload.user_id !== undefined) {
    out.user_id =
  payload.user_id === null || payload.user_id === undefined
    ? null
    : normalizePositiveInt(payload.user_id);
  }

  if (payload.affiliate_code !== undefined) {
    out.affiliate_code = normalizeAffiliateCode(payload.affiliate_code);
  }

  if (payload.referral_slug !== undefined) {
    out.referral_slug = normalizeSlug(payload.referral_slug);
  }

  if (payload.name !== undefined) {
    out.name = cleanNullableString(payload.name);
  }

  if (payload.phone !== undefined) {
    out.phone = cleanNullableString(payload.phone);
  }

  if (payload.commission_rate !== undefined) {
    out.commission_rate = Number(payload.commission_rate || 0);
  }

  if (payload.status !== undefined) {
    out.status = normalizeAffiliateStatus(payload.status) || "ACTIVE";
  }

  if (payload.notes !== undefined) {
    out.notes = cleanNullableString(payload.notes);
  }

  return out;
}

const HTTP_API_BASE =
  (typeof import.meta !== "undefined" &&
    ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)) ||
  "";

export const API_BASE = normalizeBase(HTTP_API_BASE);

export const WEB_BASE = normalizeBase(
  ((typeof import.meta !== "undefined" &&
    (((import.meta as any)?.env?.VITE_WEB_BASE as string | undefined) ||
      ((import.meta as any)?.env?.VITE_PUBLIC_WEB_BASE as string | undefined) ||
      ((import.meta as any)?.env?.VITE_APP_BASE_URL as string | undefined))) ||
    (typeof window !== "undefined" ? window.location.origin : "")) as string,
);

export async function listAffiliates(
  opts: {
    page?: number;
    pageSize?: number;
    q?: string;
    status?: AffiliateStatus | "ALL" | "";
  } = {},
) {
  const query: Record<string, any> = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
  };

  if (opts.q && cleanString(opts.q)) query.q = cleanString(opts.q);
  if (opts.status && opts.status !== "ALL") query.status = opts.status;

  return api.get<Paginated<Affiliate>>("/api/affiliates", { query });
}

export async function getAffiliate(id: number) {
  return api.get<Affiliate>(`/api/affiliates/${id}`);
}

export async function createAffiliate(payload: CreateAffiliatePayload) {
  return api.post<Affiliate>(
    "/api/affiliates",
    normalizeCreateAffiliatePayload(payload),
  );
}

export async function updateAffiliate(id: number, payload: UpdateAffiliatePayload) {
  return api.put<Affiliate>(
    `/api/affiliates/${id}`,
    normalizeUpdateAffiliatePayload(payload),
  );
}

export async function updateAffiliateStatus(
  id: number,
  payload: UpdateAffiliateStatusPayload,
) {
  return api.put<Affiliate>(`/api/affiliates/${id}/status`, {
    status: normalizeAffiliateStatus(payload.status) || "ACTIVE",
  });
}

export async function listAffiliateCommissions(
  affiliateId: number,
  opts: {
    page?: number;
    pageSize?: number;
    status?: AffiliateCommissionStatus | "ALL" | "";
  } = {},
) {
  const query: Record<string, any> = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
  };

  if (opts.status && opts.status !== "ALL") {
    query.status = opts.status;
  }

  return api.get<Paginated<AffiliateCommission>>(
    `/api/affiliates/${affiliateId}/commissions`,
    { query },
  );
}

export async function listAffiliateClicks(
  affiliateId: number,
  opts: {
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query: Record<string, any> = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
  };

  return api.get<Paginated<AffiliateClick>>(
    `/api/affiliates/${affiliateId}/clicks`,
    { query },
  );
}

export async function updateAffiliateCommissionStatus(
  commissionId: number,
  payload: UpdateCommissionStatusPayload,
) {
  return api.put<AffiliateCommission>(
    `/api/affiliates/commissions/${commissionId}/status`,
    {
      status: normalizeCommissionStatus(payload.status) || "PENDING",
    },
  );
}

export async function getAffiliatesRevenueSummary(period: RevenuePeriod = "MONTH") {
  return api.get<AffiliateRevenueSummaryResponse>(
    "/api/affiliates/reports/summary",
    {
      query: { period: normalizeRevenuePeriod(period) },
    },
  );
}

export async function getAffiliatesRevenueHistory(
  opts: {
    period?: RevenuePeriod;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query: Record<string, any> = {
    period: normalizeRevenuePeriod(opts.period || "MONTH"),
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 12,
  };

  return api.get<Paginated<AffiliateRevenueHistoryRow>>(
    "/api/affiliates/reports/history",
    { query },
  );
}

export async function rebuildAffiliateReports(
  payload: RebuildAffiliateReportsPayload = {},
) {
  return api.post<{
    success: boolean;
    affiliate_id?: number | null;
    from?: string | null;
    to?: string | null;
  }>("/api/affiliates/reports/rebuild", payload);
}

export async function getAffiliateDashboard(affiliateId: number) {
  return api.get<AffiliateDashboardResponse>(
    `/api/affiliates/${affiliateId}/dashboard`,
  );
}

export async function getAffiliateRevenueHistory(
  affiliateId: number,
  opts: {
    period?: RevenuePeriod;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query: Record<string, any> = {
    period: normalizeRevenuePeriod(opts.period || "MONTH"),
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 12,
  };

  return api.get<Paginated<AffiliateRevenueHistoryRow>>(
    `/api/affiliates/${affiliateId}/reports/history`,
    { query },
  );
}

export async function getMyAffiliate() {
  return api.get<MyAffiliateResponse>("/api/affiliate/me");
}

export async function getMyAffiliateDashboard() {
  return api.get<MyAffiliateDashboardResponse>("/api/affiliate/me/dashboard");
}

export async function getMyAffiliateCommissions(
  opts: {
    page?: number;
    pageSize?: number;
    status?: AffiliateCommissionStatus | "ALL" | "";
  } = {},
) {
  const query: Record<string, any> = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 10,
  };

  if (opts.status && opts.status !== "ALL") {
    query.status = opts.status;
  }

  return api.get<Paginated<AffiliateCommission>>(
    "/api/affiliate/me/commissions",
    { query },
  );
}

export async function getMyAffiliateClicks(
  opts: {
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query: Record<string, any> = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 10,
  };

  return api.get<Paginated<AffiliateClick>>("/api/affiliate/me/clicks", {
    query,
  });
}

export async function getMyAffiliateHistory(
  opts: {
    period?: RevenuePeriod;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const query: Record<string, any> = {
    period: normalizeRevenuePeriod(opts.period || "MONTH"),
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 12,
  };

  return api.get<Paginated<AffiliateRevenueHistoryRow>>(
    "/api/affiliate/me/history",
    { query },
  );
}

export async function trackAffiliateClick(payload: TrackAffiliateClickPayload) {
  const affiliateCode = normalizeAffiliateCode(payload.affiliate_code);

  if (!affiliateCode) {
    return null;
  }

  const target = payload.landing_url || "/";
  const productId = normalizePositiveInt(payload.product_id);
  const source = cleanNullableString(payload.source || "web") || "web";

  const path = `/api/affiliates/track/${encodeURIComponent(affiliateCode)}`;
  const query: Record<string, any> = {
    to: target,
    source,
  };

  if (productId) {
    query.product_id = productId;
  }

  return api.get<unknown>(path, { query });
}

export function getAffiliatePublicUrlByCode(code: string) {
  const normalizedCode = normalizeAffiliateCode(code);
  if (!WEB_BASE || !normalizedCode) return "";

  return `${WEB_BASE}/?ref=${encodeURIComponent(normalizedCode)}`;
}

export function getAffiliatePublicUrlBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!WEB_BASE || !normalized) return "";

  return `${WEB_BASE}/ref/${encodeURIComponent(normalized)}`;
}

export function getAffiliateProductPublicUrlByCode(
  code: string,
  productId: number,
  productPath?: string,
) {
  const normalizedCode = normalizeAffiliateCode(code);
  const cleanProductId = normalizePositiveInt(productId);

  if (!WEB_BASE || !normalizedCode || !cleanProductId) return "";

  const path = normalizePath(productPath, `/products/${cleanProductId}`);
  const urlPath = appendQueryParam(path, "ref", normalizedCode);

  return `${WEB_BASE}${urlPath}`;
}

export function getAffiliateProductPublicUrlBySlug(
  slug: string,
  productId: number,
  productPath?: string,
) {
  const normalizedSlug = normalizeSlug(slug);
  const cleanProductId = normalizePositiveInt(productId);

  if (!WEB_BASE || !normalizedSlug || !cleanProductId) return "";

  const path = normalizePath(productPath, `/products/${cleanProductId}`);
  const urlPath = appendQueryParam(path, "ref", normalizedSlug);

  return `${WEB_BASE}${urlPath}`;
}

export function getAffiliateTrackingUrlByCode(code: string, to = "/") {
  const normalizedCode = normalizeAffiliateCode(code);
  const target = normalizePath(to, "/");

  if (!API_BASE || !normalizedCode) return "";

  return `${API_BASE}/api/affiliates/track/${encodeURIComponent(
    normalizedCode,
  )}?to=${encodeURIComponent(target)}`;
}

export function getAffiliateTrackingUrlBySlug(slug: string, to = "/") {
  const normalizedSlug = normalizeSlug(slug);
  const target = normalizePath(to, "/");

  if (!API_BASE || !normalizedSlug) return "";

  return `${API_BASE}/api/affiliates/ref/${encodeURIComponent(
    normalizedSlug,
  )}?to=${encodeURIComponent(target)}`;
}

export function getAffiliateProductTrackingUrlByCode(
  code: string,
  productId: number,
  source = "dashboard",
  productPath?: string,
) {
  const normalizedCode = normalizeAffiliateCode(code);
  const cleanProductId = normalizePositiveInt(productId);
  const target = normalizePath(
    productPath,
    cleanProductId ? `/products/${cleanProductId}` : "/",
  );

  if (!API_BASE || !normalizedCode || !cleanProductId) return "";

  return `${API_BASE}/api/affiliates/track/${encodeURIComponent(
    normalizedCode,
  )}?to=${encodeURIComponent(target)}&product_id=${cleanProductId}&source=${encodeURIComponent(
    source || "dashboard",
  )}`;
}

export function getAffiliateProductTrackingUrlBySlug(
  slug: string,
  productId: number,
  source = "dashboard",
  productPath?: string,
) {
  const normalizedSlug = normalizeSlug(slug);
  const cleanProductId = normalizePositiveInt(productId);
  const target = normalizePath(
    productPath,
    cleanProductId ? `/products/${cleanProductId}` : "/",
  );

  if (!API_BASE || !normalizedSlug || !cleanProductId) return "";

  return `${API_BASE}/api/affiliates/ref/${encodeURIComponent(
    normalizedSlug,
  )}?to=${encodeURIComponent(target)}&product_id=${cleanProductId}&source=${encodeURIComponent(
    source || "dashboard",
  )}`;
}