// src/pages/admin/OrdersAdminPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import {
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderPayment,
  type Order,
  type OrderStatus,
} from "../../services/orders";

import { subscribeSSE, type ServerEvent } from "../../services/events";
import { me } from "../../services/auth";

import OrdersStatsCards from "../../components/ordersAdmin/OrdersStatsCards";
import OrdersFiltersBar from "../../components/ordersAdmin/OrdersFiltersBar";
import OrdersTable from "../../components/ordersAdmin/OrdersTable";
import TopCustomersTab from "../../components/ordersAdmin/TopCustomersTab";
import EditStatusModal from "../../components/ordersAdmin/EditStatusModal";
import OrderViewModal from "../../components/ordersAdmin/OrderViewModal";
import PosSaleModal from "../../components/ordersAdmin/PosSaleModal";
import AdminOrderForClientModal from "../../components/ordersAdmin/AdminOrderForClientModal";

import { PageHeader } from "../../components/admin/adminUI";

import type {
  AnyObj,
  CurrentUser,
  PayStatus,
} from "../../components/ordersAdmin/orderUtils";

import {
  computeOrderAmounts,
  getPaymentFromOrder,
  getOrderDisplayCode,
  isVendorRole,
  numSafe,
  waHref,
} from "../../components/ordersAdmin/orderUtils";

function normalizeTxt(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function OrdersAdminPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  const [items, setItems] = useState<Order[]>([]);
  const [vendorAll, setVendorAll] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [payFilter, setPayFilter] = useState<"ALL" | PayStatus>("ALL");

  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  const [viewId, setViewId] = useState<number | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [viewStatus, setViewStatus] = useState<OrderStatus>("OPEN");
  const [viewSaving, setViewSaving] = useState(false);

  const [payEditMode, setPayEditMode] = useState<"SET" | "ADD">("ADD");
  const [payInput, setPayInput] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>("CASH");
  const [payNote, setPayNote] = useState<string>("");
  const [paySaving, setPaySaving] = useState(false);

  const [openPos, setOpenPos] = useState(false);
  const [openAdminOrder, setOpenAdminOrder] = useState(false);

  const [activeTab, setActiveTab] = useState<"orders" | "top-customers">("orders");

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

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQDebounced(q.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      if (isVendor) {
        const res = await listOrders({
          page: 1,
          pageSize: 500,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(payFilter !== "ALL" ? { payment_status: payFilter } : {}),
          ...(qDebounced ? { q: qDebounced } : {}),
        } as any);

        // ✅ Le backend scope déjà cette liste à la boutique du vendeur
        // connecté (voir GET /api/orders, branche isVendor) — pas de
        // re-filtrage client nécessaire.
        const mine = (res.items || []) as Order[];

        setVendorAll(mine);
        setTotal(mine.length);
        setItems([]);
        setError(null);
        return;
      }

      const res = await listOrders({
        page,
        pageSize,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(payFilter !== "ALL" ? { payment_status: payFilter } : {}),
        ...(qDebounced ? { q: qDebounced } : {}),
      } as any);

      setItems(res.items || []);
      setTotal(Number(res.pageInfo?.total || 0));
      setVendorAll([]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, payFilter, qDebounced, isVendor]);

  useEffect(() => {
    if (isVendor) setPage(1);
  }, [isVendor, statusFilter, payFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = subscribeSSE("/api/events/stream", (evt: ServerEvent) => {
      if (evt.type === "ORDER_CREATED" || evt.type === "ORDER_STATUS") {
        refresh();

        // @ts-ignore
        window?.duuminiToast?.({
          title:
            evt.payload?.title ||
            (evt.type === "ORDER_CREATED"
              ? "Nouvelle commande"
              : "Commande mise à jour"),
          message: evt.payload?.body || "",
        });
      }
    });

    return () => sub.close();
  }, [refresh]);

  const dateTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("fr-FR") : "";

  const dataset = useMemo(() => {
    if (isVendor) return vendorAll;
    return items;
  }, [isVendor, vendorAll, items]);

  const searched = useMemo(() => {
    return dataset.filter((o) => {
      if (!q.trim()) return true;

      const txt = q.toLowerCase();
      const contact = (o as any)?.contact || (o as any)?.user || {};
      const contactName =
        `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();

      return (
        String(o.id).toLowerCase().includes(txt) ||
        (o.status?.toLowerCase() || "").includes(txt) ||
        contactName.toLowerCase().includes(txt) ||
        normalizeTxt(contact?.phone).includes(txt) ||
        normalizeTxt((o as any)?.affiliate_code).includes(txt) ||
        normalizeTxt((o as any)?.affiliate_name).includes(txt)
      );
    });
  }, [dataset, q]);

  const displayed = useMemo(() => {
    if (!isVendor) return searched;

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return searched.slice(start, end);
  }, [searched, isVendor, page, pageSize]);

  const effectiveTotal = useMemo(
    () => (isVendor ? searched.length : total),
    [isVendor, searched.length, total],
  );

  const effectivePages = useMemo(
    () => Math.max(1, Math.ceil(effectiveTotal / pageSize)),
    [effectiveTotal, pageSize],
  );

  const globalStats = useMemo(() => {
    let caNet = 0;
    let caDelivery = 0;
    let caDuumini = 0;

    const statsSource = isVendor ? displayed : items;

    statsSource.forEach((o) => {
      const st = String((o as AnyObj)?.status || "").toUpperCase();
      const { itemsAmount, deliveryFee, duuShare } = computeOrderAmounts(
        o as AnyObj,
      );

      if (st !== "CANCELLED") {
        caNet += itemsAmount;
        caDelivery += deliveryFee;
      }

      caDuumini += duuShare;
    });

    return { caNet, caDelivery, caDuumini };
  }, [displayed, items, isVendor]);

  async function onEdit(id: number) {
    try {
      const full = await getOrder(id);

      setEditId(full.id);
      setEditStatus(full.status);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onSave() {
    if (!editId) return;

    setSaving(true);

    try {
      await updateOrderStatus(editId, editStatus);
      setEditId(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(id: number) {
    if (!window.confirm("Annuler cette commande ?")) return;

    try {
      await cancelOrder(id);
      await refresh();

      if (viewId === id) {
        setViewId(null);
        setDetail(null);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onWhatsappClick(id: number) {
    try {
      const full = await getOrder(id);

      window.open(waHref(full as AnyObj), "_blank", "noopener,noreferrer");
    } catch {
      alert("Impossible de préparer le message WhatsApp pour cette commande.");
    }
  }

  async function onView(id: number) {
    setViewId(id);
    setViewLoading(true);
    setViewErr(null);
    setDetail(null);

    setPayEditMode("ADD");
    setPayInput(0);
    setPayMethod("CASH");
    setPayNote("");

    try {
      const d = await getOrder(id);

      setDetail(d as any);
      setViewStatus((d as any)?.status || "OPEN");

      const pay = getPaymentFromOrder(d as AnyObj);
      if (pay?.method) setPayMethod(pay.method);
      if (pay?.note) setPayNote(String(pay.note || ""));
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewLoading(false);
    }
  }

  async function onViewSaveStatus() {
    if (!viewId) return;

    setViewSaving(true);

    try {
      await updateOrderStatus(viewId, viewStatus);
      await refresh();

      const d = await getOrder(viewId);

      setDetail(d as any);
      setViewStatus((d as any)?.status || viewStatus);
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewSaving(false);
    }
  }

  async function onConfirmQuick(status: OrderStatus) {
    if (!viewId) return;

    setViewSaving(true);

    try {
      await updateOrderStatus(viewId, status);
      await refresh();

      const d = await getOrder(viewId);

      setDetail(d as any);
      setViewStatus((d as AnyObj)?.status || status);
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewSaving(false);
    }
  }

  async function onSavePayment() {
    if (!viewId || !detail) return;
    if (typeof updateOrderPayment !== "function") return;

    const { total } = computeOrderAmounts(detail as AnyObj);
    const curPay = getPaymentFromOrder(detail as AnyObj);
    const currentPaid = numSafe(curPay?.paid_amount);

    const raw = Number(payInput || 0);
    if (!Number.isFinite(raw)) return setViewErr("Montant invalide.");

    if (payEditMode === "ADD") {
      if (raw <= 0) return setViewErr("Le montant à ajouter doit être > 0.");
      if (currentPaid + raw > total + 0.0001) {
        return setViewErr("Vous dépassez le total de la commande.");
      }
    } else {
      if (raw < 0)
        return setViewErr("Le montant payé ne peut pas être négatif.");
      if (raw > total + 0.0001) {
        return setViewErr("Le montant payé ne peut pas dépasser le total.");
      }
    }

    setPaySaving(true);
    setViewErr(null);

    try {
      const payload =
        payEditMode === "ADD"
          ? {
              mode: "ADD" as const,
              add_amount: raw,
              method: payMethod,
              note: payNote,
            }
          : {
              mode: "SET" as const,
              paid_amount: raw,
              method: payMethod,
              note: payNote,
            };

      await updateOrderPayment(viewId, payload as any);

      const d = await getOrder(viewId);

      setDetail(d as any);
      await refresh();
      setPayInput(0);
    } catch (e: any) {
      setViewErr(e?.message || "Impossible de mettre à jour le paiement.");
    } finally {
      setPaySaving(false);
    }
  }

  const editDisplayCode = editId !== null ? getOrderDisplayCode(editId) : "";

  return (
    <div className="container-xxl py-4">
      <PageHeader
        title={isVendor ? "Mes commandes" : "Commandes"}
        subtitle={
          isVendor
            ? "Suivez et mettez à jour vos commandes."
            : "Toutes les commandes Duumini, filtres, ventes sur place et top clients."
        }
        right={
          <>
            {!isVendor && (
              <>
                <button className="btn btn-duu-orange" onClick={() => setOpenPos(true)}>
                  + Vente sur place
                </button>

                <button
                  className="btn btn-outline-dark"
                  onClick={() => setOpenAdminOrder(true)}
                >
                  + Commander pour un client
                </button>
              </>
            )}

            {!isVendor && (
              <Link to="/admin" className="btn btn-outline-dark">
                Accueil admin
              </Link>
            )}
          </>
        }
      />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Commandes
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "top-customers" ? "active" : ""}`}
            onClick={() => setActiveTab("top-customers")}
          >
            Top clients
          </button>
        </li>
      </ul>

      {activeTab === "top-customers" && <TopCustomersTab />}

      {activeTab === "orders" && (
        <>
      <OrdersStatsCards
        caNet={globalStats.caNet}
        caDelivery={globalStats.caDelivery}
        caDuumini={globalStats.caDuumini}
      />

      <OrdersFiltersBar
        q={q}
        setQ={(v) => {
          setPage(1);
          setQ(v);
        }}
        statusFilter={statusFilter}
        setStatusFilter={(v) => {
          setPage(1);
          setStatusFilter(v);
        }}
        payFilter={payFilter}
        setPayFilter={(v) => {
          setPage(1);
          setPayFilter(v);
        }}
        loading={loading}
        refresh={refresh}
        page={page}
        pages={effectivePages}
        total={effectiveTotal}
        onResetPage={() => {
          setPage(1);
        }}
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <div
        className="card border-0"
        style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
      >
        <div className="card-body p-3 p-sm-4">
          <OrdersTable
            loading={loading}
            orders={displayed}
            user={user}
            onView={onView}
            onEdit={onEdit}
            onCancel={onCancel}
            onWhatsappClick={onWhatsappClick}
            dateTime={dateTime}
          />

          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="text-muted small">{effectiveTotal} élément(s)</div>

            <div className="btn-group">
              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Préc.
              </button>

              <span className="btn btn-sm btn-outline-dark disabled">
                {page} / {effectivePages}
              </span>

              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page >= effectivePages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suiv.
              </button>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      <EditStatusModal
        open={editId !== null}
        title={`Commande #${editDisplayCode}`}
        status={editStatus}
        setStatus={setEditStatus}
        saving={saving}
        onClose={() => setEditId(null)}
        onSave={onSave}
      />

      <OrderViewModal
        open={viewId !== null}
        viewId={viewId}
        detail={detail}
        loading={viewLoading}
        error={viewErr}
        viewStatus={viewStatus}
        setViewStatus={setViewStatus}
        saving={viewSaving}
        onClose={() => {
          setViewId(null);
          setDetail(null);
        }}
        onConfirmQuick={onConfirmQuick}
        onSaveStatus={onViewSaveStatus}
        updatePaymentAvailable={typeof updateOrderPayment === "function"}
        payEditMode={payEditMode}
        setPayEditMode={setPayEditMode}
        payInput={payInput}
        setPayInput={setPayInput}
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        payNote={payNote}
        setPayNote={setPayNote}
        paySaving={paySaving}
        onSavePayment={onSavePayment}
        onCancel={onCancel}
        dateTime={dateTime}
      />

      {!isVendor && (
        <PosSaleModal
          open={openPos}
          onClose={() => setOpenPos(false)}
          onCreated={refresh}
        />
      )}

      {!isVendor && (
        <AdminOrderForClientModal
          open={openAdminOrder}
          onClose={() => setOpenAdminOrder(false)}
          onCreated={refresh}
        />
      )}

    </div>
  );
}
