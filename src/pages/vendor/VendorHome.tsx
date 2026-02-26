// src/pages/vendor/VendorHome.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { me, getAccessToken } from "../../services/auth";
import { listOrders, type Order } from "../../services/orders";
import { listProducts, type Product } from "../../services/products";
import { subscribeSSE, type ServerEvent } from "../../services/events";
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

type AnyObj = Record<string, any>;

type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
} & AnyObj;

function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "VENDOR" || r === "VENDEUR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE";
}

function mad(n?: number | null) {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(v);
}

function normStatus(s: any): string {
  return String(s || "").trim().toUpperCase();
}

// Sous-total produits (CA hors livraison)
function itemsAmount(o: AnyObj): number {
  const totals = o?.totals;
  if (totals && typeof totals.items_amount === "number" && !isNaN(totals.items_amount)) {
    return Number(totals.items_amount);
  }
  if (Array.isArray(o?.items) && o.items.length > 0) {
    return o.items.reduce((sum: number, it: AnyObj) => {
      const unit = Number(it.unit_price ?? it.price ?? 0);
      const qty = Number(it.qty ?? 1);
      return sum + unit * qty;
    }, 0);
  }
  const total = Number(o?.total ?? o?.totals?.amount ?? 0) || 0;
  const fee = Number(totals?.delivery_fee ?? o?.delivery_fee ?? o?.delivery?.fee ?? 0) || 0;
  return Math.max(0, total - fee);
}

// Commission Duumini (DONE uniquement)
function duuCommissionDone(o: AnyObj): number {
  if (normStatus(o?.status) !== "DONE") return 0;
  const raw =
    o?.commission_duumini ??
    o?.totals?.duumini_amount ??
    o?.duumini_commission ??
    o?.commission ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ====== Filtrage “commande appartient au vendeur” ====== */
function orderBelongsToUser(order: AnyObj, user: CurrentUser | null): boolean {
  if (!user) return false;
  if (!isVendorRole(user.role)) return true;

  const uid = Number(user.id ?? user.vendor_id ?? 0) || 0;
  const myShop = user.shop_id != null ? Number(user.shop_id) : null;

  const oVendor = order?.vendor_id ?? order?.vendorId ?? order?.seller_id ?? order?.sellerId ?? null;
  const oShop = order?.shop_id ?? order?.shopId ?? order?.store_id ?? order?.storeId ?? null;

  if (oVendor != null && uid && Number(oVendor) === uid) return true;
  if (myShop != null && oShop != null && Number(oShop) === Number(myShop)) return true;

  const items: AnyObj[] = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.order_items)
      ? order.order_items
      : Array.isArray(order?.lines)
        ? order.lines
        : [];

  for (const it of items) {
    const itShop = it?.shop_id ?? it?.shopId ?? it?.store_id ?? it?.storeId ?? null;
    const itVendor = it?.vendor_id ?? it?.vendorId ?? it?.seller_id ?? it?.sellerId ?? null;
    if (itVendor != null && uid && Number(itVendor) === uid) return true;
    if (myShop != null && itShop != null && Number(itShop) === Number(myShop)) return true;
  }

  return false;
}

/* ======= TZ helpers (Africa/Casablanca) ======= */
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
function doneDate(o: AnyObj): Date | null {
  if (normStatus(o?.status) !== "DONE") return null;
  const iso = o?.done_at ?? o?.completed_at ?? o?.delivered_at ?? o?.updated_at ?? o?.created_at;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function doneKey(o: AnyObj, tz = "Africa/Casablanca"): string | null {
  const d = doneDate(o);
  return d ? dateKeyTZ(d, tz) : null;
}

type SalesPoint = { date: string; revenue: number; orders: number };

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

type Summary = {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  revenue_year: number;

  duumini_commission_today: number;
  duumini_commission_week: number;
  duumini_commission_month: number;
  duumini_commission_year: number;

  orders_pending: number;
  products_count: number;

  sales_series: SalesPoint[];
  last_orders: Order[];
};

async function fetchManyOrders(params: AnyObj) {
  const maxPages = 20;
  const pageSize = 200;
  const all: Order[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await listOrders({ page, pageSize, ...params } as any);
    const items: Order[] = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

async function fetchManyProducts() {
  const maxPages = 20;
  const pageSize = 200;
  const all: Product[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await listProducts({ page, pageSize } as any);
    const items: Product[] = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

function productBelongsToUser(p: AnyObj, user: CurrentUser | null) {
  if (!user) return false;
  if (!isVendorRole(user.role)) return true;

  const uid = Number(user.id ?? user.vendor_id ?? 0) || 0;
  const myShop = user.shop_id != null ? Number(user.shop_id) : null;

  const pVendor = p?.vendor_id ?? p?.vendorId ?? p?.seller_id ?? p?.sellerId ?? null;
  const pShop = p?.shop_id ?? p?.shopId ?? p?.store_id ?? p?.storeId ?? null;

  if (pVendor != null && uid && Number(pVendor) === uid) return true;
  if (myShop != null && pShop != null && Number(pShop) === Number(myShop)) return true;

  return false;
}

async function buildVendorSummary(user: CurrentUser): Promise<Summary> {
  const [doneAll, openAll, prepAll, delivAll, productsAll] = await Promise.all([
    fetchManyOrders({ status: "DONE" }),
    fetchManyOrders({ status: "OPEN" }),
    fetchManyOrders({ status: "PREPARATION" }),
    fetchManyOrders({ status: "DELIVERY" }),
    fetchManyProducts(),
  ]);

  const doneMine = doneAll.filter((o) => orderBelongsToUser(o as AnyObj, user));
  const openMine = openAll.filter((o) => orderBelongsToUser(o as AnyObj, user));
  const prepMine = prepAll.filter((o) => orderBelongsToUser(o as AnyObj, user));
  const delivMine = delivAll.filter((o) => orderBelongsToUser(o as AnyObj, user));
  const productsMine = productsAll.filter((p) => productBelongsToUser(p as AnyObj, user));

  const TZ = "Africa/Casablanca";
  const today = new Date();
  const todayKey = dateKeyTZ(today, TZ);

  const weekKeys = new Set<string>();
  {
    const t = new Date(today);
    for (let i = 0; i < 7; i++) {
      const d = new Date(t);
      d.setDate(t.getDate() - i);
      const wd = new Intl.DateTimeFormat("fr-MA", { timeZone: TZ, weekday: "long" })
        .format(d)
        .toLowerCase();
      if (wd === "lundi") {
        const start = new Date(d);
        for (let j = 0; j < 7; j++) {
          const x = new Date(start);
          x.setDate(start.getDate() + j);
          const key = dateKeyTZ(x, TZ);
          weekKeys.add(key);
          if (key === todayKey) break;
        }
        break;
      }
    }
  }

  const monthKeys = new Set<string>();
  {
    const start = new Date(today);
    start.setDate(1);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      monthKeys.add(dateKeyTZ(d, TZ));
    }
  }

  const yearKeys = new Set<string>();
  {
    const start = new Date(today.getFullYear(), 0, 1);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      yearKeys.add(dateKeyTZ(d, TZ));
    }
  }

  let revenue_today = 0,
    revenue_week = 0,
    revenue_month = 0,
    revenue_year = 0;
  let duu_today = 0,
    duu_week = 0,
    duu_month = 0,
    duu_year = 0;

  for (const o of doneMine) {
    const key = doneKey(o as AnyObj, TZ);
    if (!key) continue;

    const amt = itemsAmount(o as AnyObj);
    const com = duuCommissionDone(o as AnyObj);

    if (key === todayKey) {
      revenue_today += amt;
      duu_today += com;
    }
    if (weekKeys.has(key)) {
      revenue_week += amt;
      duu_week += com;
    }
    if (monthKeys.has(key)) {
      revenue_month += amt;
      duu_month += com;
    }
    if (yearKeys.has(key)) {
      revenue_year += amt;
      duu_year += com;
    }
  }

  const orders_pending = openMine.length + prepMine.length + delivMine.length;

  const days = 30;
  const map = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(dateKeyTZ(d, TZ), { revenue: 0, orders: 0 });
  }
  for (const o of doneMine) {
    const key = doneKey(o as AnyObj, TZ);
    if (!key) continue;
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += itemsAmount(o as AnyObj);
  }
  const sales_series: SalesPoint[] = Array.from(map.entries()).map(([k, v]) => ({
    date: k.slice(5),
    revenue: v.revenue,
    orders: v.orders,
  }));

  const lastAll = [...openMine, ...prepMine, ...delivMine, ...doneMine].sort((a: any, b: any) => {
    const da = new Date(a?.created_at ?? a?.updated_at ?? 0).getTime();
    const db = new Date(b?.created_at ?? b?.updated_at ?? 0).getTime();
    return db - da;
  });

  return {
    revenue_today,
    revenue_week,
    revenue_month,
    revenue_year,
    duumini_commission_today: duu_today,
    duumini_commission_week: duu_week,
    duumini_commission_month: duu_month,
    duumini_commission_year: duu_year,
    orders_pending,
    products_count: productsMine.length,
    sales_series,
    last_orders: lastAll.slice(0, 8),
  };
}

function statusClass(s: string) {
  const st = String(s || "").toUpperCase();
  if (st === "DONE") return "bg-success";
  if (st === "CANCELLED") return "bg-danger";
  if (st === "DELIVERY") return "bg-primary";
  if (st === "PREPARATION") return "bg-warning text-dark";
  return "bg-secondary";
}

export default function VendorHome() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<Summary | null>(null);

  const chartHeight = useChartHeight();
  const isMobile = useIsMobile(576);

  const refreshingRef = useRef(false);
  const visibleRef = useRef(true);
  const sseRef = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = (await me()) as any;
        if (!mounted) return;
        setUser(u || null);
      } catch {
        if (!mounted) return;
        setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const sum = await buildVendorSummary(user);
      setKpi(sum);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement du dashboard vendeur.");
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  useEffect(() => {
    const onVis = () => (visibleRef.current = document.visibilityState === "visible");
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

  // ✅ Protection : si pas vendeur → accueil (pas /admin)
  if (user && !isVendor) return <Navigate to="/" replace />;

  const series = useMemo(() => kpi?.sales_series || [], [kpi]);

  return (
    <div className="container-xxl py-0 px-2 px-sm-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h5 m-0">Espace vendeur</h1>
          <div className="text-muted small">Vos chiffres & activités (polling + SSE)</div>
        </div>

        <div className="d-flex gap-2">
          <Link to="/ma-boutique" className="btn btn-duu">
            Ma boutique
          </Link>

          {/* ✅ plus de lien admin */}
          <Link to="/vendeur/commandes" className="btn btn-outline-dark">
            Mes commandes
          </Link>

          <button className="btn btn-outline-dark" onClick={refresh} disabled={loading || !user}>
            Rafraîchir
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">CA aujourd’hui (DONE, hors livraison)</div>
              <div className="fs-5 fw-semibold text-truncate" style={{ color: "var(--duu-black)" }}>
                {mad(kpi?.revenue_today)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">CA semaine (DONE, hors livraison)</div>
              <div className="fs-5 fw-semibold text-truncate" style={{ color: "var(--duu-black)" }}>
                {mad(kpi?.revenue_week)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">Commission Duumini (mois, DONE)</div>
              <div className="fs-5 fw-semibold text-truncate" style={{ color: "var(--duu-black)" }}>
                {mad(kpi?.duumini_commission_month)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">En cours (OPEN+PREP+DELIVERY)</div>
              <div className="fs-5 fw-semibold text-truncate" style={{ color: "var(--duu-black)" }}>
                {kpi?.orders_pending ?? 0}
              </div>
              <div className="text-muted small">Produits: {kpi?.products_count ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-2 g-sm-3 mb-3 mb-sm-4">
        <div className="col-12 col-lg-8">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h2 className="h6 mb-2" style={{ color: "var(--duu-black)" }}>
                Évolution du CA (30 jours, DONE, hors livraison)
              </h2>

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
                      <Tooltip formatter={(v: any) => [mad(Number(v)), "CA"]} />
                      <Line type="monotone" dataKey="revenue" dot={false} strokeWidth={2} />
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
              <h2 className="h6 mb-2" style={{ color: "var(--duu-black)" }}>
                Commandes DONE / jour
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
                      <Bar dataKey="orders" maxBarSize={isMobile ? 18 : 28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
            <h2 className="h6 mb-0" style={{ color: "var(--duu-black)" }}>
              Dernières commandes (votre boutique)
            </h2>

            {/* ✅ plus de lien admin */}
            <Link to="/vendeur/commandes" className="btn btn-sm btn-duu w-100 w-sm-auto">
              Tout voir
            </Link>
          </div>

          {!kpi ? (
            <div className="text-muted small">Chargement…</div>
          ) : kpi.last_orders.length === 0 ? (
            <div className="text-muted small">Aucune commande.</div>
          ) : (
            <div className="table-responsive" style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="table table-sm align-middle mb-0">
                <thead className="sticky-top bg-white">
                  <tr>
                    <th>#</th>
                    <th className="d-none d-sm-table-cell">Date</th>
                    <th>Statut</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi.last_orders.map((o: any) => (
                    <tr key={o.id}>
                      <td className="text-truncate" style={{ maxWidth: 120 }}>
                        {/* ✅ pas de détail admin ici, juste renvoi vers page commandes vendeur */}
                        <Link to="/vendeur/commandes" className="link-dark">
                          {o.id}
                        </Link>
                      </td>
                      <td className="d-none d-sm-table-cell">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </td>
                      <td>
                        <span className={`badge text-white ${statusClass(normStatus(o.status))}`}>
                          {normStatus(o.status)}
                        </span>
                      </td>
                      <td className="text-end">{mad(Number(o.total ?? o.totals?.amount ?? 0) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-muted small mt-2">
            {loading ? "Mise à jour…" : "Actualisé automatiquement (polling + SSE)"}
          </div>
        </div>
      </div>

      <style>{`
        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
        }
        .btn-duu:hover{ filter: brightness(0.95); }
      `}</style>
    </div>
  );
}