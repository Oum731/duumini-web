import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePercent,
  BarChart3,
  ChevronRight,
  Copy,
  Eye,
  History,
  MousePointerClick,
  Package,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  createAffiliate,
  getAffiliate,
  getAffiliateDashboard,
  getAffiliateProductPublicUrlByCode,
  getAffiliateProductTrackingUrlByCode,
  getAffiliatePublicUrlByCode,
  getAffiliatePublicUrlBySlug,
  getAffiliateRevenueHistory,
  getAffiliatesRevenueHistory,
  getAffiliatesRevenueSummary,
  listAffiliateClicks,
  listAffiliateCommissions,
  listAffiliates,
  rebuildAffiliateReports,
  updateAffiliate,
  updateAffiliateCommissionStatus,
  updateAffiliateStatus,
  type RevenuePeriod,
  type AffiliateRevenueHistoryRow,
  type AffiliateDashboardResponse,
  type AffiliateRevenueSummaryResponse,
  getAffiliateTrackingUrlByCode,
} from "../../services/affiliates";
import { api } from "../../services/http";

type AffiliateStatus = "ACTIVE" | "INACTIVE";
type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

type AffiliateUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
} | null;

type UserOption = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
};

type Affiliate = {
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
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  share_url_by_code?: string | null;
  share_url_by_slug?: string | null;
  user?: AffiliateUser;
};

type AffiliateCommission = {
  id: number;
  affiliate_id: number;
  order_id?: number | null;
  amount?: number | null;
  base_amount?: number | null;
  commission_rate?: number | null;
  status: CommissionStatus;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  total_sales?: number | null;
  total_earnings?: number | null;
  product_id?: number | null;
  period_day?: string | null;
  period_week_start?: string | null;
  period_month?: string | null;
  period_year?: string | null;
  [key: string]: any;
};

type AffiliateClick = {
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

type PageInfo = {
  page: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  total?: number;
};

type AffiliateFormData = {
  user_id: string;
  affiliate_code: string;
  referral_slug: string;
  name: string;
  phone: string;
  commission_rate: string;
  status: AffiliateStatus;
  notes: string;
};

type ProductOption = {
  id: number;
  name: string;
  slug?: string | null;
  price?: number | null;
  promo_price?: number | null;
  stock?: number | null;
  is_active?: boolean | number | null;
  shop_name?: string | null;
  cover?: string | null;
};

const DUU = {
  yellow: "#FFD54A",
  yellowSoft: "#FFF7D6",
  yellowBorder: "rgba(255, 213, 74, 0.45)",
  black: "#111111",
  gray: "#6B7280",
  line: "rgba(17,17,17,0.08)",
  bg: "#FFFDF6",
  white: "#FFFFFF",
  green: "#1FA971",
  greenSoft: "rgba(31,169,113,0.10)",
  red: "#E15554",
  redSoft: "rgba(225,85,84,0.10)",
  blueSoft: "rgba(17,17,17,0.04)",
};

const defaultPageInfo: PageInfo = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasPrevPage: false,
  hasNextPage: false,
};

const defaultForm: AffiliateFormData = {
  user_id: "",
  affiliate_code: "",
  referral_slug: "",
  name: "",
  phone: "",
  commission_rate: "10",
  status: "ACTIVE",
  notes: "",
};

const PRODUCT_ROUTE_PREFIX =
  ((import.meta as any)?.env?.VITE_PRODUCT_ROUTE_PREFIX as string | undefined) ||
  "/products";

function formatMoney(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatNumber(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-FR").format(Number.isFinite(n) ? n : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(d);
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAffiliateCodeLocal(value: unknown) {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return v || "";
}

function extractNameParts(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" ") || "",
  };
}

function buildAffiliateCodeFromName(name: string, seed?: string | number) {
  const { first, last } = extractNameParts(name);

  const firstPart = slugify(first).replace(/-/g, "").slice(0, 3).toUpperCase();
  const lastPart = slugify(last || first).replace(/-/g, "").slice(0, 3).toUpperCase();
  const suffix = String(seed || "")
    .replace(/\D+/g, "")
    .slice(-4);

  return normalizeAffiliateCodeLocal(
    `${firstPart || "AFF"}${lastPart || "USR"}${suffix ? `-${suffix}` : ""}`,
  );
}

function buildAffiliateSlugFromName(name: string, seed?: string | number) {
  const base = slugify(name || "affilie");
  const suffix = String(seed || "")
    .replace(/\D+/g, "")
    .slice(-4);

  return slugify(`${base}${suffix ? `-${suffix}` : ""}`);
}

function normalizeRoutePrefix(value: string) {
  const v = String(value || "").trim();
  if (!v) return "/products";
  return v.startsWith("/") ? v.replace(/\/+$/, "") : `/${v.replace(/\/+$/, "")}`;
}

function buildPublicProductPath(product: ProductOption | null) {
  if (!product?.id) return "";
  const prefix = normalizeRoutePrefix(PRODUCT_ROUTE_PREFIX);
  const target = product.slug ? encodeURIComponent(product.slug) : String(product.id);
  return `${prefix}/${target}`;
}

function statusBadgeClass(status: string) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
    case "APPROVED":
    case "PAID":
      return { background: "rgba(31,169,113,0.12)", color: DUU.green };
    case "INACTIVE":
    case "CANCELLED":
      return { background: "rgba(107,114,128,0.14)", color: "#4B5563" };
    case "PENDING":
      return { background: "rgba(255,213,74,0.20)", color: "#8A6200" };
    default:
      return { background: "rgba(17,17,17,0.08)", color: DUU.black };
  }
}

function safeAffiliateName(item?: Affiliate | null) {
  return item?.name?.trim() || `Affilié #${item?.id ?? ""}`;
}

function safeUserLabel(user?: UserOption | null) {
  const full =
    user?.full_name?.trim() ||
    user?.name?.trim() ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return full || `Utilisateur #${user?.id ?? ""}`;
}

function getCommissionAmount(row: AffiliateCommission) {
  const direct = Number(row.amount);
  if (Number.isFinite(direct)) return direct;
  const earnings = Number(row.total_earnings);
  if (Number.isFinite(earnings)) return earnings;
  return 0;
}

function getCommissionBase(row: AffiliateCommission) {
  const base = Number(row.base_amount);
  if (Number.isFinite(base)) return base;
  const sales = Number(row.total_sales);
  if (Number.isFinite(sales)) return sales;
  return 0;
}

function getPageTotal(pageInfo: PageInfo) {
  return Number(pageInfo.totalItems ?? pageInfo.total ?? 0);
}

function periodLabel(period: RevenuePeriod) {
  switch (period) {
    case "DAY":
      return "jour";
    case "WEEK":
      return "semaine";
    case "YEAR":
      return "année";
    default:
      return "mois";
  }
}

function snapshotValue(obj: any, key: string) {
  const n = Number(obj?.[key] || 0);
  return Number.isFinite(n) ? n : 0;
}

function cardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    border: `1px solid ${DUU.line}`,
    borderRadius: 24,
    background: DUU.white,
    boxShadow: "0 12px 30px rgba(17,17,17,0.06)",
    ...extra,
  };
}

function SectionTitle({
  icon,
  title,
  sub,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
      <div className="d-flex align-items-start gap-3">
        <div
          className="d-inline-flex align-items-center justify-content-center"
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: DUU.yellowSoft,
            color: DUU.black,
            border: `1px solid ${DUU.yellowBorder}`,
          }}
        >
          {icon}
        </div>
        <div>
          <div className="fw-bold" style={{ color: DUU.black, fontSize: "1.15rem" }}>
            {title}
          </div>
          {sub ? <div className="small" style={{ color: DUU.gray }}>{sub}</div> : null}
        </div>
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="h-100 p-3" style={cardStyle()}>
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="small mb-2" style={{ color: DUU.gray }}>
            {title}
          </div>
          <div
            className="fw-bold"
            style={{ color: DUU.black, fontSize: "1.55rem", lineHeight: 1.1 }}
          >
            {value}
          </div>
          {hint ? (
            <div className="small mt-2" style={{ color: DUU.gray }}>
              {hint}
            </div>
          ) : null}
        </div>

        <div
          className="d-inline-flex align-items-center justify-content-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: DUU.yellowSoft,
            border: `1px solid ${DUU.yellowBorder}`,
            color: DUU.black,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function TinyBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(8, (value / max) * 100) : 8;

  return (
    <div
      style={{
        width: "100%",
        height: 8,
        borderRadius: 999,
        background: "rgba(17,17,17,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, width)}%`,
          height: "100%",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${DUU.yellow} 0%, #F5B700 100%)`,
        }}
      />
    </div>
  );
}

function PaginationBar({
  pageInfo,
  onChange,
}: {
  pageInfo: PageInfo;
  onChange: (page: number) => void;
}) {
  const totalItems = getPageTotal(pageInfo);
  if (!totalItems) return null;

  const page = pageInfo.page || 1;
  const totalPages = pageInfo.totalPages || 1;
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
      <div className="small" style={{ color: DUU.gray }}>
        Page {page} / {totalPages} — {formatNumber(totalItems)} élément(s)
      </div>

      <div className="btn-group">
        <button
          type="button"
          className="btn btn-sm"
          style={{ borderColor: DUU.line, color: DUU.black, background: DUU.white }}
          disabled={!pageInfo.hasPrevPage}
          onClick={() => onChange(page - 1)}
        >
          Précédent
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className="btn btn-sm"
            style={{
              borderColor: p === page ? DUU.black : DUU.line,
              background: p === page ? DUU.black : DUU.white,
              color: p === page ? DUU.yellow : DUU.black,
              fontWeight: 700,
            }}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          className="btn btn-sm"
          style={{ borderColor: DUU.line, color: DUU.black, background: DUU.white }}
          disabled={!pageInfo.hasNextPage}
          onClick={() => onChange(page + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

function HistoryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const toneStyle =
    tone === "success"
      ? { background: DUU.greenSoft, color: DUU.green }
      : tone === "warning"
        ? { background: DUU.yellowSoft, color: "#8A6200" }
        : { background: DUU.blueSoft, color: DUU.black };

  return (
    <div
      className="px-3 py-2"
      style={{
        borderRadius: 14,
        ...toneStyle,
      }}
    >
      <div className="small" style={{ opacity: 0.8 }}>
        {label}
      </div>
      <div className="fw-bold">{value}</div>
    </div>
  );
}

function InlineHistoryMetrics({
  clicks,
  orders,
  sales,
  pending,
  paid,
}: {
  clicks: React.ReactNode;
  orders: React.ReactNode;
  sales: React.ReactNode;
  pending: React.ReactNode;
  paid: React.ReactNode;
}) {
  const itemStyle: React.CSSProperties = {
    minWidth: 110,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(17,17,17,0.04)",
    border: `1px solid ${DUU.line}`,
    flex: "1 1 110px",
  };

  return (
    <div className="d-flex flex-wrap align-items-stretch gap-2">
      <div style={itemStyle}>
        <div className="small" style={{ color: DUU.gray }}>Clics</div>
        <div className="fw-bold" style={{ color: DUU.black }}>{clicks}</div>
      </div>

      <div style={itemStyle}>
        <div className="small" style={{ color: DUU.gray }}>Commandes</div>
        <div className="fw-bold" style={{ color: DUU.black }}>{orders}</div>
      </div>

      <div style={itemStyle}>
        <div className="small" style={{ color: DUU.gray }}>Ventes</div>
        <div className="fw-bold" style={{ color: DUU.black }}>{sales}</div>
      </div>

      <div
        style={{
          ...itemStyle,
          background: DUU.yellowSoft,
          border: `1px solid ${DUU.yellowBorder}`,
        }}
      >
        <div className="small" style={{ color: "#8A6200" }}>En attente</div>
        <div className="fw-bold" style={{ color: "#8A6200" }}>{pending}</div>
      </div>

      <div
        style={{
          ...itemStyle,
          background: DUU.greenSoft,
          border: `1px solid rgba(31,169,113,0.18)`,
        }}
      >
        <div className="small" style={{ color: DUU.green }}>Payé</div>
        <div className="fw-bold" style={{ color: DUU.green }}>{paid}</div>
      </div>
    </div>
  );
}

async function searchUsersCandidates(query: string): Promise<UserOption[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  const attempts = [
    { url: "/api/users", query: { q, page: 1, pageSize: 10 } },
    { url: "/api/user", query: { q, page: 1, pageSize: 10 } },
    { url: "/api/user/admin/list", query: { q, page: 1, pageSize: 10 } },
    { url: "/api/admin/users", query: { q, page: 1, pageSize: 10 } },
  ];

  for (const attempt of attempts) {
    try {
      const data: any = await api.get(attempt.url, { query: attempt.query });
      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      const mapped = rawItems
        .map((u: any): UserOption | null => {
          const id = Number(u?.id);
          if (!Number.isFinite(id) || id <= 0) return null;

          return {
            id,
            first_name: u.first_name ?? null,
            last_name: u.last_name ?? null,
            name: u.name ?? null,
            full_name:
              u.full_name ??
              [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ??
              null,
            phone: u.phone ?? null,
            email: u.email ?? null,
            role: u.role ?? null,
          };
        })
        .filter(Boolean) as UserOption[];

      if (mapped.length) return mapped;
    } catch {
      // ignore and try next endpoint
    }
  }

  return [];
}

export default function AffiliatesPage() {
  const [items, setItems] = useState<Affiliate[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Affiliate | null>(null);
  const [form, setForm] = useState<AffiliateFormData>(defaultForm);

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [detailTab, setDetailTab] = useState<
    "overview" | "commissions" | "clicks" | "history"
  >("overview");

  const [commissionItems, setCommissionItems] = useState<AffiliateCommission[]>([]);
  const [commissionPageInfo, setCommissionPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("");

  const [clickItems, setClickItems] = useState<AffiliateClick[]>([]);
  const [clickPageInfo, setClickPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [clickPage, setClickPage] = useState(1);

  const [historyItems, setHistoryItems] = useState<AffiliateRevenueHistoryRow[]>([]);
  const [historyPageInfo, setHistoryPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPeriod, setHistoryPeriod] = useState<RevenuePeriod>("MONTH");

  const [globalPeriod, setGlobalPeriod] = useState<RevenuePeriod>("MONTH");
  const [globalSummary, setGlobalSummary] =
    useState<AffiliateRevenueSummaryResponse | null>(null);

  const [globalHistoryItems, setGlobalHistoryItems] = useState<AffiliateRevenueHistoryRow[]>([]);
  const [globalHistoryPageInfo, setGlobalHistoryPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [globalHistoryPage, setGlobalHistoryPage] = useState(1);
  const [globalHistoryPeriod, setGlobalHistoryPeriod] = useState<RevenuePeriod>("MONTH");

  const [affiliateDashboard, setAffiliateDashboard] =
    useState<AffiliateDashboardResponse | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.affiliates += 1;
        acc.active += item.status === "ACTIVE" ? 1 : 0;
        acc.clicks += Number(item.total_clicks || 0);
        acc.orders += Number(item.total_orders || 0);
        acc.earnings += Number(item.total_earnings || 0);
        return acc;
      },
      { affiliates: 0, active: 0, clicks: 0, orders: 0, earnings: 0 },
    );
  }, [items]);

  const globalMetrics = useMemo(() => {
    const g = globalSummary?.global || {};
    return {
      clicks_count: snapshotValue(g, "clicks_count"),
      orders_count: snapshotValue(g, "orders_count"),
      sales_amount: snapshotValue(g, "sales_amount"),
      commission_pending: snapshotValue(g, "commission_pending"),
      commission_approved: snapshotValue(g, "commission_approved"),
      commission_paid: snapshotValue(g, "commission_paid"),
      commission_cancelled: snapshotValue(g, "commission_cancelled"),
      commission_total: snapshotValue(g, "commission_total"),
    };
  }, [globalSummary]);

  const maxClicks = useMemo(
    () => Math.max(1, ...items.map((x) => Number(x.total_clicks || 0))),
    [items],
  );

  const topAffiliates = useMemo(() => {
    return [...items]
      .sort((a, b) => Number(b.total_earnings || 0) - Number(a.total_earnings || 0))
      .slice(0, 5);
  }, [items]);

  const filteredProducts = useMemo(() => {
    const keyword = String(productSearch || "").trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((p) => {
      const hay = [p.name, p.slug, p.shop_name, String(p.id)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(keyword);
    });
  }, [products, productSearch]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === Number(selectedProductId)) || null;
  }, [products, selectedProductId]);

  const selectedProductPath = useMemo(() => buildPublicProductPath(selectedProduct), [selectedProduct]);

  const todayGain = snapshotValue(affiliateDashboard?.today, "commission_total");
  const weekGain = snapshotValue(affiliateDashboard?.week, "commission_total");
  const monthGain = snapshotValue(affiliateDashboard?.month, "commission_total");
  const yearGain = snapshotValue(affiliateDashboard?.year, "commission_total");

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetUserSelection() {
    setSelectedUser(null);
    setUserSearch("");
    setUserResults([]);
    setShowUserDropdown(false);
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingItem(null);
    setShowForm(false);
    resetUserSelection();
  }

  function patchForm<K extends keyof AffiliateFormData>(
    key: K,
    value: AffiliateFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autoFillFromName(nameOverride?: string) {
    const sourceName = String(nameOverride || form.name || "").trim();
    if (!sourceName) return;

    setForm((prev) => ({
      ...prev,
      referral_slug: prev.referral_slug?.trim()
        ? prev.referral_slug
        : buildAffiliateSlugFromName(sourceName),
      affiliate_code: prev.affiliate_code?.trim()
        ? normalizeAffiliateCodeLocal(prev.affiliate_code)
        : buildAffiliateCodeFromName(sourceName),
    }));
  }

  function applyUserToForm(user: UserOption) {
    const label = safeUserLabel(user);

    setSelectedUser(user);
    setUserSearch(label);
    setUserResults([]);
    setShowUserDropdown(false);

    setForm((prev) => ({
      ...prev,
      user_id: String(user.id),
      name: label,
      phone: user.phone || "",
      referral_slug: prev.referral_slug?.trim()
        ? prev.referral_slug
        : buildAffiliateSlugFromName(label, user.id),
      affiliate_code: prev.affiliate_code?.trim()
        ? normalizeAffiliateCodeLocal(prev.affiliate_code)
        : buildAffiliateCodeFromName(label, user.id),
    }));
  }

  function openCreate() {
    clearMessages();
    setEditingItem(null);
    setForm(defaultForm);
    resetUserSelection();
    setShowForm(true);
  }

  function openEdit(item: Affiliate) {
    clearMessages();
    setEditingItem(item);
    setForm({
      user_id: item.user_id ? String(item.user_id) : "",
      affiliate_code: item.affiliate_code || "",
      referral_slug: item.referral_slug || "",
      name: item.name || "",
      phone: item.phone || "",
      commission_rate: String(item.commission_rate ?? 10),
      status: item.status || "ACTIVE",
      notes: item.notes || "",
    });

    if (item.user) {
      const preparedUser = {
        id: item.user.id,
        first_name: item.user.first_name || null,
        last_name: item.user.last_name || null,
        phone: item.user.phone || null,
        role: item.user.role || null,
        full_name: [item.user.first_name, item.user.last_name]
          .filter(Boolean)
          .join(" ")
          .trim(),
      };

      setSelectedUser(preparedUser);
      setUserSearch(
        [item.user.first_name, item.user.last_name].filter(Boolean).join(" ").trim() ||
          item.name ||
          "",
      );
    } else {
      resetUserSelection();
    }

    setShowForm(true);
  }

  async function loadProducts() {
    setProductsLoading(true);
    try {
      let data: any = null;

      try {
        data = await api.get("/api/products/manage", {
          query: { page: 1, pageSize: 250, onlyActive: 1 },
        });
      } catch {
        data = await api.get("/api/products", {
          query: { page: 1, pageSize: 250, onlyActive: 1 },
        });
      }

      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      const mapped: ProductOption[] = rawItems.map((item: any) => ({
        id: Number(item.id),
        name: item.name || item.title || `Produit #${item.id}`,
        slug: item.slug || null,
        price: item.price ?? null,
        promo_price: item.promo_price ?? item.min_promo_price ?? null,
        stock: item.stock ?? null,
        is_active: item.is_active ?? item.active ?? null,
        shop_name: item.shop_name || item.shop?.name || null,
        cover:
          item.cover ||
          item.first_image ||
          item.first_product_cover ||
          item.image ||
          item.thumbnail ||
          null,
      }));

      setProducts(mapped.filter((p) => Number.isFinite(p.id) && p.id > 0));
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les produits.");
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadAffiliates(nextPage = page) {
    setLoading(true);
    setError("");

    try {
      const data: any = await listAffiliates({
        q,
        status: (statusFilter as any) || "",
        page: nextPage,
        pageSize,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
      setPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les affiliés.");
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalSummary(period: RevenuePeriod = globalPeriod) {
    try {
      const data = await getAffiliatesRevenueSummary(period);
      setGlobalSummary(data || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le résumé global.");
    }
  }

  async function loadGlobalHistory(
    period: RevenuePeriod = globalHistoryPeriod,
    nextPage = globalHistoryPage,
  ) {
    try {
      const data = await getAffiliatesRevenueHistory({
        period,
        page: nextPage,
        pageSize: 12,
      });

      setGlobalHistoryItems(Array.isArray(data?.items) ? data.items : []);
      setGlobalHistoryPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger l'historique global.");
    }
  }

  async function loadAffiliateDetails(id: number) {
    setDetailLoading(true);
    setError("");

    try {
      const data: any = await getAffiliate(id);
      setSelectedAffiliate(data || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le détail de l'affilié.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadAffiliateDashboardData(id: number) {
    try {
      const data = await getAffiliateDashboard(id);
      setAffiliateDashboard(data || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le dashboard affilié.");
    }
  }

  async function loadCommissions(id: number, nextPage = commissionPage) {
    try {
      const data: any = await listAffiliateCommissions(id, {
        page: nextPage,
        pageSize: 10,
        status: (commissionStatusFilter as any) || "",
      });
      setCommissionItems(Array.isArray(data?.items) ? data.items : []);
      setCommissionPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les commissions.");
    }
  }

  async function loadClicks(id: number, nextPage = clickPage) {
    try {
      const data: any = await listAffiliateClicks(id, {
        page: nextPage,
        pageSize: 10,
      });
      setClickItems(Array.isArray(data?.items) ? data.items : []);
      setClickPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les clics.");
    }
  }

  async function loadAffiliateHistoryData(
    id: number,
    period: RevenuePeriod = historyPeriod,
    nextPage = historyPage,
  ) {
    try {
      const data = await getAffiliateRevenueHistory(id, {
        period,
        page: nextPage,
        pageSize: 12,
      });
      setHistoryItems(Array.isArray(data?.items) ? data.items : []);
      setHistoryPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger l'historique affilié.");
    }
  }

  useEffect(() => {
    loadAffiliates(1);
  }, [q, statusFilter, pageSize]);

  useEffect(() => {
    loadAffiliates(page);
  }, [page]);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadGlobalSummary(globalPeriod);
  }, [globalPeriod]);

  useEffect(() => {
    loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);
  }, [globalHistoryPeriod, globalHistoryPage]);

  useEffect(() => {
    if (!showForm) return;

    const keyword = userSearch.trim();
    if (keyword.length < 2) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setUsersLoading(true);
      try {
        const users = await searchUsersCandidates(keyword);
        setUserResults(users);
        setShowUserDropdown(users.length > 0);
      } catch {
        setUserResults([]);
        setShowUserDropdown(false);
      } finally {
        setUsersLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [userSearch, showForm]);

  useEffect(() => {
    if (!selectedId) return;

    loadAffiliateDetails(selectedId);
    loadAffiliateDashboardData(selectedId);

    if (detailTab === "commissions") {
      loadCommissions(selectedId, commissionPage);
    }

    if (detailTab === "clicks") {
      loadClicks(selectedId, clickPage);
    }

    if (detailTab === "history") {
      loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "commissions") {
      loadCommissions(selectedId, commissionPage);
    }
  }, [detailTab, commissionPage, commissionStatusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "clicks") {
      loadClicks(selectedId, clickPage);
    }
  }, [detailTab, clickPage]);

  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "history") {
      loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
    }
  }, [detailTab, historyPeriod, historyPage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!userDropdownRef.current) return;
      if (!userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        user_id: form.user_id.trim() ? Number(form.user_id) : null,
        affiliate_code: normalizeAffiliateCodeLocal(
          form.affiliate_code || buildAffiliateCodeFromName(form.name),
        ),
        referral_slug: form.referral_slug.trim()
          ? slugify(form.referral_slug)
          : buildAffiliateSlugFromName(form.name),
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        commission_rate: Number(form.commission_rate || 10),
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (!payload.name) {
        throw new Error("Le nom est obligatoire.");
      }

      if (editingItem) {
        await updateAffiliate(editingItem.id, payload as any);
        setSuccess("Affilié mis à jour avec succès.");
      } else {
        await createAffiliate(payload as any);
        setSuccess("Affilié créé avec succès.");
      }

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);
      resetForm();
    } catch (e: any) {
      setError(e?.message || "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAffiliateStatus(item: Affiliate) {
    clearMessages();

    try {
      const nextStatus: AffiliateStatus =
        item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

      await updateAffiliateStatus(item.id, { status: nextStatus } as any);

      setSuccess(
        nextStatus === "ACTIVE"
          ? "Affilié réactivé avec succès."
          : "Affilié désactivé avec succès.",
      );

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);

      if (selectedId === item.id) {
        await loadAffiliateDetails(item.id);
        await loadAffiliateDashboardData(item.id);
      }
    } catch (e: any) {
      setError(e?.message || "Impossible de changer le statut.");
    }
  }

  async function handleChangeCommissionStatus(
    row: AffiliateCommission,
    status: CommissionStatus,
  ) {
    clearMessages();

    try {
      await updateAffiliateCommissionStatus(row.id, { status } as any);
      setSuccess("Statut de commission mis à jour.");

      if (selectedId) {
        await loadCommissions(selectedId, commissionPage);
        await loadAffiliateDetails(selectedId);
        await loadAffiliateDashboardData(selectedId);
        await loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
      }

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);
    } catch (e: any) {
      setError(e?.message || "Impossible de mettre à jour la commission.");
    }
  }

  async function handleRebuildReports() {
    clearMessages();

    try {
      await rebuildAffiliateReports(selectedId ? { affiliate_id: selectedId } : {});
      setSuccess("Rapports affiliés recalculés avec succès.");

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);

      if (selectedId) {
        await loadAffiliateDetails(selectedId);
        await loadAffiliateDashboardData(selectedId);
        await loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
        await loadCommissions(selectedId, commissionPage);
      }
    } catch (e: any) {
      setError(e?.message || "Impossible de recalculer les rapports.");
    }
  }

  async function handleCopy(text: string | null | undefined, label: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${label} copié.`);
      window.setTimeout(() => setSuccess(""), 1600);
    } catch {
      setError(`Impossible de copier ${label.toLowerCase()}.`);
    }
  }

  const selectedPublicByCode = selectedAffiliate?.affiliate_code
    ? getAffiliatePublicUrlByCode(selectedAffiliate.affiliate_code)
    : "";

  const selectedPublicBySlug = selectedAffiliate?.referral_slug
    ? getAffiliatePublicUrlBySlug(selectedAffiliate.referral_slug)
    : "";

  const selectedTrackingUrl = selectedAffiliate?.affiliate_code
    ? getAffiliateTrackingUrlByCode(selectedAffiliate.affiliate_code, "/")
    : "";

  const selectedProductPublicUrl =
    selectedAffiliate?.affiliate_code && selectedProduct
      ? getAffiliateProductPublicUrlByCode(
          selectedAffiliate.affiliate_code,
          selectedProduct.id,
          selectedProductPath,
        )
      : "";

  const selectedProductTrackingUrl =
    selectedAffiliate?.affiliate_code && selectedProduct
      ? getAffiliateProductTrackingUrlByCode(
          selectedAffiliate.affiliate_code,
          selectedProduct.id,
          "dashboard",
          selectedProductPath,
        )
      : "";

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: `linear-gradient(180deg, ${DUU.bg} 0%, #fff 220px)`,
        minHeight: "100%",
      }}
    >
      <div
        className="mb-4 p-4 p-lg-5"
        style={cardStyle({
          background:
            "radial-gradient(circle at top right, rgba(255,213,74,0.28), transparent 35%), linear-gradient(135deg, #111111 0%, #1B1B1B 100%)",
          border: "1px solid rgba(255,213,74,0.16)",
        })}
      >
        <div className="row g-4 align-items-center">
          <div className="col-12 col-xl-8">
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-2 mb-3"
              style={{
                borderRadius: 999,
                background: "rgba(255,213,74,0.14)",
                color: DUU.yellow,
                border: "1px solid rgba(255,213,74,0.24)",
                fontWeight: 700,
                fontSize: ".9rem",
              }}
            >
              <BadgePercent size={16} />
              Réseau d’affiliation Duumini
            </div>

            <h2 className="fw-bold mb-2" style={{ color: DUU.white, fontSize: "2rem" }}>
              Dashboard affiliés pro
            </h2>

            <p
              className="mb-0"
              style={{ color: "rgba(255,255,255,0.72)", maxWidth: 760 }}
            >
              Pilote la création, la performance, les liens de partage, les clics
              trackés, les commissions et l’historique des revenus de tes affiliés
              depuis une seule page.
            </p>
          </div>

          <div className="col-12 col-xl-4">
            <div
              className="p-3 p-lg-4"
              style={{
                borderRadius: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div className="small mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                Aperçu global {periodLabel(globalPeriod)}
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Commandes affiliées</span>
                <strong style={{ color: DUU.yellow }}>
                  {formatNumber(globalMetrics.orders_count)}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Ventes affiliées</span>
                <strong style={{ color: DUU.yellow }}>
                  {formatMoney(globalMetrics.sales_amount)}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Gains affiliés</span>
                <strong style={{ color: DUU.yellow }}>
                  {formatMoney(globalMetrics.commission_total)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {success ? <div className="alert alert-success py-2">{success}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Affiliés visibles"
            value={formatNumber(totals.affiliates)}
            hint="Selon les filtres actuels"
            icon={<UserRound size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Affiliés actifs"
            value={formatNumber(totals.active)}
            hint="Actifs sur la page courante"
            icon={<TrendingUp size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title={`Revenu global ${periodLabel(globalPeriod)}`}
            value={formatMoney(globalMetrics.commission_total)}
            hint={`${formatNumber(globalMetrics.orders_count)} commande(s)`}
            icon={<Wallet size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Ventes affiliées"
            value={formatMoney(globalMetrics.sales_amount)}
            hint={`${formatNumber(globalMetrics.clicks_count)} clic(s)`}
            icon={<BarChart3 size={20} />}
          />
        </div>
      </div>

      <div className="mb-4 p-3 p-lg-4" style={cardStyle()}>
        <SectionTitle
          icon={<History size={20} />}
          title="Historique global des revenus affiliés"
          sub="Consulte les jours, semaines, mois ou années précédents"
        />

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4 col-lg-3">
            <label className="form-label fw-semibold">Période historique</label>
            <select
              className="form-select"
              style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
              value={globalHistoryPeriod}
              onChange={(e) => {
                setGlobalHistoryPage(1);
                setGlobalHistoryPeriod(e.target.value as RevenuePeriod);
              }}
            >
              <option value="DAY">Jour</option>
              <option value="WEEK">Semaine</option>
              <option value="MONTH">Mois</option>
              <option value="YEAR">Année</option>
            </select>
          </div>
        </div>

        <div className="row g-3">
          {globalHistoryItems.length === 0 ? (
            <div className="col-12">
              <div className="small" style={{ color: DUU.gray }}>
                Aucun historique global disponible.
              </div>
            </div>
          ) : (
            globalHistoryItems.map((row, idx) => (
              <div className="col-12" key={`${row.period_key}-${idx}`}>
                <div
                  className="p-3 h-100"
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${DUU.line}`,
                    background: DUU.white,
                  }}
                >
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <div className="fw-bold" style={{ color: DUU.black, fontSize: "1rem" }}>
                        {row.period_key || "-"}
                      </div>
                      <div className="small" style={{ color: DUU.gray }}>
                        {formatDateOnly(row.period_start)} → {formatDateOnly(row.period_end)}
                      </div>
                    </div>

                    <div className="fw-bold" style={{ color: DUU.black, fontSize: "1.05rem" }}>
                      {formatMoney(row.commission_total || 0)}
                    </div>
                  </div>

                  <InlineHistoryMetrics
                    clicks={formatNumber(row.clicks_count || 0)}
                    orders={formatNumber(row.orders_count || 0)}
                    sales={formatMoney(row.sales_amount || 0)}
                    pending={formatMoney(row.commission_pending || 0)}
                    paid={formatMoney(row.commission_paid || 0)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3">
          <PaginationBar
            pageInfo={globalHistoryPageInfo}
            onChange={(nextPage) => setGlobalHistoryPage(nextPage)}
          />
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-8">
          <div className="p-3 p-lg-4" style={cardStyle()}>
            <SectionTitle
              icon={<Settings2 size={20} />}
              title="Filtres et actions"
              sub="Recherche, statut, période, pagination et création rapide"
              right={
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: DUU.white,
                      color: DUU.black,
                      border: `1px solid ${DUU.line}`,
                      borderRadius: 14,
                      fontWeight: 700,
                    }}
                    onClick={() => loadAffiliates(page)}
                    disabled={loading}
                  >
                    <RefreshCw size={16} className="me-2" />
                    {loading ? "Chargement..." : "Actualiser"}
                  </button>

                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: DUU.white,
                      color: DUU.black,
                      border: `1px solid ${DUU.line}`,
                      borderRadius: 14,
                      fontWeight: 700,
                    }}
                    onClick={handleRebuildReports}
                  >
                    <History size={16} className="me-2" />
                    Recalculer rapports
                  </button>

                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: DUU.yellow,
                      color: DUU.black,
                      border: `1px solid ${DUU.yellow}`,
                      borderRadius: 14,
                      fontWeight: 800,
                    }}
                    onClick={openCreate}
                  >
                    <Plus size={16} className="me-2" />
                    Nouvel affilié
                  </button>
                </div>
              }
            />

            <form
              className="row g-3 align-items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(qInput.trim());
              }}
            >
              <div className="col-12 col-lg-4">
                <label className="form-label fw-semibold">Recherche</label>
                <div className="position-relative">
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: DUU.gray,
                    }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    style={{
                      paddingLeft: 40,
                      borderRadius: 16,
                      borderColor: DUU.line,
                      minHeight: 48,
                    }}
                    placeholder="Code, slug, nom, téléphone, user_id..."
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-12 col-md-4 col-lg-2">
                <label className="form-label fw-semibold">Statut</label>
                <select
                  className="form-select"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1);
                    setStatusFilter(e.target.value);
                  }}
                >
                  <option value="">Tous</option>
                  <option value="ACTIVE">Actifs</option>
                  <option value="INACTIVE">Inactifs</option>
                </select>
              </div>

              <div className="col-12 col-md-4 col-lg-2">
                <label className="form-label fw-semibold">Période revenus</label>
                <select
                  className="form-select"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={globalPeriod}
                  onChange={(e) => setGlobalPeriod(e.target.value as RevenuePeriod)}
                >
                  <option value="DAY">Jour</option>
                  <option value="WEEK">Semaine</option>
                  <option value="MONTH">Mois</option>
                  <option value="YEAR">Année</option>
                </select>
              </div>

              <div className="col-12 col-md-4 col-lg-2">
                <label className="form-label fw-semibold">Taille page</label>
                <select
                  className="form-select"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value) || 10);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="col-6 col-lg-1">
                <button
                  type="submit"
                  className="btn w-100"
                  style={{
                    minHeight: 48,
                    background: DUU.black,
                    color: DUU.yellow,
                    borderRadius: 16,
                    fontWeight: 800,
                  }}
                >
                  Go
                </button>
              </div>

              <div className="col-6 col-lg-1">
                <button
                  type="button"
                  className="btn w-100"
                  style={{
                    minHeight: 48,
                    background: DUU.white,
                    color: DUU.black,
                    border: `1px solid ${DUU.line}`,
                    borderRadius: 16,
                    fontWeight: 700,
                  }}
                  onClick={() => {
                    setQInput("");
                    setQ("");
                    setStatusFilter("");
                    setPage(1);
                    setPageSize(10);
                    setGlobalPeriod("MONTH");
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="p-3 p-lg-4 h-100" style={cardStyle()}>
            <SectionTitle
              icon={<BarChart3 size={20} />}
              title="Top affiliés"
              sub="Classement rapide par gains"
            />

            {topAffiliates.length === 0 ? (
              <div className="small" style={{ color: DUU.gray }}>
                Aucun affilié à afficher.
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {topAffiliates.map((item, idx) => (
                  <div key={item.id}>
                    <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="d-inline-flex align-items-center justify-content-center"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            background: idx === 0 ? DUU.yellow : "rgba(17,17,17,0.06)",
                            color: DUU.black,
                            fontWeight: 800,
                            fontSize: ".85rem",
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="fw-semibold" style={{ color: DUU.black }}>
                            {safeAffiliateName(item)}
                          </div>
                          <div className="small" style={{ color: DUU.gray }}>
                            {formatNumber(item.total_orders)} commande(s)
                          </div>
                        </div>
                      </div>

                      <div className="text-end">
                        <div className="fw-bold" style={{ color: DUU.black }}>
                          {formatMoney(item.total_earnings)}
                        </div>
                        <div className="small" style={{ color: DUU.gray }}>
                          {formatNumber(item.total_clicks)} clic(s)
                        </div>
                      </div>
                    </div>

                    <TinyBar
                      value={Number(item.total_earnings || 0)}
                      max={Math.max(
                        1,
                        ...topAffiliates.map((x) => Number(x.total_earnings || 0)),
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="p-3 p-lg-4 mb-4" style={cardStyle()}>
          <SectionTitle
            icon={<Plus size={20} />}
            title={editingItem ? "Modifier un affilié" : "Créer un affilié"}
            sub="Recherche d’utilisateur, auto-remplissage et configuration de l’affilié"
            right={
              <button
                type="button"
                className="btn"
                style={{
                  background: DUU.white,
                  color: DUU.black,
                  border: `1px solid ${DUU.line}`,
                  borderRadius: 14,
                  fontWeight: 700,
                }}
                onClick={resetForm}
              >
                Fermer
              </button>
            }
          />

          <form onSubmit={handleSubmit}>
            <div className="row g-4">
              <div className="col-12">
                <div
                  className="p-3 p-lg-4"
                  style={{
                    borderRadius: 20,
                    background: DUU.yellowSoft,
                    border: `1px solid ${DUU.yellowBorder}`,
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Users size={18} />
                    <div className="fw-bold" style={{ color: DUU.black }}>
                      Lier un utilisateur existant
                    </div>
                  </div>

                  <div className="small mb-3" style={{ color: "#6B5B22" }}>
                    Recherche par nom, prénom, téléphone ou user_id. La sélection remplit
                    automatiquement les champs et crée le code affilié depuis le nom du user.
                  </div>

                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-lg-7">
                      <label className="form-label fw-semibold">Recherche utilisateur</label>

                      <div className="position-relative" ref={userDropdownRef}>
                        <Search
                          size={16}
                          style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: DUU.gray,
                            zIndex: 2,
                          }}
                        />

                        <input
                          type="text"
                          className="form-control"
                          style={{
                            paddingLeft: 40,
                            borderRadius: 16,
                            borderColor: DUU.yellowBorder,
                            minHeight: 48,
                            background: DUU.white,
                          }}
                          value={userSearch}
                          onChange={(e) => {
                            setUserSearch(e.target.value);
                            setShowUserDropdown(true);
                          }}
                          onFocus={() => {
                            if (userResults.length > 0) setShowUserDropdown(true);
                          }}
                          placeholder="Ex: Oumar, +2126..., 15..."
                        />

                        {showUserDropdown && (usersLoading || userResults.length > 0) ? (
                          <div
                            className="position-absolute start-0 end-0 mt-2"
                            style={{
                              zIndex: 20,
                              maxHeight: 260,
                              overflowY: "auto",
                              borderRadius: 16,
                              background: DUU.white,
                              border: `1px solid ${DUU.yellowBorder}`,
                              boxShadow: "0 14px 30px rgba(17,17,17,0.10)",
                            }}
                          >
                            {usersLoading ? (
                              <div className="px-3 py-3 small" style={{ color: DUU.gray }}>
                                Recherche en cours...
                              </div>
                            ) : (
                              userResults.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  className="btn w-100 text-start border-0 rounded-0"
                                  style={{
                                    background: "transparent",
                                    color: DUU.black,
                                    padding: "12px 14px",
                                  }}
                                  onClick={() => applyUserToForm(user)}
                                >
                                  <div className="fw-semibold">{safeUserLabel(user)}</div>
                                  <div className="small" style={{ color: DUU.gray }}>
                                    ID: {user.id}
                                    {user.phone ? ` • ${user.phone}` : ""}
                                    {user.email ? ` • ${user.email}` : ""}
                                    {user.role ? ` • ${user.role}` : ""}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-12 col-lg-5">
                      {selectedUser ? (
                        <div
                          className="d-flex align-items-center justify-content-between gap-3 p-3"
                          style={{
                            borderRadius: 16,
                            background: DUU.white,
                            border: `1px solid ${DUU.yellowBorder}`,
                          }}
                        >
                          <div>
                            <div className="fw-semibold" style={{ color: DUU.black }}>
                              {safeUserLabel(selectedUser)}
                            </div>
                            <div className="small" style={{ color: DUU.gray }}>
                              ID: {selectedUser.id}
                              {selectedUser.phone ? ` • ${selectedUser.phone}` : ""}
                              {selectedUser.role ? ` • ${selectedUser.role}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              borderRadius: 12,
                              background: DUU.white,
                              border: `1px solid ${DUU.line}`,
                              color: DUU.black,
                            }}
                            onClick={() => {
                              resetUserSelection();
                              patchForm("user_id", "");
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="small px-3 py-3"
                          style={{
                            borderRadius: 16,
                            background: DUU.white,
                            border: `1px dashed ${DUU.yellowBorder}`,
                            color: DUU.gray,
                          }}
                        >
                          Aucun utilisateur sélectionné
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-4">
                <label className="form-label fw-semibold">Nom</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.name}
                  onChange={(e) => patchForm("name", e.target.value)}
                  onBlur={(e) => autoFillFromName(e.target.value)}
                  required
                />
              </div>

              <div className="col-12 col-md-6 col-lg-2">
                <label className="form-label fw-semibold">User ID</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.user_id}
                  onChange={(e) => patchForm("user_id", e.target.value)}
                  placeholder="Optionnel"
                />
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-semibold">Code affilié</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.affiliate_code}
                  onChange={(e) =>
                    patchForm("affiliate_code", normalizeAffiliateCodeLocal(e.target.value))
                  }
                  required
                />
              </div>

              <div className="col-12 col-lg-3">
                <label className="form-label fw-semibold">Slug</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.referral_slug}
                  onChange={(e) => patchForm("referral_slug", slugify(e.target.value))}
                  placeholder="Optionnel"
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Téléphone</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.phone}
                  onChange={(e) => patchForm("phone", e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Commission %</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.commission_rate}
                  onChange={(e) => patchForm("commission_rate", e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Statut</label>
                <select
                  className="form-select"
                  style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
                  value={form.status}
                  onChange={(e) => patchForm("status", e.target.value as AffiliateStatus)}
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="INACTIVE">Inactif</option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold">Notes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  style={{ borderRadius: 16, borderColor: DUU.line }}
                  value={form.notes}
                  onChange={(e) => patchForm("notes", e.target.value)}
                />
              </div>

              <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: DUU.yellow,
                    color: DUU.black,
                    borderRadius: 16,
                    fontWeight: 800,
                    minHeight: 46,
                    paddingInline: 18,
                  }}
                  disabled={submitting}
                >
                  {submitting
                    ? "Enregistrement..."
                    : editingItem
                      ? "Mettre à jour"
                      : "Créer l'affilié"}
                </button>

                <button
                  type="button"
                  className="btn"
                  style={{
                    background: DUU.white,
                    color: DUU.black,
                    border: `1px solid ${DUU.line}`,
                    borderRadius: 16,
                    fontWeight: 700,
                    minHeight: 46,
                    paddingInline: 18,
                  }}
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Annuler
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-xxl-8">
          <div style={cardStyle()}>
            <div className="p-3 p-lg-4 border-bottom" style={{ borderColor: DUU.line }}>
              <SectionTitle
                icon={<UserRound size={20} />}
                title="Liste des affiliés"
                sub={`${formatNumber(getPageTotal(pageInfo))} résultat(s)`}
              />
            </div>

            <div className="p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{ background: DUU.yellowSoft }}>
                      <th className="border-0 px-3 py-3">Affilié</th>
                      <th className="border-0 px-3 py-3">Code / slug</th>
                      <th className="border-0 px-3 py-3">Trafic</th>
                      <th className="border-0 px-3 py-3">Gains</th>
                      <th className="border-0 px-3 py-3">Statut</th>
                      <th className="border-0 px-3 py-3 text-end">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {!loading && items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5" style={{ color: DUU.gray }}>
                          Aucun affilié trouvé.
                        </td>
                      </tr>
                    ) : null}

                    {items.map((item) => {
                      const badge = statusBadgeClass(item.status);

                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-3" style={{ minWidth: 220 }}>
                            <div className="fw-semibold" style={{ color: DUU.black }}>
                              {safeAffiliateName(item)}
                            </div>
                            <div className="small" style={{ color: DUU.gray }}>
                              {item.phone || item.user?.phone || "-"}
                            </div>
                            <div className="small" style={{ color: DUU.gray }}>
                              user_id: {item.user_id ?? "-"}
                            </div>
                          </td>

                          <td className="px-3 py-3" style={{ minWidth: 190 }}>
                            <div
                              className="d-inline-flex px-2 py-1"
                              style={{
                                borderRadius: 10,
                                background: "rgba(17,17,17,0.06)",
                                color: DUU.black,
                                fontWeight: 700,
                              }}
                            >
                              {item.affiliate_code || "-"}
                            </div>
                            <div className="small mt-1" style={{ color: DUU.gray }}>
                              {item.referral_slug ? `/ref/${item.referral_slug}` : "-"}
                            </div>
                          </td>

                          <td className="px-3 py-3" style={{ minWidth: 180 }}>
                            <div className="small mb-1" style={{ color: DUU.black }}>
                              {formatNumber(item.total_clicks)} clic(s)
                            </div>
                            <TinyBar value={Number(item.total_clicks || 0)} max={maxClicks} />
                            <div className="small mt-1" style={{ color: DUU.gray }}>
                              {formatNumber(item.total_orders)} commande(s)
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="fw-bold" style={{ color: DUU.black }}>
                              {formatMoney(item.total_earnings)}
                            </div>
                            <div className="small" style={{ color: DUU.gray }}>
                              taux {Number(item.commission_rate || 0)}%
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className="px-3 py-2 d-inline-flex"
                              style={{
                                borderRadius: 999,
                                fontSize: ".82rem",
                                fontWeight: 800,
                                ...badge,
                              }}
                            >
                              {item.status === "ACTIVE" ? "Actif" : "Inactif"}
                            </span>
                          </td>

                          <td className="px-3 py-3 text-end" style={{ minWidth: 250 }}>
                            <div className="d-flex justify-content-end flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  background: DUU.black,
                                  color: DUU.yellow,
                                  borderRadius: 12,
                                  fontWeight: 700,
                                }}
                                onClick={() => {
                                  setSelectedId(item.id);
                                  setDetailTab("overview");
                                  setSelectedProductId("");
                                  setProductSearch("");
                                  setHistoryPage(1);
                                  setHistoryPeriod("MONTH");
                                }}
                              >
                                <Eye size={15} className="me-1" />
                                Voir
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  background: DUU.white,
                                  color: DUU.black,
                                  border: `1px solid ${DUU.line}`,
                                  borderRadius: 12,
                                  fontWeight: 700,
                                }}
                                onClick={() => openEdit(item)}
                              >
                                Modifier
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  background:
                                    item.status === "ACTIVE"
                                      ? "rgba(107,114,128,0.10)"
                                      : "rgba(31,169,113,0.12)",
                                  color: item.status === "ACTIVE" ? "#4B5563" : DUU.green,
                                  border: `1px solid ${DUU.line}`,
                                  borderRadius: 12,
                                  fontWeight: 700,
                                }}
                                onClick={() => handleToggleAffiliateStatus(item)}
                              >
                                {item.status === "ACTIVE" ? "Désactiver" : "Activer"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5" style={{ color: DUU.gray }}>
                          Chargement...
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <PaginationBar pageInfo={pageInfo} onChange={(nextPage) => setPage(nextPage)} />
          </div>
        </div>

        <div className="col-12 col-xxl-4">
          <div style={cardStyle({ minHeight: "100%" })}>
            <div className="p-3 p-lg-4 border-bottom" style={{ borderColor: DUU.line }}>
              <SectionTitle
                icon={<BadgePercent size={20} />}
                title="Panneau affilié"
                sub="Détail, liens, commissions, clics et historique"
                right={
                  selectedAffiliate ? (
                    <span
                      className="px-3 py-2 d-inline-flex"
                      style={{
                        borderRadius: 999,
                        fontSize: ".82rem",
                        fontWeight: 800,
                        ...statusBadgeClass(selectedAffiliate.status),
                      }}
                    >
                      {selectedAffiliate.status}
                    </span>
                  ) : null
                }
              />
            </div>

            <div className="p-3 p-lg-4">
              {!selectedId ? (
                <div style={{ color: DUU.gray }}>
                  Sélectionne un affilié dans la liste pour voir ses performances détaillées.
                </div>
              ) : detailLoading ? (
                <div style={{ color: DUU.gray }}>Chargement...</div>
              ) : !selectedAffiliate ? (
                <div className="text-danger">Impossible de charger le détail.</div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="fw-bold fs-5" style={{ color: DUU.black }}>
                      {safeAffiliateName(selectedAffiliate)}
                    </div>
                    <div className="small" style={{ color: DUU.gray }}>
                      Code: {selectedAffiliate.affiliate_code || "-"}
                    </div>
                    <div className="small" style={{ color: DUU.gray }}>
                      Slug: {selectedAffiliate.referral_slug || "-"}
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <KpiCard
                        title="Clics"
                        value={formatNumber(selectedAffiliate.total_clicks)}
                        icon={<MousePointerClick size={18} />}
                      />
                    </div>
                    <div className="col-6">
                      <KpiCard
                        title="Commandes"
                        value={formatNumber(selectedAffiliate.total_orders)}
                        icon={<BarChart3 size={18} />}
                      />
                    </div>
                    <div className="col-12">
                      <KpiCard
                        title="Total gains"
                        value={formatMoney(selectedAffiliate.total_earnings)}
                        hint={`Taux ${selectedAffiliate.commission_rate}%`}
                        icon={<Percent size={18} />}
                      />
                    </div>
                  </div>

                  {affiliateDashboard ? (
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <KpiCard
                          title="Gain du jour"
                          value={formatMoney(todayGain)}
                          icon={<Wallet size={18} />}
                        />
                      </div>
                      <div className="col-6">
                        <KpiCard
                          title="Gain semaine"
                          value={formatMoney(weekGain)}
                          icon={<TrendingUp size={18} />}
                        />
                      </div>
                      <div className="col-6">
                        <KpiCard
                          title="Gain mois"
                          value={formatMoney(monthGain)}
                          icon={<BarChart3 size={18} />}
                        />
                      </div>
                      <div className="col-6">
                        <KpiCard
                          title="Gain année"
                          value={formatMoney(yearGain)}
                          icon={<Percent size={18} />}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-3">
                    <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                      Téléphone
                    </div>
                    <div style={{ color: DUU.black }}>
                      {selectedAffiliate.phone || selectedAffiliate.user?.phone || "-"}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                      Utilisateur lié
                    </div>
                    <div style={{ color: DUU.black }}>
                      {selectedAffiliate.user ? (
                        <>
                          #{selectedAffiliate.user.id}{" "}
                          {selectedAffiliate.user.first_name || ""}{" "}
                          {selectedAffiliate.user.last_name || ""}
                          {selectedAffiliate.user.role
                            ? ` — ${selectedAffiliate.user.role}`
                            : ""}
                        </>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                      Notes
                    </div>
                    <div style={{ color: DUU.black }}>{selectedAffiliate.notes || "-"}</div>
                  </div>

                  <div className="mb-4">
                    <div className="small fw-semibold mb-2" style={{ color: DUU.gray }}>
                      Liens
                    </div>

                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        className="btn text-start"
                        style={{
                          background: DUU.white,
                          color: DUU.black,
                          border: `1px solid ${DUU.line}`,
                          borderRadius: 14,
                          fontWeight: 700,
                        }}
                        onClick={() => handleCopy(selectedPublicByCode, "Lien public code")}
                      >
                        <Copy size={15} className="me-2" />
                        Copier lien site affilié
                      </button>

                      <button
                        type="button"
                        className="btn text-start"
                        style={{
                          background: DUU.white,
                          color: DUU.black,
                          border: `1px solid ${DUU.line}`,
                          borderRadius: 14,
                          fontWeight: 700,
                        }}
                        onClick={() => handleCopy(selectedPublicBySlug, "Lien public slug")}
                      >
                        <Copy size={15} className="me-2" />
                        Copier lien site slug
                      </button>

                      <button
                        type="button"
                        className="btn text-start"
                        style={{
                          background: DUU.yellowSoft,
                          color: DUU.black,
                          border: `1px solid ${DUU.yellowBorder}`,
                          borderRadius: 14,
                          fontWeight: 800,
                        }}
                        onClick={() => handleCopy(selectedTrackingUrl, "Lien tracking site")}
                      >
                        <Copy size={15} className="me-2" />
                        Copier lien tracking site
                      </button>
                    </div>
                  </div>

                  <div
                    className="mb-4 p-3"
                    style={{
                      borderRadius: 18,
                      background: DUU.yellowSoft,
                      border: `1px solid ${DUU.yellowBorder}`,
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Package size={16} />
                      <div className="fw-bold" style={{ color: DUU.black }}>
                        Lien produit affilié
                      </div>
                    </div>

                    <div className="small mb-3" style={{ color: "#6B5B22" }}>
                      Choisis un produit dans la liste pour générer un lien produit
                      ou un lien tracking produit.
                    </div>

                    <div className="mb-2">
                      <label className="form-label small fw-semibold">Recherche produit</label>
                      <div className="position-relative">
                        <Search
                          size={15}
                          style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: DUU.gray,
                          }}
                        />
                        <input
                          type="text"
                          className="form-control"
                          style={{
                            paddingLeft: 36,
                            borderRadius: 14,
                            borderColor: DUU.yellowBorder,
                            background: DUU.white,
                          }}
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Nom, boutique, slug, ID..."
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Produit</label>
                      <select
                        className="form-select"
                        style={{
                          borderRadius: 14,
                          borderColor: DUU.yellowBorder,
                          background: DUU.white,
                        }}
                        value={selectedProductId}
                        onChange={(e) =>
                          setSelectedProductId(e.target.value ? Number(e.target.value) : "")
                        }
                        disabled={productsLoading}
                      >
                        <option value="">
                          {productsLoading
                            ? "Chargement des produits..."
                            : "Sélectionner un produit"}
                        </option>
                        {filteredProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            #{product.id} — {product.name}
                            {product.shop_name ? ` — ${product.shop_name}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedProduct ? (
                      <div
                        className="mb-3 p-2"
                        style={{
                          borderRadius: 14,
                          background: "rgba(255,255,255,0.7)",
                          border: `1px solid ${DUU.yellowBorder}`,
                        }}
                      >
                        <div className="fw-semibold" style={{ color: DUU.black }}>
                          {selectedProduct.name}
                        </div>
                        <div className="small" style={{ color: DUU.gray }}>
                          ID: {selectedProduct.id}
                          {selectedProduct.shop_name ? ` • ${selectedProduct.shop_name}` : ""}
                        </div>
                        <div className="small" style={{ color: DUU.gray }}>
                          Prix:{" "}
                          {formatMoney(
                            selectedProduct.promo_price || selectedProduct.price || 0,
                          )}
                          {selectedProduct.stock != null
                            ? ` • Stock: ${selectedProduct.stock}`
                            : ""}
                        </div>
                        <div className="small mt-1" style={{ color: DUU.gray }}>
                          Chemin public: {selectedProductPath || "-"}
                        </div>
                      </div>
                    ) : null}

                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        className="btn text-start"
                        style={{
                          background: DUU.black,
                          color: DUU.yellow,
                          borderRadius: 14,
                          fontWeight: 800,
                        }}
                        onClick={() =>
                          handleCopy(selectedProductPublicUrl, "Lien produit affilié")
                        }
                        disabled={!selectedProductPublicUrl}
                      >
                        <Copy size={15} className="me-2" />
                        Copier lien produit (CLIENT)
                      </button>

                      <button
                        type="button"
                        className="btn text-start"
                        style={{
                          background: DUU.white,
                          color: DUU.black,
                          border: `1px solid ${DUU.yellowBorder}`,
                          borderRadius: 14,
                          fontWeight: 700,
                        }}
                        onClick={() =>
                          handleCopy(
                            selectedProductTrackingUrl,
                            "Lien tracking produit affilié",
                          )
                        }
                        disabled={!selectedProductTrackingUrl}
                      >
                        <Copy size={15} className="me-2" />
                        Copier lien tracking (technique)
                      </button>
                    </div>

                    {selectedProductPublicUrl ? (
                      <div
                        className="small mt-3 text-break"
                        style={{ color: DUU.black, lineHeight: 1.5 }}
                      >
                        {selectedProductPublicUrl}
                      </div>
                    ) : null}
                  </div>

                  <div className="d-flex gap-2 mb-3">
                    {[
                      { key: "overview", label: "Vue" },
                      { key: "commissions", label: "Commissions" },
                      { key: "clicks", label: "Clics" },
                      { key: "history", label: "Historique" },
                    ].map((tab) => {
                      const active = detailTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          className="btn flex-fill"
                          style={{
                            borderRadius: 14,
                            background: active ? DUU.black : DUU.white,
                            color: active ? DUU.yellow : DUU.black,
                            border: `1px solid ${active ? DUU.black : DUU.line}`,
                            fontWeight: 800,
                          }}
                          onClick={() => {
                            if (tab.key === "commissions") setCommissionPage(1);
                            if (tab.key === "clicks") setClickPage(1);
                            if (tab.key === "history") setHistoryPage(1);
                            setDetailTab(tab.key as any);
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {detailTab === "overview" ? (
                    <div className="small">
                      <div className="d-flex justify-content-between py-2 border-bottom">
                        <span style={{ color: DUU.gray }}>Créé le</span>
                        <span style={{ color: DUU.black }}>
                          {formatDate(selectedAffiliate.created_at)}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-2 border-bottom">
                        <span style={{ color: DUU.gray }}>Mis à jour</span>
                        <span style={{ color: DUU.black }}>
                          {formatDate(selectedAffiliate.updated_at)}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-2 border-bottom gap-3">
                        <span style={{ color: DUU.gray }}>Lien code</span>
                        <span className="text-truncate text-end" style={{ color: DUU.black, maxWidth: 180 }}>
                          {selectedAffiliate.share_url_by_code || "-"}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-2 border-bottom gap-3">
                        <span style={{ color: DUU.gray }}>Lien slug</span>
                        <span className="text-truncate text-end" style={{ color: DUU.black, maxWidth: 180 }}>
                          {selectedAffiliate.share_url_by_slug || "-"}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-2 gap-3">
                        <span style={{ color: DUU.gray }}>Commission</span>
                        <span style={{ color: DUU.black }}>
                          {Number(selectedAffiliate.commission_rate || 0)}%
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {detailTab === "commissions" ? (
                    <>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">
                          Filtrer les commissions
                        </label>
                        <select
                          className="form-select form-select-sm"
                          style={{ borderRadius: 12, borderColor: DUU.line }}
                          value={commissionStatusFilter}
                          onChange={(e) => {
                            setCommissionPage(1);
                            setCommissionStatusFilter(e.target.value);
                          }}
                        >
                          <option value="">Tous</option>
                          <option value="PENDING">PENDING</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="PAID">PAID</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>

                      <div className="d-flex flex-column gap-2">
                        {commissionItems.length === 0 ? (
                          <div className="small" style={{ color: DUU.gray }}>
                            Aucune commission.
                          </div>
                        ) : (
                          commissionItems.map((row) => (
                            <div
                              key={row.id}
                              className="p-3"
                              style={{
                                borderRadius: 18,
                                border: `1px solid ${DUU.line}`,
                                background: DUU.white,
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                <div>
                                  <div className="fw-semibold" style={{ color: DUU.black }}>
                                    Commission #{row.id}
                                  </div>
                                  <div className="small" style={{ color: DUU.gray }}>
                                    Commande: {row.order_id ?? "-"}
                                  </div>
                                </div>

                                <span
                                  className="px-3 py-2 d-inline-flex"
                                  style={{
                                    borderRadius: 999,
                                    fontSize: ".78rem",
                                    fontWeight: 800,
                                    ...statusBadgeClass(row.status),
                                  }}
                                >
                                  {row.status}
                                </span>
                              </div>

                              <div className="small mb-3" style={{ color: DUU.black }}>
                                <div>Base: {formatMoney(getCommissionBase(row))}</div>
                                <div>Montant: {formatMoney(getCommissionAmount(row))}</div>
                                <div>Rate: {Number(row.commission_rate || 0)}%</div>
                                <div>Produit: {row.product_id ?? "-"}</div>
                                <div>Jour: {row.period_day || "-"}</div>
                                <div>Mois: {row.period_month || "-"}</div>
                                <div>Créé le: {formatDate(row.created_at)}</div>
                                <div>Payé le: {formatDate(row.paid_at)}</div>
                              </div>

                              <select
                                className="form-select form-select-sm"
                                style={{ borderRadius: 12, borderColor: DUU.line }}
                                value={row.status}
                                onChange={(e) =>
                                  handleChangeCommissionStatus(
                                    row,
                                    e.target.value as CommissionStatus,
                                  )
                                }
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="APPROVED">APPROVED</option>
                                <option value="PAID">PAID</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            </div>
                          ))
                        )}
                      </div>

                      <PaginationBar
                        pageInfo={commissionPageInfo}
                        onChange={(nextPage) => setCommissionPage(nextPage)}
                      />
                    </>
                  ) : null}

                  {detailTab === "clicks" ? (
                    <>
                      <div className="d-flex flex-column gap-2">
                        {clickItems.length === 0 ? (
                          <div className="small" style={{ color: DUU.gray }}>
                            Aucun clic.
                          </div>
                        ) : (
                          clickItems.map((row) => (
                            <div
                              key={row.id}
                              className="p-3"
                              style={{
                                borderRadius: 18,
                                border: `1px solid ${DUU.line}`,
                                background: DUU.white,
                              }}
                            >
                              <div className="fw-semibold mb-1" style={{ color: DUU.black }}>
                                Clic #{row.id}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Code: {row.affiliate_code || "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Produit: {row.product_id ?? "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Source: {row.source || "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Device: {row.device || "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                IP: {row.ip_address || "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Landing: {row.landing_url || "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Référent: {row.referer_url || "-"}
                              </div>
                              <div className="small" style={{ color: DUU.gray }}>
                                Date: {formatDate(row.created_at)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <PaginationBar
                        pageInfo={clickPageInfo}
                        onChange={(nextPage) => setClickPage(nextPage)}
                      />
                    </>
                  ) : null}

                  {detailTab === "history" ? (
                    <>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">
                          Période historique
                        </label>
                        <select
                          className="form-select form-select-sm"
                          style={{ borderRadius: 12, borderColor: DUU.line }}
                          value={historyPeriod}
                          onChange={(e) => {
                            setHistoryPage(1);
                            setHistoryPeriod(e.target.value as RevenuePeriod);
                          }}
                        >
                          <option value="DAY">Jour</option>
                          <option value="WEEK">Semaine</option>
                          <option value="MONTH">Mois</option>
                          <option value="YEAR">Année</option>
                        </select>
                      </div>

                      <div className="d-flex flex-column gap-2">
                        {historyItems.length === 0 ? (
                          <div className="small" style={{ color: DUU.gray }}>
                            Aucun historique disponible.
                          </div>
                        ) : (
                          historyItems.map((row, idx) => (
                            <div
                              key={`${row.period_key}-${idx}`}
                              className="p-3"
                              style={{
                                borderRadius: 20,
                                border: `1px solid ${DUU.line}`,
                                background: DUU.white,
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                <div>
                                  <div className="fw-bold" style={{ color: DUU.black }}>
                                    {row.period_key || "-"}
                                  </div>
                                  <div className="small" style={{ color: DUU.gray }}>
                                    {formatDateOnly(row.period_start)} → {formatDateOnly(row.period_end)}
                                  </div>
                                </div>
                                <div className="fw-bold" style={{ color: DUU.black, fontSize: "1.05rem" }}>
                                  {formatMoney(row.commission_total || 0)}
                                </div>
                              </div>

                              <div className="row g-2">
                                <div className="col-6">
                                  <HistoryStat label="Commandes" value={formatNumber(row.orders_count || 0)} />
                                </div>
                                <div className="col-6">
                                  <HistoryStat label="Ventes" value={formatMoney(row.sales_amount || 0)} />
                                </div>
                                <div className="col-6">
                                  <HistoryStat
                                    label="En attente"
                                    value={formatMoney(row.commission_pending || 0)}
                                    tone="warning"
                                  />
                                </div>
                                <div className="col-6">
                                  <HistoryStat
                                    label="Payé"
                                    value={formatMoney(row.commission_paid || 0)}
                                    tone="success"
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <PaginationBar
                        pageInfo={historyPageInfo}
                        onChange={(nextPage) => setHistoryPage(nextPage)}
                      />
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 p-lg-4" style={cardStyle()}>
        <SectionTitle
          icon={<ChevronRight size={20} />}
          title="Lecture métier"
          sub="Ce que ce dashboard te montre concrètement"
        />

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div
              className="p-3 h-100"
              style={{
                borderRadius: 18,
                background: DUU.yellowSoft,
                border: `1px solid ${DUU.yellowBorder}`,
              }}
            >
              <div className="fw-bold mb-2" style={{ color: DUU.black }}>
                Acquisition
              </div>
              <div className="small" style={{ color: "#5B5B5B" }}>
                Les clics trackés permettent de voir quels affiliés apportent du trafic
                réel via les liens code, slug, site et produit.
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div
              className="p-3 h-100"
              style={{
                borderRadius: 18,
                background: DUU.white,
                border: `1px solid ${DUU.line}`,
              }}
            >
              <div className="fw-bold mb-2" style={{ color: DUU.black }}>
                Conversion
              </div>
              <div className="small" style={{ color: "#5B5B5B" }}>
                Les commandes et commissions montrent quels affiliés convertissent
                réellement le trafic en ventes. Le code affilié reste transporté dans
                le parcours client grâce aux liens avec <code>ref</code>.
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div
              className="p-3 h-100"
              style={{
                borderRadius: 18,
                background: DUU.white,
                border: `1px solid ${DUU.line}`,
              }}
            >
              <div className="fw-bold mb-2" style={{ color: DUU.black }}>
                Historique
              </div>
              <div className="small" style={{ color: "#5B5B5B" }}>
                Les rapports jour, semaine, mois et année permettent à chaque affilié
                de vérifier ses gains passés et à l’admin de suivre le revenu global
                du réseau.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}