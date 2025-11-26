// src/pages/AdminHome.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { listOrders, type Order } from "../services/orders";
import { listProducts } from "../services/products";
import { listShops, type Shop } from "../services/shops";
import { listUsers, type User } from "../services/users";
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
import { getAccessToken } from "../services/auth";

export type SalesPoint = { date: string; revenue: number; orders: number };

/* ======= Utils ======= */
function mad(n?: number | null) {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(v);
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
  return (
    res?.pageInfo?.total ??
    res?.total ??
    (Array.isArray(res?.items) ? res.items.length : 0) ??
    0
  );
}

/**
 * Sous-total des produits (CA hors livraison) pour une commande.
 * Priorité :
 * - totals.items_amount (backend)
 * - somme des lignes items (unit_price/price * qty)
 * - fallback : total - frais de livraison (si dispo)
 */
function itemsAmount(o: any): number {
  const anyO = o as any;
  const totals = anyO.totals;

  // 1) Backend fournit directement le sous-total
  if (
    totals &&
    typeof totals.items_amount === "number" &&
    !isNaN(totals.items_amount)
  ) {
    return Number(totals.items_amount);
  }

  // 2) Recalcul via les lignes d'articles
  if (Array.isArray(anyO.items) && anyO.items.length > 0) {
    return anyO.items.reduce((sum: number, it: any) => {
      const unit = Number(it.unit_price ?? it.price ?? 0);
      const qty = Number(it.qty ?? 1);
      return sum + unit * qty;
    }, 0);
  }

  // 3) Fallback : total - frais de livraison éventuels
  const total = safeTotal(anyO);
  const feeCandidates = [
    totals?.delivery_fee,
    anyO.delivery_fee,
    anyO.delivery?.fee,
  ];
  const feeRaw =
    feeCandidates.find((x: any) => typeof x === "number") ??
    Number(feeCandidates.find((x: any) => x != null));
  const fee = Number.isFinite(feeRaw) ? Number(feeRaw) : 0;

  const items = total - fee;
  return items > 0 ? items : 0;
}

/* ======= Hauteur responsive pour Recharts ======= */
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

/* ======= Flag mobile (pour micro-ajustements d'affichage) ======= */
function useIsMobile(breakpoint = 576) {
  const pick = () =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false;
  const [m, setM] = useState<boolean>(pick);
  useEffect(() => {
    const onR = () => setM(pick());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [breakpoint]);
  return m;
}

/* ======= Outils dates TZ (Africa/Casablanca) ======= */
// "YYYY-MM-DD" local TZ
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
  return new Intl.DateTimeFormat("fr-MA", { timeZone, weekday: "long" })
    .format(d)
    .toLowerCase();
}
function getStartOfWeekTZ(today: Date, timeZone = "Africa/Casablanca") {
  // Semaine: lundi -> dimanche (FR)
  const t = new Date(today);
  for (let i = 0; i < 7; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    if (weekdayNameTZ(d, timeZone) === "lundi") {
      return d;
    }
  }
  return new Date(today); // fallback
}
function getStartOfMonthTZ(today: Date, _timeZone = "Africa/Casablanca") {
  // 1er jour du mois courant
  const d = new Date(today);
  d.setDate(1);
  return d;
}

/* ======= 🔁 Helpers DONE date ======= */
// Retourne la date effective de comptabilisation (date de DONE).
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

/* ======= Résumé (KPIs + séries) ======= */
type Summary = {
  // ⚠️ Ces CA sont HORS frais de livraison (sous-total produits)
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  revenue_year: number;

  // Commissions Duumini (MAD) pour commandes DONE
  duumini_commission_today: number;
  duumini_commission_week: number;
  duumini_commission_month: number;
  duumini_commission_year: number;

  orders_pending: number;
  products_active: number;
  shops_total: number;
  users_total: number;
  sales_series: SalesPoint[];
};

/** Pagination front pour charger suffisamment de commandes afin d’agréger jour/semaine/mois. */
async function fetchOrdersPaginatedForAggregation() {
  const maxPages = 20;
  const pageSize = 200;
  const all: Order[] = [];

  for (let page = 1; page <= maxPages; page++) {
    // 🔥 On demande explicitement les commandes DONE
    const res = await listOrders({ page, pageSize, status: "DONE" } as any);
    const items: Order[] = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

async function buildSummary(): Promise<Summary> {
  // 1) Pages courtes pour totaux entités
  const [productsRes, shopsRes, usersRes] = await Promise.all([
    listProducts({ page: 1, pageSize: 1 }),
    listShops({ page: 1, pageSize: 1 }),
    listUsers({ page: 1, pageSize: 1 }),
  ]);

  // 2) Chargement paginé pour l’agrégation (uniquement DONE côté backend)
  const ordersAll: Order[] = await fetchOrdersPaginatedForAggregation();

  const TZ = "Africa/Casablanca";
  const today = new Date();
  const todayKey = dateKeyTZ(today, TZ);

  // Semaine (lundi → aujourd’hui)
  const startWeek = getStartOfWeekTZ(today, TZ);
  const weekKeys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(startWeek);
    d.setDate(startWeek.getDate() + i);
    const key = dateKeyTZ(d, TZ);
    weekKeys.add(key);
    if (key === todayKey) break;
  }

  // Mois (1er → aujourd’hui)
  const startMonth = getStartOfMonthTZ(today, TZ);
  const monthKeys = new Set<string>();
  for (let d = new Date(startMonth); d <= today; d.setDate(d.getDate() + 1)) {
    monthKeys.add(dateKeyTZ(d, TZ));
  }

  // Année (01/01 → aujourd’hui)
  const startYear = new Date(today.getFullYear(), 0, 1);
  const yearKeys = new Set<string>();
  for (let d = new Date(startYear); d <= today; d.setDate(d.getDate() + 1)) {
    yearKeys.add(dateKeyTZ(d, TZ));
  }

  let revenue_today = 0;
  let revenue_week = 0;
  let revenue_month = 0;
  let revenue_year = 0;

  let duumini_today = 0;
  let duumini_week = 0;
  let duumini_month = 0;
  let duumini_year = 0;

  // Comptabiliser par date de DONE
  for (const o of ordersAll) {
    // ⚠️ Sécurité : on ne garde que les DONE
    if (normStatus((o as any)?.status) !== "DONE") continue;

    const key = doneKey(o, TZ);
    if (!key) continue;

    // 💰 Sous-total produits (CA hors livraison)
    const amount = itemsAmount(o as any);

    // 💸 Commission Duumini (MAD) stockée sur la commande (plusieurs noms possibles)
    const commissionRaw =
      (o as any).commission_duumini ??
      (o as any).duumini_commission ??
      (o as any).commission ??
      0;
    const commission = Number(commissionRaw) || 0;

    if (key === todayKey) {
      revenue_today += amount;
      duumini_today += commission;
    }
    if (weekKeys.has(key)) {
      revenue_week += amount;
      duumini_week += commission;
    }
    if (monthKeys.has(key)) {
      revenue_month += amount;
      duumini_month += commission;
    }
    if (yearKeys.has(key)) {
      revenue_year += amount;
      duumini_year += commission;
    }
  }

  // 🔹 Nombre de commandes encore en attente (OPEN + PREPARATION)
  const [openRes, prepRes] = await Promise.all([
    listOrders({ page: 1, pageSize: 1, status: "OPEN" } as any),
    listOrders({ page: 1, pageSize: 1, status: "PREPARATION" } as any),
  ]);
  const orders_pending =
    readTotalFromPaged(openRes) + readTotalFromPaged(prepRes);

  const products_active = readTotalFromPaged(productsRes);
  const shops_total = readTotalFromPaged(shopsRes);
  const users_total = readTotalFromPaged(usersRes);

  // Séries 30 jours (CA hors livraison + nb cmd / jour), toujours sur DONE
  const days = 30;
  const map = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(dateKeyTZ(d, TZ), { revenue: 0, orders: 0 });
  }
  for (const o of ordersAll) {
    if (normStatus((o as any)?.status) !== "DONE") continue;
    const key = doneKey(o, TZ);
    if (!key) continue;
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += itemsAmount(o as any); // 🔥 CA sans livraison
  }
  const sales_series: SalesPoint[] = Array.from(map.entries()).map(
    ([k, v]) => ({
      date: k.slice(5), // "MM-DD"
      revenue: v.revenue,
      orders: v.orders,
    })
  );

  return {
    revenue_today,
    revenue_week,
    revenue_month,
    revenue_year,
    duumini_commission_today: duumini_today,
    duumini_commission_week: duumini_week,
    duumini_commission_month: duumini_month,
    duumini_commission_year: duumini_year,
    orders_pending,
    products_active,
    shops_total,
    users_total,
    sales_series,
  };
}

/* ======= Composant ======= */
export default function AdminHome() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<Summary | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [commissionFilter, setCommissionFilter] = useState<
    "today" | "week" | "month" | "year"
  >("today");

  const chartHeight = useChartHeight();
  const isMobile = useIsMobile(576);

  const refreshingRef = useRef(false);
  const visibleRef = useRef<boolean>(true);
  const sseRef = useRef<{ close(): void } | null>(null);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        (async () => ({
          kind: "sum" as const,
          val: await buildSummary(),
        }))(),
        (async () => ({
          kind: "orders" as const,
          val: await listOrders({ page: 1, pageSize: 6 }),
        }))(),
        (async () => ({
          kind: "shops" as const,
          val: await listShops({ page: 1, pageSize: 6 }),
        }))(),
        (async () => ({
          kind: "users" as const,
          val: await listUsers({ page: 1, pageSize: 6 }),
        }))(),
      ]);

      let sum: Summary = {
        revenue_today: 0,
        revenue_week: 0,
        revenue_month: 0,
        revenue_year: 0,
        duumini_commission_today: 0,
        duumini_commission_week: 0,
        duumini_commission_month: 0,
        duumini_commission_year: 0,
        orders_pending: 0,
        products_active: 0,
        shops_total: 0,
        users_total: 0,
        sales_series: [],
      };
      let oItems: Order[] | null = null;
      let sItems: Shop[] | null = null;
      let uItems: User[] | null = null;
      let firstErr: string | null = null;

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { kind, val } = (r as any).value as any;
          if (kind === "sum") sum = val as Summary;
          if (kind === "orders")
            oItems = Array.isArray(val?.items) ? val.items : [];
          if (kind === "shops")
            sItems = Array.isArray(val?.items) ? val.items : [];
          if (kind === "users")
            uItems = Array.isArray(val?.items) ? val.items : [];
        } else {
          firstErr ||=
            (r as any).reason?.message ||
            String((r as any).reason) ||
            null;
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
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling (15s) tant que l’onglet est visible
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

  // SSE : rafraîchir à la volée sur ORDER_CREATED / ORDER_STATUS
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      console.warn("[AdminHome] pas de token → pas de SSE admin");
      return;
    }

    const API_BASE = import.meta.env.VITE_API_BASE as string;
    const base = API_BASE.replace(/\/$/, "");
    const url = `${base}/api/events/stream?access_token=${encodeURIComponent(
      token
    )}`;

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

  return (
    <div className="container-xxl py-0 px-2 px-sm-3">
      {/* Barre d’actions */}
      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
        <div className="text-muted small">
          Dernière mise à jour&nbsp;
          {lastUpdate ? lastUpdate.toLocaleTimeString("fr-FR") : "—"}
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => refresh()}
            disabled={loading}
          >
            {loading ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
        {/* CA aujourd'hui (hors livraison) */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">
                CA (aujourd&apos;hui, hors livraison)
              </div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {mad(kpi?.revenue_today)}
              </div>
              <div className="text-muted small">
                Sous-total produits des commandes DONE
              </div>
            </div>
          </div>
        </div>
        {/* CA semaine (hors livraison) */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">CA (semaine, hors livraison)</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {mad(kpi?.revenue_week)}
              </div>
              <div className="text-muted small">Lun → aujourd’hui</div>
            </div>
          </div>
        </div>
        {/* CA mois (hors livraison) */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">CA (mois, hors livraison)</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {mad(kpi?.revenue_month)}
              </div>
              <div className="text-muted small">1 → aujourd’hui</div>
            </div>
          </div>
        </div>
        {/* CA année (hors livraison) */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">CA (année, hors livraison)</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {mad(kpi?.revenue_year)}
              </div>
              <div className="text-muted small">01/01 → aujourd’hui</div>
            </div>
          </div>
        </div>
        {/* Commission Duumini avec filtre actif */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small mb-1">Commission Duumini</div>
              <select
                className="form-select form-select-sm mb-1"
                value={commissionFilter}
                onChange={(e) =>
                  setCommissionFilter(
                    e.target.value as "today" | "week" | "month" | "year"
                  )
                }
              >
                <option value="today">Aujourd’hui</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {mad(commissionValue)}
              </div>
              <div className="text-muted small">{commissionLabel}</div>
            </div>
          </div>
        </div>
        {/* Cmd en attente */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">Cmd en attente</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {kpi?.orders_pending ?? 0}
              </div>
              <div className="text-muted small">OPEN + PREPARATION</div>
            </div>
          </div>
        </div>
        {/* Produits */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">Produits actifs</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {kpi?.products_active ?? 0}
              </div>
              <div className="text-muted small">Total catalogue</div>
            </div>
          </div>
        </div>
        {/* Boutiques */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">Boutiques</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {kpi?.shops_total ?? 0}
              </div>
              <div className="text-muted small">Enregistrées</div>
            </div>
          </div>
        </div>
        {/* Utilisateurs */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3 py-sm-3">
              <div className="text-muted small">Utilisateurs</div>
              <div className="fs-5 fs-sm-4 fw-semibold text-truncate">
                {kpi?.users_total ?? 0}
              </div>
              <div className="text-muted small">Inscrits</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
        <div className="col-12 col-lg-8">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
                <h2 className="h6 mb-0 text-truncate">
                  Évolution du CA (30 jours, hors livraison)
                </h2>
                <span className="text-muted small text-truncate">
                  Sous-total produits des commandes DONE (sans frais de
                  livraison)
                </span>
              </div>
              <div
                style={{ width: "100%", height: chartHeight, minHeight: 200 }}
              >
                {loading ? (
                  <div
                    className="placeholder-glow w-100 h-100 rounded"
                    style={{ background: "#eee" }}
                  />
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
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: isMobile ? 10 : 12 }}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          `${Math.round((Number(v) || 0) / 1000)}k`
                        }
                        tick={{ fontSize: isMobile ? 10 : 12 }}
                      />
                      <Tooltip
                        formatter={(v: any) => [mad(Number(v)), "CA hors livraison"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        dot={false}
                        strokeWidth={2}
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
              <h2 className="h6 mb-2 text-truncate">Commandes / jour</h2>
              <div
                style={{ width: "100%", height: chartHeight, minHeight: 200 }}
              >
                {loading ? (
                  <div
                    className="placeholder-glow w-100 h-100 rounded"
                    style={{ background: "#eee" }}
                  />
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
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: isMobile ? 10 : 12 }}
                      />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <Tooltip />
                      <Bar dataKey="orders" maxBarSize={isMobile ? 18 : 28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="row g-2 g-sm-3">
        {/* Commandes */}
        <div className="col-12 col-xxl-6">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
                <h2 className="h6 mb-0 text-truncate">Dernières commandes</h2>
                <Link
                  to="/admin/orders"
                  className="btn btn-sm btn-outline-dark w-100 w-sm-auto"
                >
                  Tout voir
                </Link>
              </div>

              {!orders ? (
                <div className="text-muted small">Chargement…</div>
              ) : orders.length === 0 ? (
                <div className="text-muted small">Aucune commande.</div>
              ) : (
                <div
                  className="table-responsive"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
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
                          <td
                            className="text-truncate"
                            style={{ maxWidth: 120 }}
                          >
                            <Link
                              to={`/admin/orders/${(o as any).id}`}
                              className="link-dark"
                            >
                              {(o as any).id}
                            </Link>
                          </td>
                          <td className="d-none d-sm-table-cell">
                            {shortDate((o as any).created_at)}
                          </td>
                          <td>
                            <span className="badge bg-secondary">
                              {normStatus((o as any).status)}
                            </span>
                          </td>
                          <td className="text-end">
                            {/* Ici on garde le total payé par le client (avec livraison) */}
                            {mad(safeTotal(o as any))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Boutiques */}
        <div className="col-12 col-xxl-6">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
                <h2 className="h6 mb-0 text-truncate">Boutiques récentes</h2>
                <Link
                  to="/admin/shops"
                  className="btn btn-sm btn-outline-dark w-100 w-sm-auto"
                >
                  Gérer
                </Link>
              </div>

              {!shops ? (
                <div className="text-muted small">Chargement…</div>
              ) : shops.length === 0 ? (
                <div className="text-muted small">Aucune boutique.</div>
              ) : (
                <div
                  className="table-responsive"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
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
                          <td
                            className="text-truncate"
                            style={{ maxWidth: 240 }}
                          >
                            <Link
                              to={`/admin/shops/${(s as any).id}`}
                              className="link-dark"
                            >
                              {(s as any).name}
                            </Link>
                          </td>
                          <td className="d-none d-sm-table-cell">
                            {shortDate((s as any).created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Utilisateurs */}
        <div className="col-12">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
                <h2 className="h6 mb-0 text-truncate">
                  Derniers utilisateurs inscrits
                </h2>
                <Link
                  to="/admin/users"
                  className="btn btn-sm btn-outline-dark w-100 w-sm-auto"
                >
                  Gérer
                </Link>
              </div>

              {!users ? (
                <div className="text-muted small">Chargement…</div>
              ) : users.length === 0 ? (
                <div className="text-muted small">Aucun utilisateur.</div>
              ) : (
                <div
                  className="table-responsive"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
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
                          <td
                            className="text-truncate"
                            style={{ maxWidth: 280 }}
                          >
                            <Link
                              to={`/admin/users/${(u as any).id}`}
                              className="link-dark"
                            >
                              {((u as any).first_name || (u as any).last_name
                                ? `${(u as any).first_name ?? ""} ${
                                    (u as any).last_name ?? ""
                                  }`.trim()
                                : (u as any).phone || `#${(u as any).id}`)}
                            </Link>
                          </td>
                          <td className="d-none d-md-table-cell">
                            {(u as any).phone}
                          </td>
                          <td className="d-none d-lg-table-cell">
                            <span className="badge bg-secondary">
                              {(u as any).role}
                            </span>
                          </td>
                          <td className="d-none d-sm-table-cell">
                            {shortDate((u as any).created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
