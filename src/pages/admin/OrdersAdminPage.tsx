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
import EditStatusModal from "../../components/ordersAdmin/EditStatusModal";
import OrderViewModal from "../../components/ordersAdmin/OrderViewModal";
import PosSaleModal from "../../components/ordersAdmin/PosSaleModal";
import AdminOrderForClientModal from "../../components/ordersAdmin/AdminOrderForClientModal";

import type { AnyObj, CurrentUser, PayStatus } from "../../components/ordersAdmin/orderUtils";

import {
  computeOrderAmounts,
  getPaymentFromOrder,
  getOrderDisplayCode,
  isVendorRole,
  orderBelongsToUser,
  numSafe,
  waHref,
} from "../../components/ordersAdmin/orderUtils";

export default function OrdersAdminPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  // ✅ source brute (admin) ou collection vendeur (on charge large puis paginate local)
  const [items, setItems] = useState<Order[]>([]);
  const [vendorAll, setVendorAll] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [payFilter, setPayFilter] = useState<"ALL" | PayStatus>("ALL");

  // Edition statut
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  // View modal
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [viewStatus, setViewStatus] = useState<OrderStatus>("OPEN");
  const [viewSaving, setViewSaving] = useState(false);

  // Paiement dans modal view
  const [payEditMode, setPayEditMode] = useState<"SET" | "ADD">("ADD");
  const [payInput, setPayInput] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>("CASH");
  const [payNote, setPayNote] = useState<string>("");
  const [paySaving, setPaySaving] = useState(false);

  // POS modal (vente sur place)
  const [openPos, setOpenPos] = useState(false);

  // ✅ ADMIN: commander pour un client (POS-like)
  const [openAdminOrder, setOpenAdminOrder] = useState(false);

  // charge user
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ Mode vendeur: charge large puis filtre côté client (robuste)
      if (isVendor) {
        const res = await listOrders({
          page: 1,
          pageSize: 500,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(payFilter !== "ALL" ? { payment_status: payFilter } : {}),
        } as any);

        const all = (res.items || []) as Order[];
        const mine = all.filter((o) => orderBelongsToUser(o as AnyObj, user));

        setVendorAll(mine);
        setTotal(mine.length);
        setItems([]);
        setError(null);
        return;
      }

      // ✅ Admin: pagination backend
      const res = await listOrders({
        page,
        pageSize,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(payFilter !== "ALL" ? { payment_status: payFilter } : {}),
      } as any);

      setItems(res.items);
      setTotal(res.pageInfo.total);
      setVendorAll([]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, payFilter, isVendor, user]);

  // reset page si on change de mode/filters en vendeur
  useEffect(() => {
    if (isVendor) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, statusFilter, payFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // SSE
  useEffect(() => {
    const sub = subscribeSSE("/api/events/stream", (evt: ServerEvent) => {
      if (evt.type === "ORDER_CREATED" || evt.type === "ORDER_STATUS") {
        refresh();
        // @ts-ignore
        window?.duuminiToast?.({
          title:
            evt.payload?.title ||
            (evt.type === "ORDER_CREATED" ? "Nouvelle commande" : "Commande mise à jour"),
          message: evt.payload?.body || "",
        });
      }
    });
    return () => sub.close();
  }, [refresh]);

  const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("fr-FR") : "");

  // dataset courant
  const dataset = useMemo(() => (isVendor ? vendorAll : items), [isVendor, vendorAll, items]);

  // filtre recherche
  const searched = useMemo(() => {
    return dataset.filter((o) => {
      if (!q.trim()) return true;
      const txt = q.toLowerCase();
      const contact = (o as any)?.contact || (o as any)?.user || {};
      const contactName = `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
      return (
        String(o.id).toLowerCase().includes(txt) ||
        (o.status?.toLowerCase() || "").includes(txt) ||
        contactName.toLowerCase().includes(txt) ||
        (contact?.phone || "").toLowerCase().includes(txt)
      );
    });
  }, [dataset, q]);

  // pagination (admin: déjà paginé backend, vendeur: paginate local)
  const displayed = useMemo(() => {
    if (!isVendor) return searched;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return searched.slice(start, end);
  }, [searched, isVendor, page, pageSize]);

  const effectiveTotal = useMemo(() => (isVendor ? searched.length : total), [isVendor, searched.length, total]);
  const effectivePages = useMemo(() => Math.max(1, Math.ceil(effectiveTotal / pageSize)), [effectiveTotal, pageSize]);

  // stats (page)
  const globalStats = useMemo(() => {
    let caNet = 0;
    let caDelivery = 0;
    let caDuumini = 0;

    displayed.forEach((o) => {
      const st = String((o as AnyObj)?.status || "").toUpperCase();
      const { itemsAmount, deliveryFee, duuShare } = computeOrderAmounts(o as AnyObj);
      if (st !== "CANCELLED") {
        caNet += itemsAmount;
        caDelivery += deliveryFee;
      }
      caDuumini += duuShare; // DONE-only déjà géré dans computeOrderAmounts
    });

    return { caNet, caDelivery, caDuumini };
  }, [displayed]);

  async function onEdit(id: number) {
    try {
      const full = await getOrder(id);
      if (!orderBelongsToUser(full as AnyObj, user)) {
        setError("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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
      const full = await getOrder(id);
      if (!orderBelongsToUser(full as AnyObj, user)) {
        setError("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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
      if (!orderBelongsToUser(full as AnyObj, user)) {
        alert("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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
      if (detail && !orderBelongsToUser(detail as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      await updateOrderStatus(viewId, viewStatus);
      await refresh();

      const d = await getOrder(viewId);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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
      if (detail && !orderBelongsToUser(detail as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      await updateOrderStatus(viewId, status);
      await refresh();

      const d = await getOrder(viewId);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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

    if (!orderBelongsToUser(detail as AnyObj, user)) {
      setViewErr("Accès refusé : cette commande ne vous concerne pas.");
      return;
    }

    const { total } = computeOrderAmounts(detail as AnyObj);
    const curPay = getPaymentFromOrder(detail as AnyObj);
    const currentPaid = numSafe(curPay?.paid_amount);

    const raw = Number(payInput || 0);
    if (!Number.isFinite(raw)) return setViewErr("Montant invalide.");

    if (payEditMode === "ADD") {
      if (raw <= 0) return setViewErr("Le montant à ajouter doit être > 0.");
      if (currentPaid + raw > total + 0.0001) return setViewErr("Vous dépassez le total de la commande.");
    } else {
      if (raw < 0) return setViewErr("Le montant payé ne peut pas être négatif.");
      if (raw > total + 0.0001) return setViewErr("Le montant payé ne peut pas dépasser le total.");
    }

    setPaySaving(true);
    setViewErr(null);
    try {
      const payload =
        payEditMode === "ADD"
          ? { mode: "ADD" as const, add_amount: raw, method: payMethod, note: payNote }
          : { mode: "SET" as const, paid_amount: raw, method: payMethod, note: payNote };

      await updateOrderPayment(viewId, payload as any);

      const d = await getOrder(viewId);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }

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
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h5 m-0">{isVendor ? "Mes commandes" : "Commandes"}</h1>

        <div className="d-flex gap-2">
          {!isVendor && (
            <>
              <button className="btn btn-duu" onClick={() => setOpenPos(true)}>
                + Vente sur place
              </button>

              <button className="btn btn-outline-dark" onClick={() => setOpenAdminOrder(true)}>
                + Commander pour un client
              </button>
            </>
          )}

          {!isVendor && (
            <Link to="/admin" className="btn btn-outline-dark">
              Accueil admin
            </Link>
          )}
        </div>
      </div>

      <OrdersStatsCards caNet={globalStats.caNet} caDelivery={globalStats.caDelivery} caDuumini={globalStats.caDuumini} />

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
        onResetPage={() => setPage(1)}
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
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
              <button className="btn btn-sm btn-outline-dark" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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

      {/* ✅ POS (Vente sur place) */}
      {!isVendor && <PosSaleModal open={openPos} onClose={() => setOpenPos(false)} onCreated={refresh} />}

      {/* ✅ ADMIN: commander pour un client (produits + dropdown clients) */}
      {!isVendor && (
        <AdminOrderForClientModal
          open={openAdminOrder}
          onClose={() => setOpenAdminOrder(false)}
          onCreated={refresh}
        />
      )}

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