// src/pages/AdminHome.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { listOrders, getOrdersSummary, type Order } from "../services/orders";
import { listProducts, listTopOrderedProducts, type Product } from "../services/products";
import { listShops, type Shop } from "../services/shops";
import { listUsers, type User } from "../services/users";
import { api } from "../services/http";
import { LoadingState } from "../components/ui/Spinner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { subscribeSSE, type ServerEvent } from "../services/events";
import { getAccessToken, me } from "../services/auth";
import { listVendorApplications } from "../services/vendorApplications";
import { getAffiliatesRevenueSummary } from "../services/affiliates";
import { imgUrl } from "../utils/media";
import {
  PageHeader,
  KpiCard,
  SectionCard,
  KpiSparkCard,
  DonutStat,
  RankedList,
  CountryBreakdownList,
  type DonutSegment,
  type RankedListItem,
  type CountryBreakdownItem,
} from "../components/admin/adminUI";
import {
  Wallet,
  BadgePercent,
  ShoppingBag,
  Package,
  Store,
  Users,
  UserPlus,
  Globe2,
} from "lucide-react";

type AnyObj = Record<string, any>;

export type SalesPoint = { date: string; revenue: number; orders: number };

type SiteStatusState = {
  is_closed: boolean;
  message: string;
};

type AdminProductLite = {
  id: number;
  name: string;
  stock_status?: string | null;
  is_out_of_stock?: boolean | number | null;
  availability_message?: string | null;
  is_active?: boolean | number | null;
};

function mad(n?: number | null) {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(v);
}

/** Variation réelle (7 derniers jours vs 7 jours précédents) à partir de la série 30 jours. */
function computeTrend(series: SalesPoint[], key: "revenue" | "orders"): number | null {
  if (series.length < 14) return null;
  const last7 = series.slice(-7).reduce((s, p) => s + p[key], 0);
  const prev7 = series.slice(-14, -7).reduce((s, p) => s + p[key], 0);
  if (prev7 <= 0) return null;
  return ((last7 - prev7) / prev7) * 100;
}

const COUNTRY_LABELS: Record<string, string> = {
  MA: "Maroc",
  CI: "Côte d'Ivoire",
  "N/D": "Non renseigné",
};

function countryLabel(code: string) {
  return COUNTRY_LABELS[code] || code;
}

function shortDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function safeTotal(o: any): number {
  const candidates = [o?.total, o?.total_amount, o?.amount];
  const v =
    candidates.find((x) => typeof x === "number") ??
    Number(candidates.find((x) => x != null));
  return Number.isFinite(v) ? Number(v) : 0;
}

function normStatus(s: any): string {
  return String(s || "").trim().toUpperCase();
}

function readTotalFromPaged(res: any): number {
  return res?.pageInfo?.total ?? res?.total ?? (Array.isArray(res?.items) ? res.items.length : 0) ?? 0;
}

function itemsAmount(o: any): number {
  const anyO = o as any;
  const totals = anyO.totals;

  if (totals && typeof totals.items_amount === "number" && !isNaN(totals.items_amount)) {
    return Number(totals.items_amount);
  }

  if (Array.isArray(anyO.items) && anyO.items.length > 0) {
    return anyO.items.reduce((sum: number, it: any) => {
      const unit = Number(it.unit_price ?? it.price ?? 0);
      const qty = Number(it.qty ?? 1);
      return sum + unit * qty;
    }, 0);
  }

  const total = safeTotal(anyO);
  const feeCandidates = [totals?.delivery_fee, anyO.delivery_fee, anyO.delivery?.fee];
  const feeRaw =
    feeCandidates.find((x: any) => typeof x === "number") ??
    Number(feeCandidates.find((x: any) => x != null));
  const fee = Number.isFinite(feeRaw) ? Number(feeRaw) : 0;

  const items = total - fee;
  return items > 0 ? items : 0;
}

function useChartHeight() {
  const pick = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    if (w < 360) return 210;
    if (w < 400) return 220;
    if (w < 576) return 240;
    if (w < 768) return 260;
    if (w < 992) return 280;
    if (w < 1200) return 300;
    return 320;
  };
  const [h, setH] = useState<number>(pick);
  useEffect(() => {
    const onR = () => setH(pick());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return h;
}

function useIsMobile(breakpoint = 576) {
  const pick = () => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  const [m, setM] = useState<boolean>(pick);
  useEffect(() => {
    const onR = () => setM(pick());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [breakpoint]);
  return m;
}

function dateKeyTZ(d: Date, timeZone = "Africa/Casablanca") {
  const fmt = new Intl.DateTimeFormat("fr-MA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function weekdayNameTZ(d: Date, timeZone = "Africa/Casablanca") {
  return new Intl.DateTimeFormat("fr-MA", { timeZone, weekday: "long" }).format(d).toLowerCase();
}

function getStartOfWeekTZ(today: Date, timeZone = "Africa/Casablanca") {
  const t = new Date(today);
  for (let i = 0; i < 7; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    if (weekdayNameTZ(d, timeZone) === "lundi") return d;
  }
  return new Date(today);
}

function getStartOfMonthTZ(today: Date) {
  const d = new Date(today);
  d.setDate(1);
  return d;
}

function doneDate(o: any): Date | null {
  if (normStatus(o?.status) !== "DONE") return null;
  const iso =
    (o as any)?.done_at ??
    (o as any)?.completed_at ??
    (o as any)?.delivered_at ??
    (o as any)?.updated_at ??
    (o as any)?.created_at;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function doneKey(o: any, tz = "Africa/Casablanca"): string | null {
  const d = doneDate(o);
  return d ? dateKeyTZ(d, tz) : null;
}

type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
} & AnyObj;

function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "VENDOR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE";
}

// ✅ Le backend (GET /api/orders) scope déjà correctement les commandes
// d'un vendeur/fournisseur/restaurant (jointure order_items → products →
// shops.owner_id) : pas besoin de re-filtrer côté client. L'ancien filtre
// `orderBelongsToUser` reposait sur des champs qui n'existent pas sur la
// ligne de commande (order.shop_id/vendor_id) et pouvait donc masquer à
// tort des commandes pourtant correctement renvoyées par l'API.

function statusClass(s: string) {
  const st = String(s || "").toUpperCase();
  if (st === "DONE") return "bg-success";
  if (st === "CANCELLED") return "bg-danger";
  if (st === "DELIVERY") return "bg-primary";
  if (st === "PREPARATION") return "bg-warning text-dark";
  return "bg-secondary";
}

type CountryBreakdown = { country_code: string; revenue: number; orders: number };

type OrdersByStatus = {
  open: number;
  preparation: number;
  delivery: number;
  done: number;
  cancelled: number;
};

type Summary = {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  revenue_year: number;

  orders_today: number;
  orders_week: number;
  orders_month: number;
  orders_year: number;

  duumini_commission_today: number;
  duumini_commission_week: number;
  duumini_commission_month: number;
  duumini_commission_year: number;

  orders_pending: number;
  products_active: number;
  shops_total: number;
  users_total: number;
  sales_series: SalesPoint[];
  revenue_by_country: CountryBreakdown[];
  orders_by_status: OrdersByStatus;
};

function normalizeSiteStatusResponse(data: any): SiteStatusState {
  return {
    is_closed: Boolean(
      data?.is_closed ??
      data?.site_closed ??
      data?.closed ??
      false
    ),
    message: String(
      data?.message ??
      data?.site_closed_message ??
      "Le site est temporairement fermé. Merci de revenir plus tard."
    ),
  };
}

function defaultClosedMessage() {
  return "Le site est temporairement fermé. Merci de revenir plus tard.";
}

function defaultProductOutMessage() {
  return "Ce produit est actuellement en rupture de stock.";
}

function productIsOut(p: any) {
  const stockStatus = String(p?.stock_status || "").trim().toUpperCase();
  return Boolean(
    p?.is_out_of_stock === true ||
    Number(p?.is_out_of_stock || 0) === 1 ||
    stockStatus === "OUT_OF_STOCK"
  );
}

async function fetchOrdersByStatusPaginated(status: string, maxPages = 20, pageSize = 200) {
  const all: Order[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await listOrders({ page, pageSize, status } as any);
    const items: Order[] = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

function computeSummaryFromDoneOrders(ordersDone: Order[]) {
  const TZ = "Africa/Casablanca";
  const today = new Date();
  const todayKey = dateKeyTZ(today, TZ);

  const startWeek = getStartOfWeekTZ(today, TZ);
  const weekKeys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(startWeek);
    d.setDate(startWeek.getDate() + i);
    const key = dateKeyTZ(d, TZ);
    weekKeys.add(key);
    if (key === todayKey) break;
  }

  const startMonth = getStartOfMonthTZ(today);
  const monthKeys = new Set<string>();
  for (let d = new Date(startMonth); d <= today; d.setDate(d.getDate() + 1)) {
    monthKeys.add(dateKeyTZ(d, TZ));
  }

  const startYear = new Date(today.getFullYear(), 0, 1);
  const yearKeys = new Set<string>();
  for (let d = new Date(startYear); d <= today; d.setDate(d.getDate() + 1)) {
    yearKeys.add(dateKeyTZ(d, TZ));
  }

  let revenue_today = 0;
  let revenue_week = 0;
  let revenue_month = 0;
  let revenue_year = 0;

  let orders_today = 0;
  let orders_week = 0;
  let orders_month = 0;
  let orders_year = 0;

  let duu_today = 0;
  let duu_week = 0;
  let duu_month = 0;
  let duu_year = 0;

  const countryMap = new Map<string, { revenue: number; orders: number }>();

  for (const o of ordersDone) {
    if (normStatus((o as any)?.status) !== "DONE") continue;

    const key = doneKey(o, TZ);
    if (!key) continue;

    const amount = itemsAmount(o as any);
    const commissionRaw =
      (o as any).commission_duumini ?? (o as any).duumini_commission ?? (o as any).commission ?? 0;
    const commission = Number(commissionRaw) || 0;

    if (key === todayKey) {
      revenue_today += amount;
      orders_today += 1;
      duu_today += commission;
    }
    if (weekKeys.has(key)) {
      revenue_week += amount;
      orders_week += 1;
      duu_week += commission;
    }
    if (monthKeys.has(key)) {
      revenue_month += amount;
      orders_month += 1;
      duu_month += commission;
    }
    if (yearKeys.has(key)) {
      revenue_year += amount;
      orders_year += 1;
      duu_year += commission;
    }

    const cc = String((o as any)?.country_code || "").trim().toUpperCase() || "N/D";
    const bucket = countryMap.get(cc) || { revenue: 0, orders: 0 };
    bucket.revenue += amount;
    bucket.orders += 1;
    countryMap.set(cc, bucket);
  }

  const revenue_by_country: CountryBreakdown[] = Array.from(countryMap.entries())
    .map(([country_code, v]) => ({ country_code, revenue: v.revenue, orders: v.orders }))
    .sort((a, b) => b.revenue - a.revenue);

  const days = 30;
  const map = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(dateKeyTZ(d, TZ), { revenue: 0, orders: 0 });
  }
  for (const o of ordersDone) {
    if (normStatus((o as any)?.status) !== "DONE") continue;
    const key = doneKey(o, TZ);
    if (!key) continue;
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += itemsAmount(o as any);
  }

  const sales_series: SalesPoint[] = Array.from(map.entries()).map(([k, v]) => ({
    date: k.slice(5),
    revenue: v.revenue,
    orders: v.orders,
  }));

  return {
    revenue_today,
    revenue_week,
    revenue_month,
    revenue_year,
    orders_today,
    orders_week,
    orders_month,
    orders_year,
    duumini_commission_today: duu_today,
    duumini_commission_week: duu_week,
    duumini_commission_month: duu_month,
    duumini_commission_year: duu_year,
    sales_series,
    revenue_by_country,
  };
}

async function buildSummaryAdmin(): Promise<Summary> {
  const [productsRes, shopsRes, usersRes] = await Promise.all([
    listProducts({ page: 1, pageSize: 1 }),
    listShops({ page: 1, pageSize: 1 }),
    listUsers({ page: 1, pageSize: 1 }),
  ]);

  const ordersDone = await fetchOrdersByStatusPaginated("DONE", 20, 200);
  const core = computeSummaryFromDoneOrders(ordersDone);

  const [openRes, prepRes, deliveryRes, cancelledRes, revenueSummary] = await Promise.all([
    listOrders({ page: 1, pageSize: 1, status: "OPEN" } as any),
    listOrders({ page: 1, pageSize: 1, status: "PREPARATION" } as any),
    listOrders({ page: 1, pageSize: 1, status: "DELIVERY" } as any),
    listOrders({ page: 1, pageSize: 1, status: "CANCELLED" } as any),
    getOrdersSummary().catch(() => null),
  ]);

  const orders_by_status: OrdersByStatus = {
    open: readTotalFromPaged(openRes),
    preparation: readTotalFromPaged(prepRes),
    delivery: readTotalFromPaged(deliveryRes),
    done: ordersDone.length,
    cancelled: readTotalFromPaged(cancelledRes),
  };

  return {
    ...core,
    // ✅ CA calculé côté serveur (mêmes bornes de période que les
    // dépenses) pour un solde net cohérent — remplace le calcul JS ci-dessus
    // qui reste utile pour le graphique 30 jours et la commission.
    ...(revenueSummary
      ? {
          revenue_today: revenueSummary.today,
          revenue_week: revenueSummary.week,
          revenue_month: revenueSummary.month,
          revenue_year: revenueSummary.year,
        }
      : {}),
    orders_pending: orders_by_status.open + orders_by_status.preparation,
    products_active: readTotalFromPaged(productsRes),
    shops_total: readTotalFromPaged(shopsRes),
    users_total: readTotalFromPaged(usersRes),
    orders_by_status,
  };
}

async function buildSummaryVendor(): Promise<Summary> {
  // ✅ Le backend scope déjà ces listes à la boutique du vendeur connecté —
  // pas de re-filtrage client nécessaire (voir note plus haut).
  const ordersDone = await fetchOrdersByStatusPaginated("DONE", 20, 200);
  const core = computeSummaryFromDoneOrders(ordersDone);

  const [openAll, prepAll, deliveryAll, cancelledAll, revenueSummary] = await Promise.all([
    fetchOrdersByStatusPaginated("OPEN", 10, 200),
    fetchOrdersByStatusPaginated("PREPARATION", 10, 200),
    fetchOrdersByStatusPaginated("DELIVERY", 10, 200),
    fetchOrdersByStatusPaginated("CANCELLED", 10, 200),
    getOrdersSummary().catch(() => null),
  ]);
  const pending = openAll.length + prepAll.length;

  const orders_by_status: OrdersByStatus = {
    open: openAll.length,
    preparation: prepAll.length,
    delivery: deliveryAll.length,
    done: ordersDone.length,
    cancelled: cancelledAll.length,
  };

  return {
    ...core,
    ...(revenueSummary
      ? {
          revenue_today: revenueSummary.today,
          revenue_week: revenueSummary.week,
          revenue_month: revenueSummary.month,
          revenue_year: revenueSummary.year,
        }
      : {}),
    orders_pending: pending,
    products_active: 0,
    shops_total: 0,
    users_total: 0,
    orders_by_status,
  };
}

export default function AdminHome() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [, setLastUpdate] = useState<Date | null>(null);

  const [commissionFilter, setCommissionFilter] = useState<"today" | "week" | "month" | "year">("today");
  const [earningsPeriod, setEarningsPeriod] = useState<"week" | "month" | "year">("month");
  const [ordersPeriod, setOrdersPeriod] = useState<"week" | "month" | "year">("month");

  const [siteStatus, setSiteStatus] = useState<SiteStatusState>({
    is_closed: false,
    message: defaultClosedMessage(),
  });
  const [siteStatusLoading, setSiteStatusLoading] = useState(false);
  const [siteActionLoading, setSiteActionLoading] = useState(false);

  const [productsQuick, setProductsQuick] = useState<AdminProductLite[]>([]);
  const [productsQuickLoading, setProductsQuickLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedProductMessage, setSelectedProductMessage] = useState(defaultProductOutMessage());
  const [productActionLoading, setProductActionLoading] = useState(false);

  const [pendingApplications, setPendingApplications] = useState<number | null>(null);
  const [affiliateSummary, setAffiliateSummary] = useState<{
    clicks: number;
    orders: number;
    earnings: number;
  } | null>(null);

  const chartHeight = useChartHeight();
  const isMobile = useIsMobile(576);

  const refreshingRef = useRef(false);
  const visibleRef = useRef<boolean>(true);
  const sseRef = useRef<{ close(): void } | null>(null);

  const selectedProduct = useMemo(() => {
    const id = Number(selectedProductId || 0);
    if (!id) return null;
    return productsQuick.find((p) => Number(p.id) === id) || null;
  }, [selectedProductId, productsQuick]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (!mounted) return;
        setUser((u as any) || null);
      } catch {
        if (!mounted) return;
        setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadSiteStatus = useCallback(async () => {
    if (isVendor) return;
    try {
      setSiteStatusLoading(true);
      const res = await api.get("/api/admin/site-status");
      setSiteStatus(normalizeSiteStatusResponse(res));
    } catch {
      setSiteStatus({
        is_closed: false,
        message: defaultClosedMessage(),
      });
    } finally {
      setSiteStatusLoading(false);
    }
  }, [isVendor]);

  const loadQuickProducts = useCallback(async () => {
    if (isVendor) return;
    try {
      setProductsQuickLoading(true);
      const res = await listProducts({ page: 1, pageSize: 100 } as any);
      const items = Array.isArray((res as any)?.items) ? (res as any).items : [];
      const normalized: AdminProductLite[] = items
        .map((p: any) => ({
          id: Number(p?.id || 0),
          name: String(p?.name || p?.product_name || `Produit #${p?.id || ""}`),
          stock_status: p?.stock_status ?? null,
          is_out_of_stock: p?.is_out_of_stock ?? null,
          availability_message: p?.availability_message ?? p?.stock_message ?? null,
          is_active: p?.is_active ?? null,
        }))
        .filter((p: any) => p.id > 0);
      setProductsQuick(normalized);
    } catch {
      setProductsQuick([]);
    } finally {
      setProductsQuickLoading(false);
    }
  }, [isVendor]);

  const loadPendingApplications = useCallback(async () => {
    if (isVendor) return;
    try {
      const res = await listVendorApplications({ status: "PENDING", pageSize: 1 });
      setPendingApplications(res?.pageInfo?.total ?? 0);
    } catch {
      setPendingApplications(null);
    }
  }, [isVendor]);

  const loadAffiliateSummary = useCallback(async () => {
    if (isVendor) return;
    try {
      const res = await getAffiliatesRevenueSummary("MONTH");
      setAffiliateSummary({
        clicks: Number(res?.global?.clicks_count || 0),
        orders: Number(res?.global?.orders_count || 0),
        earnings: Number(res?.global?.commission_total || 0),
      });
    } catch {
      setAffiliateSummary(null);
    }
  }, [isVendor]);

  const loadTopProducts = useCallback(async () => {
    if (isVendor) return;
    try {
      const items = await listTopOrderedProducts({ limit: 6, onlyActive: true });
      setTopProducts(Array.isArray(items) ? items : []);
    } catch {
      setTopProducts([]);
    }
  }, [isVendor]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);

    try {
      const curUser = user;

      if (curUser && isVendorRole(curUser.role)) {
        const [sum, lastOrdersOpen, lastOrdersPrep, lastOrdersDeliv] = await Promise.all([
          buildSummaryVendor(),
          listOrders({ page: 1, pageSize: 6, status: "OPEN" } as any).catch(() => ({ items: [] })),
          listOrders({ page: 1, pageSize: 6, status: "PREPARATION" } as any).catch(() => ({ items: [] })),
          listOrders({ page: 1, pageSize: 6, status: "DELIVERY" } as any).catch(() => ({ items: [] })),
        ]);

        const combined = [
          ...((lastOrdersOpen as any)?.items || []),
          ...((lastOrdersPrep as any)?.items || []),
          ...((lastOrdersDeliv as any)?.items || []),
        ] as Order[];

        const mine = combined
          .sort((a: any, b: any) => {
            const ta = new Date(a?.created_at || 0).getTime();
            const tb = new Date(b?.created_at || 0).getTime();
            return tb - ta;
          })
          .slice(0, 6);

        setKpi(sum);
        setOrders(mine);
        setShops([]);
        setUsers([]);
        setError(null);
        setLastUpdate(new Date());
        return;
      }

      const results = await Promise.allSettled([
        (async () => ({ kind: "sum" as const, val: await buildSummaryAdmin() }))(),
        (async () => ({ kind: "orders" as const, val: await listOrders({ page: 1, pageSize: 6 }) }))(),
        (async () => ({ kind: "shops" as const, val: await listShops({ page: 1, pageSize: 6 }) }))(),
        (async () => ({ kind: "users" as const, val: await listUsers({ page: 1, pageSize: 6 }) }))(),
      ]);

      let sum: Summary = {
        revenue_today: 0,
        revenue_week: 0,
        revenue_month: 0,
        revenue_year: 0,
        orders_today: 0,
        orders_week: 0,
        orders_month: 0,
        orders_year: 0,
        duumini_commission_today: 0,
        duumini_commission_week: 0,
        duumini_commission_month: 0,
        duumini_commission_year: 0,
        orders_pending: 0,
        products_active: 0,
        shops_total: 0,
        users_total: 0,
        sales_series: [],
        revenue_by_country: [],
        orders_by_status: { open: 0, preparation: 0, delivery: 0, done: 0, cancelled: 0 },
      };

      let oItems: Order[] | null = null;
      let sItems: Shop[] | null = null;
      let uItems: User[] | null = null;

      let firstErr: string | null = null;

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { kind, val } = (r as any).value as any;
          if (kind === "sum") sum = val as Summary;
          if (kind === "orders") oItems = Array.isArray(val?.items) ? val.items : [];
          if (kind === "shops") sItems = Array.isArray(val?.items) ? val.items : [];
          if (kind === "users") uItems = Array.isArray(val?.items) ? val.items : [];
        } else {
          firstErr ||= (r as any).reason?.message || String((r as any).reason) || null;
        }
      }

      setKpi(sum);
      setOrders(oItems);
      setShops(sItems);
      setUsers(uItems);
      setError(firstErr);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (isVendor) return;
    loadSiteStatus();
    loadQuickProducts();
    loadPendingApplications();
    loadAffiliateSummary();
    loadTopProducts();
  }, [
    isVendor,
    loadSiteStatus,
    loadQuickProducts,
    loadPendingApplications,
    loadAffiliateSummary,
    loadTopProducts,
  ]);

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedProductMessage(defaultProductOutMessage());
      return;
    }
    setSelectedProductMessage(
      String(selectedProduct.availability_message || "").trim() || defaultProductOutMessage()
    );
  }, [selectedProduct]);

  useEffect(() => {
    const onVis = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      if (visibleRef.current) refresh();
    }, 15000);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const base = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
    const url = `${base}/api/events/stream?access_token=${encodeURIComponent(token)}`;

    const sse = subscribeSSE(url, (evt: ServerEvent) => {
      if (evt?.type === "ORDER_CREATED" || evt?.type === "ORDER_STATUS") {
        refresh();
      }
    });
    sseRef.current = sse;

    return () => {
      try {
        sseRef.current?.close();
      } catch {}
      sseRef.current = null;
    };
  }, [refresh]);

  const handleCloseSite = useCallback(async () => {
    try {
      setSiteActionLoading(true);
      const payload = {
        is_closed: true,
        message: String(siteStatus.message || "").trim() || defaultClosedMessage(),
      };
      const res = await api.put("/api/admin/site-status", payload);
      setSiteStatus(normalizeSiteStatusResponse(res));
    } catch (e: any) {
      setError(
        e?.message ||
          e?.response?.data?.error ||
          "Impossible de fermer le site."
      );
    } finally {
      setSiteActionLoading(false);
    }
  }, [siteStatus.message]);

  const handleOpenSite = useCallback(async () => {
    try {
      setSiteActionLoading(true);
      const res = await api.put("/api/admin/site-status", {
        is_closed: false,
        message: "",
      });
      const normalized = normalizeSiteStatusResponse(res);
      setSiteStatus({
        is_closed: false,
        message: normalized.message || "",
      });
    } catch (e: any) {
      setError(
        e?.message ||
          e?.response?.data?.error ||
          "Impossible de réouvrir le site."
      );
    } finally {
      setSiteActionLoading(false);
    }
  }, []);

  const handleMarkProductOut = useCallback(async () => {
    const id = Number(selectedProductId || 0);
    if (!id) return;

    try {
      setProductActionLoading(true);
      const message =
        String(selectedProductMessage || "").trim() || defaultProductOutMessage();

      await api.patch(`/api/products/${id}/stock-status`, {
        is_out_of_stock: true,
        availability_message: message,
      });

      setProductsQuick((prev) =>
        prev.map((p) =>
          Number(p.id) === id
            ? {
                ...p,
                stock_status: "OUT_OF_STOCK",
                is_out_of_stock: true,
                availability_message: message,
              }
            : p
        )
      );
    } catch (e: any) {
      setError(
        e?.message ||
          e?.response?.data?.error ||
          "Impossible de mettre le produit en rupture."
      );
    } finally {
      setProductActionLoading(false);
    }
  }, [selectedProductId, selectedProductMessage]);

  const handleReopenProduct = useCallback(async () => {
    const id = Number(selectedProductId || 0);
    if (!id) return;

    try {
      setProductActionLoading(true);

      await api.patch(`/api/products/${id}/stock-status`, {
        is_out_of_stock: false,
        availability_message: null,
      });

      setProductsQuick((prev) =>
        prev.map((p) =>
          Number(p.id) === id
            ? {
                ...p,
                stock_status: "IN_STOCK",
                is_out_of_stock: false,
                availability_message: null,
              }
            : p
        )
      );
    } catch (e: any) {
      setError(
        e?.message ||
          e?.response?.data?.error ||
          "Impossible de réouvrir le produit."
      );
    } finally {
      setProductActionLoading(false);
    }
  }, [selectedProductId]);

  const series = useMemo<SalesPoint[]>(() => kpi?.sales_series || [], [kpi]);

  const commissionValue = useMemo(() => {
    if (!kpi) return 0;
    switch (commissionFilter) {
      case "today":
        return kpi.duumini_commission_today;
      case "week":
        return kpi.duumini_commission_week;
      case "month":
        return kpi.duumini_commission_month;
      case "year":
        return kpi.duumini_commission_year;
      default:
        return 0;
    }
  }, [kpi, commissionFilter]);

  const commissionLabel = useMemo(() => {
    switch (commissionFilter) {
      case "today":
        return "Aujourd’hui (commandes DONE)";
      case "week":
        return "Cette semaine (lun → aujourd’hui, DONE)";
      case "month":
        return "Ce mois (1 → aujourd’hui, DONE)";
      case "year":
        return "Cette année (01/01 → aujourd’hui, DONE)";
      default:
        return "";
    }
  }, [commissionFilter]);

  const earningsTrend = useMemo(() => computeTrend(series, "revenue"), [series]);
  const ordersTrend = useMemo(() => computeTrend(series, "orders"), [series]);

  const donutSegments = useMemo<DonutSegment[]>(() => {
    const s = kpi?.orders_by_status;
    if (!s) return [];
    return [
      { label: "Terminées", value: s.done, color: "var(--duu-green)" },
      { label: "En cours", value: s.open + s.preparation + s.delivery, color: "var(--duu-orange)" },
      { label: "Annulées", value: s.cancelled, color: "var(--duu-red)" },
    ].filter((x) => x.value > 0);
  }, [kpi]);

  const donutTotal = useMemo(
    () => donutSegments.reduce((s, x) => s + x.value, 0),
    [donutSegments]
  );

  const countryItems = useMemo<CountryBreakdownItem[]>(() => {
    const rows = kpi?.revenue_by_country || [];
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.slice(0, 5).map((r) => ({
      label: countryLabel(r.country_code),
      value: `${mad(r.revenue)} · ${r.orders} cmd`,
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [kpi]);

  const topProductItems = useMemo<RankedListItem[]>(
    () =>
      topProducts.map((p) => ({
        id: p.id,
        thumb: p.cover ? imgUrl(p.cover) : null,
        title: p.name,
        subtitle: mad(p.price),
        valueLabel: `${Number(p.total_qty || 0)} vendu(s)`,
        to: `/admin/products?edit=${p.id}`,
      })),
    [topProducts]
  );

  return (
    <div className="container-xxl py-0 px-2 px-sm-3">
      <PageHeader
        title={isVendor ? "Mon espace vendeur" : "Tableau de bord"}
        subtitle={
          isVendor
            ? "Suivez vos ventes, vos produits et vos promotions en un coup d'œil."
            : "Vue d'ensemble de l'activité Duumini : ventes, boutiques, candidatures et affiliation."
        }
      />

      {!isVendor && (
        <>
          <div className="row g-2 g-sm-3 mb-3">
            <div className="col-6 col-xl-3">
              <KpiSparkCard
                icon={Wallet}
                accent="green"
                label="Chiffre d'affaires"
                value={mad(kpi?.[`revenue_${earningsPeriod}`])}
                trendPercent={earningsTrend}
                periodOptions={[
                  { value: "week", label: "Semaine" },
                  { value: "month", label: "Mois" },
                  { value: "year", label: "Année" },
                ]}
                period={earningsPeriod}
                onPeriodChange={(v) => setEarningsPeriod(v as "week" | "month" | "year")}
                sparklineData={series.slice(-7).map((p) => p.revenue)}
              />
            </div>

            <div className="col-6 col-xl-3">
              <KpiSparkCard
                icon={ShoppingBag}
                accent="orange"
                label="Commandes"
                value={kpi?.[`orders_${ordersPeriod}`] ?? 0}
                trendPercent={ordersTrend}
                periodOptions={[
                  { value: "week", label: "Semaine" },
                  { value: "month", label: "Mois" },
                  { value: "year", label: "Année" },
                ]}
                period={ordersPeriod}
                onPeriodChange={(v) => setOrdersPeriod(v as "week" | "month" | "year")}
                sparklineData={series.slice(-7).map((p) => p.orders)}
                to="/admin/orders"
              />
            </div>

            <div className="col-6 col-xl-3">
              <KpiSparkCard
                icon={Users}
                accent="purple"
                label="Utilisateurs"
                value={kpi?.users_total ?? 0}
                to="/admin/users"
              />
            </div>

            <div className="col-6 col-xl-3">
              <KpiSparkCard
                icon={BadgePercent}
                accent="blue"
                label="Commission Duumini"
                value={mad(commissionValue)}
                periodOptions={[
                  { value: "today", label: "Aujourd’hui" },
                  { value: "week", label: "Semaine" },
                  { value: "month", label: "Mois" },
                  { value: "year", label: "Année" },
                ]}
                period={commissionFilter}
                onPeriodChange={(v) => setCommissionFilter(v as "today" | "week" | "month" | "year")}
              />
            </div>
          </div>

          <div className="row g-2 g-sm-3 mb-3">
            <div className="col-12 col-xl-6">
              <div className="card h-100 shadow-sm border-0">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h2 className="h6 mb-0" style={{ color: "var(--duu-black)" }}>
                      Revenu (30 jours)
                    </h2>
                  </div>
                  <div style={{ width: "100%", height: 260 }}>
                    {loading ? (
                      <div className="placeholder w-100 h-100 rounded" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis
                            tickFormatter={(v) => `${Math.round((Number(v) || 0) / 1000)}k`}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip formatter={(v: any) => [mad(Number(v)), "CA hors livraison"]} />
                          <Bar dataKey="revenue" fill="var(--duu-orange)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-3">
              <SectionCard title="Statut des commandes" subtitle="Toutes périodes confondues" className="h-100">
                {donutSegments.length === 0 ? (
                  <div className="text-muted small">Aucune commande pour le moment.</div>
                ) : (
                  <DonutStat
                    centerLabel="Commandes"
                    centerValue={donutTotal}
                    segments={donutSegments}
                  />
                )}
              </SectionCard>
            </div>

            <div className="col-12 col-xl-3">
              <SectionCard title="Top ventes" subtitle="Produits les plus commandés" className="h-100">
                <RankedList items={topProductItems} />
              </SectionCard>
            </div>
          </div>

          <div className="row g-2 g-sm-3 mb-3">
            <div className="col-12 col-lg-6">
              <SectionCard
                icon={Globe2}
                title="Répartition par pays"
                subtitle="CA (commandes DONE), tous corridors"
                className="h-100"
              >
                <CountryBreakdownList items={countryItems} />
              </SectionCard>
            </div>
          </div>
        </>
      )}

      {!isVendor && (
        <div className="row g-2 g-sm-3 mb-3">
          <div className="col-12 col-lg-6 col-xl-4">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-3">
                  <div>
                    <h2 className="h6 mb-0" style={{ color: "var(--duu-black)" }}>
                      Pilotage du site
                    </h2>
                    <div className="text-muted small">
                      Fermer ou réouvrir tout le site avec un message clair.
                    </div>
                  </div>

                  <span
                    className={`badge ${
                      siteStatus.is_closed ? "bg-danger" : "bg-success"
                    }`}
                    style={{ borderRadius: 999, fontSize: 12 }}
                  >
                    {siteStatus.is_closed ? "Site fermé" : "Site ouvert"}
                  </span>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Message affiché quand le site est fermé
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={siteStatus.message}
                    onChange={(e) =>
                      setSiteStatus((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    placeholder="Ex: Le site est temporairement fermé. Merci de revenir plus tard."
                    disabled={siteActionLoading || siteStatusLoading}
                  />
                  <div className="form-text">
                    Ce message ne sera affiché que lorsque le site est fermé.
                  </div>
                </div>

                {siteStatus.is_closed ? (
                  <div className="alert alert-warning mb-3">
                    <div className="fw-semibold mb-1">Message actuellement affiché</div>
                    <div>
                      {String(siteStatus.message || "").trim() || defaultClosedMessage()}
                    </div>
                  </div>
                ) : null}

                <div className="d-flex flex-column flex-sm-row gap-2">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleCloseSite}
                    disabled={siteActionLoading || siteStatusLoading}
                  >
                    {siteActionLoading && siteStatus.is_closed
                      ? "Mise à jour…"
                      : "Fermer le site"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleOpenSite}
                    disabled={siteActionLoading || siteStatusLoading}
                  >
                    {siteActionLoading && !siteStatus.is_closed
                      ? "Mise à jour…"
                      : "Réouvrir le site"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6 col-xl-4">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-3">
                  <div>
                    <h2 className="h6 mb-0" style={{ color: "var(--duu-black)" }}>
                      Gestion rapide des produits
                    </h2>
                    <div className="text-muted small">
                      Marquer un produit en rupture ou le réouvrir.
                    </div>
                  </div>

                  {selectedProduct ? (
                    <span
                      className={`badge ${
                        productIsOut(selectedProduct) ? "bg-danger" : "bg-success"
                      }`}
                      style={{ borderRadius: 999, fontSize: 12 }}
                    >
                      {productIsOut(selectedProduct) ? "En rupture" : "Disponible"}
                    </span>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Produit</label>
                  <select
                    className="form-select"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value) || "")}
                    disabled={productsQuickLoading || productActionLoading}
                  >
                    <option value="">Sélectionner un produit</option>
                    {productsQuick.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Message de rupture
                  </label>
                  <input
                    className="form-control"
                    value={selectedProductMessage}
                    onChange={(e) => setSelectedProductMessage(e.target.value)}
                    placeholder="Ce produit est actuellement en rupture de stock."
                    disabled={!selectedProduct || productActionLoading}
                  />
                  <div className="form-text">
                    Ce message sera visible uniquement si le produit est en rupture.
                  </div>
                </div>

                {selectedProduct && productIsOut(selectedProduct) ? (
                  <div className="alert alert-warning mb-3">
                    <div className="fw-semibold mb-1">Message actuellement affiché</div>
                    <div>
                      {String(selectedProduct.availability_message || "").trim() ||
                        defaultProductOutMessage()}
                    </div>
                  </div>
                ) : null}

                <div className="d-flex flex-column flex-sm-row gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={!selectedProduct || productActionLoading}
                    onClick={handleMarkProductOut}
                  >
                    {productActionLoading && productIsOut(selectedProduct)
                      ? "Mise à jour…"
                      : "Mettre en rupture"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-success"
                    disabled={!selectedProduct || productActionLoading}
                    onClick={handleReopenProduct}
                  >
                    {productActionLoading && !productIsOut(selectedProduct)
                      ? "Mise à jour…"
                      : "Réouvrir le produit"}
                  </button>
                </div>

                {productsQuickLoading ? (
                  <LoadingState label="Chargement des produits…" size="sm" centered={false} className="small mt-3" />
                ) : null}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6 col-xl-4">
            <SectionCard
              title="Candidatures"
              subtitle="Vendeurs, fournisseurs et restaurants en attente de validation"
              icon={UserPlus}
              className="h-100"
            >
              <div className="d-flex align-items-end justify-content-between gap-2 mb-3">
                <div
                  className="fw-bold"
                  style={{ fontSize: "2rem", color: "#111111", lineHeight: 1 }}
                >
                  {pendingApplications ?? "—"}
                </div>
                <div className="text-muted small text-end">
                  candidature{(pendingApplications ?? 0) > 1 ? "s" : ""} en attente
                </div>
              </div>
              <Link to="/admin/candidatures" className="btn btn-sm btn-duu-orange w-100">
                Voir les candidatures
              </Link>
            </SectionCard>
          </div>
        </div>
      )}

      <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
        <div className="col-12 col-sm-6 col-xl-2">
          <KpiCard
            icon={Wallet}
            label="CA (aujourd'hui, hors livraison)"
            value={mad(kpi?.revenue_today)}
            sublabel="Sous-total produits des commandes DONE"
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <KpiCard
            icon={Wallet}
            label="CA (semaine, hors livraison)"
            value={mad(kpi?.revenue_week)}
            sublabel="Lun → aujourd’hui"
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <KpiCard
            icon={Wallet}
            label="CA (mois, hors livraison)"
            value={mad(kpi?.revenue_month)}
            sublabel="1 → aujourd’hui"
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <KpiCard
            icon={Wallet}
            label="CA (année, hors livraison)"
            value={mad(kpi?.revenue_year)}
            sublabel="01/01 → aujourd’hui"
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card h-100 border-0"
            style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
          >
            <div className="card-body p-3 p-sm-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="text-muted small">Commission Duumini</div>
                <span
                  className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--duu-radius-md)",
                    background: "rgba(var(--duu-green-rgb), .12)",
                    color: "var(--duu-green)",
                  }}
                >
                  <BadgePercent size={16} strokeWidth={2.2} />
                </span>
              </div>
              <select
                className="form-select form-select-sm mb-1"
                value={commissionFilter}
                onChange={(e) => setCommissionFilter(e.target.value as any)}
              >
                <option value="today">Aujourd’hui</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
              <div className="fw-bold text-truncate" style={{ color: "#111111", fontSize: "1.4rem" }}>
                {mad(commissionValue)}
              </div>
              <div className="text-muted small mt-1">{commissionLabel}</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <KpiCard
            icon={ShoppingBag}
            label="Cmd en attente"
            value={kpi?.orders_pending ?? 0}
            sublabel="OPEN + PREPARATION"
          />
        </div>

        {!isVendor && (
          <>
            <div className="col-12 col-sm-6 col-xl-2">
              <KpiCard
                icon={Package}
                label="Produits actifs"
                value={kpi?.products_active ?? 0}
                sublabel="Total catalogue"
                accent="neutral"
              />
            </div>

            <div className="col-12 col-sm-6 col-xl-2">
              <KpiCard
                icon={Store}
                label="Boutiques"
                value={kpi?.shops_total ?? 0}
                sublabel="Enregistrées"
                accent="neutral"
                to="/admin/shops"
              />
            </div>

            <div className="col-12 col-sm-6 col-xl-2">
              <KpiCard
                icon={Users}
                label="Utilisateurs"
                value={kpi?.users_total ?? 0}
                sublabel="Inscrits"
                accent="neutral"
                to="/admin/users"
              />
            </div>

            <div className="col-12 col-sm-6 col-xl-2">
              <KpiCard
                icon={BadgePercent}
                label="Affiliation (ce mois)"
                value={mad(affiliateSummary?.earnings ?? 0)}
                sublabel={
                  affiliateSummary
                    ? `${affiliateSummary.clicks} clics · ${affiliateSummary.orders} commandes`
                    : "Chargement…"
                }
                accent="green"
                to="/admin/affiliates"
              />
            </div>
          </>
        )}
      </div>

      <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
        <div className="col-12 col-lg-8">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
                <div className="d-flex flex-column">
                  <h2 className="h6 mb-0 text-truncate" style={{ color: "var(--duu-black)" }}>
                    Évolution du CA (30 jours, hors livraison)
                  </h2>
                  <span className="text-muted small text-truncate">
                    Sous-total produits des commandes DONE (sans frais de livraison)
                  </span>
                </div>
              </div>

              <div style={{ width: "100%", height: chartHeight, minHeight: 200 }}>
                {loading ? (
                  <div className="placeholder w-100 h-100 rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={series}
                      margin={{
                        top: isMobile ? 4 : 8,
                        right: isMobile ? 4 : 8,
                        left: 0,
                        bottom: isMobile ? 4 : 8,
                      }}
                    >
                      {!isMobile && <CartesianGrid strokeDasharray="3 3" />}
                      <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <YAxis
                        tickFormatter={(v) => `${Math.round((Number(v) || 0) / 1000)}k`}
                        tick={{ fontSize: isMobile ? 10 : 12 }}
                      />
                      <Tooltip formatter={(v: any) => [mad(Number(v)), "CA hors livraison"]} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        dot={false}
                        strokeWidth={2}
                        stroke="var(--duu-orange)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h2 className="h6 mb-2 text-truncate" style={{ color: "var(--duu-black)" }}>
                Commandes / jour
              </h2>

              <div style={{ width: "100%", height: chartHeight, minHeight: 200 }}>
                {loading ? (
                  <div className="placeholder w-100 h-100 rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={series}
                      margin={{
                        top: isMobile ? 4 : 8,
                        right: isMobile ? 4 : 8,
                        left: 0,
                        bottom: isMobile ? 4 : 8,
                      }}
                    >
                      {!isMobile && <CartesianGrid strokeDasharray="3 3" />}
                      <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="orders"
                        maxBarSize={isMobile ? 18 : 28}
                        fill="var(--duu-green)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-2 g-sm-3">
        <div className={`col-12 ${isVendor ? "" : "col-xxl-6"}`}>
          <SectionCard
            icon={ShoppingBag}
            title={isVendor ? "Mes dernières commandes" : "Dernières commandes"}
            right={
              <Link to="/admin/orders" className="btn btn-sm btn-duu-orange">
                Tout voir
              </Link>
            }
            className="h-100"
          >
              {!orders ? (
                <LoadingState size="sm" centered={false} className="small" />
              ) : orders.length === 0 ? (
                <div className="text-muted small">Aucune commande.</div>
              ) : (
                <div className="table-responsive" style={{ WebkitOverflowScrolling: "touch" }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead className="sticky-top bg-white">
                      <tr>
                        <th>#</th>
                        <th className="d-none d-sm-table-cell">Date</th>
                        <th>Statut</th>
                        <th className="text-end">Total (client)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={(o as any).id}>
                          <td className="text-truncate" style={{ maxWidth: 120 }}>
                            <Link to={`/admin/orders/${(o as any).id}`} className="link-dark">
                              {(o as any).id}
                            </Link>
                          </td>
                          <td className="d-none d-sm-table-cell">{shortDate((o as any).created_at)}</td>
                          <td>
                            <span className={`badge text-white ${statusClass(normStatus((o as any).status))}`}>
                              {normStatus((o as any).status)}
                            </span>
                          </td>
                          <td className="text-end">{mad(safeTotal(o as any))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="d-flex align-items-center justify-content-between mt-2">
                <div className="text-muted small">
                  {loading ? "Mise à jour…" : "Actualisé automatiquement (polling + SSE)"}
                </div>
                <button className="btn btn-sm btn-outline-dark" onClick={refresh} disabled={loading}>
                  Rafraîchir
                </button>
              </div>
          </SectionCard>
        </div>

        {!isVendor && (
          <>
            <div className="col-12 col-xxl-6">
              <SectionCard
                icon={Store}
                title="Boutiques récentes"
                right={
                  <Link to="/admin/shops" className="btn btn-sm btn-duu-orange">
                    Gérer
                  </Link>
                }
                className="h-100"
              >
                  {!shops ? (
                    <LoadingState size="sm" centered={false} className="small" />
                  ) : shops.length === 0 ? (
                    <div className="text-muted small">Aucune boutique.</div>
                  ) : (
                    <div className="table-responsive" style={{ WebkitOverflowScrolling: "touch" }}>
                      <table className="table table-sm align-middle mb-0">
                        <thead className="sticky-top bg-white">
                          <tr>
                            <th>Boutique</th>
                            <th className="d-none d-sm-table-cell">Créée le</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shops.map((s) => (
                            <tr key={(s as any).id}>
                              <td className="text-truncate" style={{ maxWidth: 240 }}>
                                <Link to={`/admin/shops/${(s as any).id}`} className="link-dark">
                                  {(s as any).name}
                                </Link>
                              </td>
                              <td className="d-none d-sm-table-cell">{shortDate((s as any).created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </SectionCard>
            </div>

            <div className="col-12">
              <SectionCard
                icon={Users}
                title="Derniers utilisateurs inscrits"
                right={
                  <Link to="/admin/users" className="btn btn-sm btn-duu-orange">
                    Gérer
                  </Link>
                }
                className="h-100"
              >
                  {!users ? (
                    <LoadingState size="sm" centered={false} className="small" />
                  ) : users.length === 0 ? (
                    <div className="text-muted small">Aucun utilisateur.</div>
                  ) : (
                    <div className="table-responsive" style={{ WebkitOverflowScrolling: "touch" }}>
                      <table className="table table-sm align-middle mb-0">
                        <thead className="sticky-top bg-white">
                          <tr>
                            <th>Utilisateur</th>
                            <th className="d-none d-md-table-cell">Téléphone</th>
                            <th className="d-none d-lg-table-cell">Rôle</th>
                            <th className="d-none d-sm-table-cell">Inscrit le</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={(u as any).id}>
                              <td className="text-truncate" style={{ maxWidth: 280 }}>
                                <Link to={`/admin/users/${(u as any).id}`} className="link-dark">
                                  {(u as any).first_name || (u as any).last_name
                                    ? `${(u as any).first_name ?? ""} ${(u as any).last_name ?? ""}`.trim()
                                    : (u as any).phone || `#${(u as any).id}`}
                                </Link>
                              </td>
                              <td className="d-none d-md-table-cell">{(u as any).phone}</td>
                              <td className="d-none d-lg-table-cell">
                                <span className="badge bg-light text-dark" style={{ borderRadius: 999 }}>
                                  {(u as any).role}
                                </span>
                              </td>
                              <td className="d-none d-sm-table-cell">{shortDate((u as any).created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </SectionCard>
            </div>
          </>
        )}
      </div>

      {error ? (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {error}
        </div>
      ) : null}

      <style>{`
        .card{
          border-radius: var(--duu-radius-lg);
        }
        .admin-kpi-link:hover .card{
          box-shadow: var(--duu-shadow-md) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}