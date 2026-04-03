import { useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import type { AnyObj } from "./orderUtils";
import {
  computeOrderAmounts,
  getOrderDisplayCode,
  getPaymentFromOrder,
  mad,
  normFulfillment,
  fulfillmentLabel,
} from "./orderUtils";
import { useAuth } from "../../context/AuthContext";

function safeUpper(v: any) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function reductionLabel(adminDiscount: any, currency = "MAD") {
  const type = safeUpper(adminDiscount?.type);
  const value = num(adminDiscount?.value, 0);

  if (!value || type === "NONE") return "—";
  if (type === "PERCENT") return `${value}%`;
  if (type === "AMOUNT") return `${value} ${currency}`;
  return "—";
}

function viewerRoleLabel(role: string) {
  if (role === "ADMIN") return "ADMIN";
  if (role === "VENDEUR" || role === "VENDOR") return "VENDEUR";
  return "CLIENT";
}

function money(n?: number | null, currency = "MAD") {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ${currency}`;
}

function paymentMethodLabel(method: any) {
  const m = safeUpper(method);

  if (!m) return "—";
  if (["CASH", "ESPECES", "ESPÈCES"].includes(m)) return "Espèces";
  if (["CARD", "CARTE"].includes(m)) return "Carte";
  if (["BANK_TRANSFER", "TRANSFER", "VIREMENT", "BANK"].includes(m))
    return "Virement";
  if (["DEPOT_VENTE", "DEPOT", "CONSIGNMENT"].includes(m)) return "Dépôt vente";

  return String(method);
}

function hasValue(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s === "—") return false;
  if (s.toLowerCase() === "null") return false;
  if (s.toLowerCase() === "undefined") return false;
  return true;
}

function formatCustomerType(v: any) {
  const s = safeUpper(v);
  if (s === "ENTREPRISE") return "Entreprise";
  if (s === "INFORMEL") return "Informel";
  if (s === "CLIENT") return "Client";
  return hasValue(v) ? String(v) : "—";
}

function getUnitPrice(item: any) {
  const candidates = [
    item?.final_unit_price,
    item?.unit_price_final,
    item?.promo_price,
    item?.sale_price,
    item?.unit_price,
    item?.price,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function cleanPaymentNote(note: any) {
  const text = String(note || "").trim();
  if (!text) return "";

  return text
    .replace(/admin order\s*\|\s*/gi, "")
    .replace(/\bUNPAID\b\s*\|\s*/gi, "")
    .replace(/\|\s*\bUNPAID\b/gi, "")
    .replace(/\bUNPAID\b/gi, "")
    .replace(/\s+\|\s+\|/g, " | ")
    .replace(/^\|\s*/, "")
    .replace(/\s*\|$/, "")
    .trim();
}

function calcUnitHT(unitTTC: number) {
  return +(unitTTC / 1.2).toFixed(2);
}

function calcLineHT(qty: number, unitTTC: number) {
  return +(qty * calcUnitHT(unitTTC)).toFixed(2);
}

function formatVendorInvoiceCode(order: any, fallbackCode: string) {
  const rawDate =
    order?.created_at ||
    order?.createdAt ||
    order?.date ||
    order?.ordered_at ||
    order?.order_date ||
    new Date().toISOString();

  const d = new Date(rawDate);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const rawNumber =
    order?.invoice_sequence ||
    order?.invoice_no ||
    order?.invoice_number ||
    order?.display_number ||
    order?.sequence ||
    order?.id ||
    fallbackCode ||
    "1";

  const normalized = String(rawNumber).replace(/\D/g, "");
  const padded = (normalized || "1").slice(-4).padStart(4, "0");

  return `${year}${month}${day}${padded}S`;
}

function fmtDateOnly(raw: any) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

function fmtQty(value: any) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function OrderReceipt(props: {
  order: AnyObj;
  hidePrintButton?: boolean;
  logoSrc?: string;
  shopName?: string;
  slogan?: string;
  hotlinePhone?: string;
  publicWebBase?: string;
}) {
  const {
    order,
    hidePrintButton,
    logoSrc = "/logo.jpeg",
    shopName = "DUUMINI",
    slogan = "Les goûts de ton pays, partout où tu te trouves",
    hotlinePhone = "",
    publicWebBase,
  } = props;

  const { user, isImpersonating } = useAuth();

  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

  const viewerRole = safeUpper(user?.role);
  const isAdmin = viewerRole === "ADMIN";
  const isVendor = viewerRole === "VENDEUR" || viewerRole === "VENDOR";
  const isVendorView = isAdmin || isVendor;

  const code = getOrderDisplayCode(order);
  const vendorInvoiceCode = useMemo(
    () => formatVendorInvoiceCode(order, code),
    [order, code],
  );

  const created = order?.created_at
    ? new Date(order.created_at).toLocaleString("fr-FR")
    : "—";
  const createdDateOnly = fmtDateOnly(
    order?.created_at ||
      order?.createdAt ||
      order?.date ||
      order?.ordered_at ||
      order?.order_date,
  );

  const contact = order?.contact || order?.customer || order?.user || {};
  const address = order?.address || contact?.address || {};

  const fullName =
    `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
    contact?.full_name ||
    contact?.name ||
    order?.customer_name ||
    order?.name ||
    "—";

  const phone =
    contact?.phone ||
    order?.customer_phone ||
    order?.phone ||
    order?.contact_phone ||
    "—";

  const city =
    address?.city ||
    address?.ville ||
    contact?.city ||
    contact?.ville ||
    order?.customer_city ||
    order?.city ||
    "—";

  const commune =
    address?.commune || contact?.commune || order?.customer_commune || "—";

  const district =
    address?.district ||
    address?.quartier ||
    contact?.district ||
    contact?.quartier ||
    order?.customer_district ||
    order?.customer_quartier ||
    "—";

  const addressLine =
    address?.address_line ||
    address?.addressLine ||
    address?.adresse ||
    address?.address ||
    address?.street ||
    contact?.address_line ||
    contact?.address ||
    order?.customer_address ||
    "—";

  const customerType = formatCustomerType(
    order?.customer_type || contact?.customer_type || contact?.type_client,
  );

  const customerTradeName =
    order?.customer_trade_name ||
    contact?.customer_trade_name ||
    contact?.trade_name ||
    contact?.nom_commercial ||
    "—";

  const customerIce =
    order?.customer_ice || contact?.customer_ice || contact?.ice || "—";

  const f = normFulfillment(order);
  const fBadge = fulfillmentLabel(f);

  const { itemsAmount, deliveryFee, total, duuShare, vendorNet } =
    computeOrderAmounts(order);

  const pay = getPaymentFromOrder(order);

  const currency = String(
    order?.totals?.currency || order?.currency || "MAD",
  ).toUpperCase();

  const totals = order?.totals || {};
  const adminDiscount = order?.admin_discount || {};

  const itemsSubtotal = num(totals?.items_subtotal, itemsAmount);

  const discountAmount = num(
    adminDiscount?.amount,
    totals?.admin_discount_amount,
  );

  const discountedItemsAmount = num(
    totals?.discounted_items_amount,
    Math.max(0, itemsSubtotal - discountAmount),
  );

  const displayDeliveryFee = num(totals?.delivery_fee, deliveryFee);
  const displayTotal = num(totals?.amount, total);

  const discountText = reductionLabel(adminDiscount, currency);

  const paymentLine = [
    pay?.method ? `Méthode: ${paymentMethodLabel(pay.method)}` : null,
    `Payé: ${mad(pay?.paid_amount || 0)}`,
  ]
    .filter(Boolean)
    .join(" • ");

  const cleanedNote = cleanPaymentNote(pay?.note);

  const summary = useMemo(
    () => ({
      itemsSubtotal,
      discountAmount,
      discountedItemsAmount,
      deliveryFee: displayDeliveryFee,
      total: displayTotal,
      duuShare,
      vendorNet,
    }),
    [
      itemsSubtotal,
      discountAmount,
      discountedItemsAmount,
      displayDeliveryFee,
      displayTotal,
      duuShare,
      vendorNet,
    ],
  );

  const vendorItems = Array.isArray(order?.items) ? order.items : [];

  const vendorTotals = useMemo(() => {
    const totalHT = vendorItems.reduce((acc: number, it: any) => {
      const qty = Number(it?.qty || 1);
      const unitTTC = getUnitPrice(it);
      return acc + calcLineHT(qty, unitTTC);
    }, 0);

    const safeTotalHT = +Math.max(0, totalHT).toFixed(2);
    const tvaAmount = +(safeTotalHT * 0.2).toFixed(2);
    const totalTTC = +(safeTotalHT + tvaAmount).toFixed(2);

    return {
      totalHT: safeTotalHT,
      tvaAmount,
      totalTTC,
    };
  }, [vendorItems]);

  function buildVerifyUrl(o: any) {
    const base =
      (publicWebBase || "").trim().replace(/\/+$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const token = o?.receipt_token ? String(o.receipt_token) : null;
    if (!token) return base;

    return `${base}/r/${encodeURIComponent(token)}`;
  }

  const verifyUrl = useMemo(
    () => buildVerifyUrl(order),
    [order, publicWebBase],
  );

  function cleanupPrintRoot() {
    document.body.classList.remove("duu-printing");
    const root = document.getElementById("duu-print-root");
    if (root) root.remove();
  }

  function waitImages(container: HTMLElement, timeoutMs = 2500) {
    const imgs = Array.from(
      container.querySelectorAll("img"),
    ) as HTMLImageElement[];
    if (!imgs.length) return Promise.resolve();

    const waits = imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    });

    return Promise.race([
      Promise.all(waits).then(() => void 0),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  async function printTicket() {
    const printable = receiptRef.current;
    if (!printable) return;

    cleanupPrintRoot();

    const root = document.createElement("div");
    root.id = "duu-print-root";
    root.appendChild(printable.cloneNode(true));
    document.body.appendChild(root);

    await waitImages(root);
    await new Promise((r) => setTimeout(r, 120));

    document.body.classList.add("duu-printing");

    const after = () => {
      window.removeEventListener("afterprint", after);
      cleanupPrintRoot();
    };
    window.addEventListener("afterprint", after);

    setTimeout(() => {
      window.print();
      setTimeout(() => cleanupPrintRoot(), 1800);
    }, 100);
  }

  async function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function shareTicketAsImage() {
    const el = receiptRef.current;
    if (!el) return;

    try {
      setSharing(true);

      await waitImages(el);
      await new Promise((r) => setTimeout(r, 80));

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const filename = `${isVendorView ? "Facture" : "Recu"}-${code}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });

      const nav: any = navigator as any;

      if (nav?.share && (!nav?.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: isVendorView ? "Facture vendeur" : "Reçu Duumini",
          text: isVendorView ? "Facture vendeur." : "Reçu.",
          files: [file],
        });
        return;
      }

      await downloadDataUrl(dataUrl, filename);
    } finally {
      setSharing(false);
    }
  }

  const receiptRows = [
    { label: "Client", value: fullName },
    { label: "Téléphone", value: String(phone) },
    { label: "Ville", value: city },
    { label: "Commune", value: commune },
    { label: "Quartier", value: district },
    { label: "Adresse", value: addressLine },
    { label: "Type client", value: customerType },
    { label: "Livraison", value: fBadge.text },
  ];

  return (
    <>
      <style>{`
        :root{
          --dm-yellow:#FFD000;
          --dm-black:#111111;
          --dm-text:#161616;
          --dm-muted:#667085;
          --dm-soft:#F8F9FB;
          --dm-line:#D0D5DD;
          --dm-line-soft:#EAECF0;
          --dm-danger:#D92D20;
          --dm-success:#12B76A;
        }

        .dm-r-wrap{
          width:1100px;
          max-width:100%;
          margin:0 auto;
          font-family:Arial, Helvetica, sans-serif;
          color:var(--dm-text);
        }

        .dm-actions{
          margin-bottom:10px;
          display:flex;
          gap:8px;
          justify-content:center;
          flex-wrap:wrap;
        }

        .dm-btn{
          border-radius:12px;
          padding:10px 13px;
          font-weight:900;
          font-size:12px;
          cursor:pointer;
          border:1px solid var(--dm-black);
          background:var(--dm-black);
          color:var(--dm-yellow);
          width:100%;
          max-width:280px;
        }

        .dm-btn-ghost{
          border-radius:12px;
          padding:10px 13px;
          font-weight:900;
          font-size:12px;
          cursor:pointer;
          border:1px solid rgba(0,0,0,.12);
          background:#fff;
          color:var(--dm-black);
          width:100%;
          max-width:280px;
        }

        .dm-btn:disabled,
        .dm-btn-ghost:disabled{
          opacity:.6;
          cursor:not-allowed;
        }

        .dm-r-paper{
          background:#fff;
          border:1px solid rgba(17,17,17,.08);
          border-radius:10px;
          overflow:hidden;
          box-shadow:0 8px 24px rgba(17,17,17,.06);
        }

        .dm-receipt-modern{
          padding:16px;
          font-family:Inter, Arial, Helvetica, sans-serif;
        }

        .dm-r-topbar{
          height:4px;
          background:linear-gradient(90deg, #FFD000 0%, #FFE04D 50%, #FFD000 100%);
        }

        .dm-r-header{
          padding:12px 16px 10px;
          border-bottom:1px solid var(--dm-line-soft);
          background:
            radial-gradient(circle at top left, rgba(255,208,0,.09), transparent 28%),
            linear-gradient(180deg, #fff 0%, #fcfcfd 100%);
        }

        .dm-r-head-main{
          display:grid;
          grid-template-columns:1fr auto;
          gap:12px;
          align-items:start;
        }

        .dm-r-brand{
          display:flex;
          gap:10px;
          align-items:flex-start;
          min-width:0;
        }

        .dm-r-logo{
          width:44px;
          height:44px;
          border-radius:10px;
          overflow:hidden;
          border:1px solid rgba(0,0,0,.08);
          background:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          flex:0 0 auto;
        }

        .dm-r-logo img{
          width:100%;
          height:100%;
          object-fit:cover;
        }

        .dm-r-name{
          font-size:18px;
          font-weight:900;
          line-height:1;
          letter-spacing:.3px;
        }

        .dm-r-slogan{
          margin-top:4px;
          color:var(--dm-muted);
          font-size:10px;
          font-weight:700;
          line-height:1.3;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-r-meta{
          text-align:right;
          min-width:200px;
        }

        .dm-r-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:4px 8px;
          border-radius:999px;
          background:#FFF7CC;
          border:1px solid rgba(17,17,17,.06);
          color:#2D2A1F;
          font-size:10px;
          font-weight:900;
          margin-bottom:6px;
        }

        .dm-r-doc-title{
          font-size:18px;
          font-weight:900;
          letter-spacing:.5px;
          line-height:1;
        }

        .dm-r-doc-sub{
          margin-top:4px;
          color:var(--dm-muted);
          font-size:10px;
          font-weight:700;
          line-height:1.35;
        }

        .dm-r-body{
          padding:12px 16px 14px;
          font-size:11px;
        }

        .dm-r-panel{
          border:1px solid var(--dm-line-soft);
          border-radius:10px;
          background:#fff;
          padding:10px 11px;
          min-width:0;
        }

        .dm-r-panel-soft{
          background:var(--dm-soft);
        }

        .dm-r-panel-title{
          font-size:9px;
          text-transform:uppercase;
          letter-spacing:.9px;
          color:var(--dm-muted);
          font-weight:900;
          margin-bottom:7px;
        }

        .dm-r-mini-grid{
          display:grid;
          grid-template-columns:1fr 1fr 1fr 1fr;
          gap:6px 12px;
        }

        .dm-r-mini-row{
          display:grid;
          grid-template-columns:78px 1fr;
          gap:6px;
          align-items:start;
          min-width:0;
        }

        .dm-r-k{
          color:var(--dm-muted);
          font-weight:800;
        }

        .dm-r-v{
          font-weight:900;
          text-align:right;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-r-grid-main{
          display:grid;
          grid-template-columns:minmax(0, 1.35fr) minmax(290px, .9fr);
          gap:10px;
          align-items:start;
          margin-top:10px;
        }

        .dm-r-side-stack{
          display:grid;
          gap:10px;
        }

        .dm-r-section-title{
          font-size:10px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.7px;
          margin-bottom:6px;
          color:#202020;
        }

        .dm-r-table-wrap{
          border:1px solid var(--dm-line-soft);
          border-radius:10px;
          overflow:hidden;
          background:#fff;
        }

        .dm-r-table{
          width:100%;
          border-collapse:collapse;
        }

        .dm-r-table th,
        .dm-r-table td{
          padding:7px 8px;
          border-bottom:1px solid var(--dm-line-soft);
          vertical-align:middle;
        }

        .dm-r-table th{
          background:#FAFAFB;
          text-align:left;
          font-size:10px;
          font-weight:900;
          color:#202020;
        }

        .dm-r-table tbody tr:last-child td{
          border-bottom:none;
        }

        .dm-r-table td{
          font-size:10.5px;
          font-weight:700;
          line-height:1.25;
        }

        .dm-r-table td.num{
          text-align:right;
          font-weight:900;
          white-space:nowrap;
        }

        .dm-r-line-name{
          font-weight:900;
          line-height:1.25;
        }

        .dm-r-totals{
          width:100%;
          border:1px solid var(--dm-line-soft);
          border-radius:10px;
          overflow:hidden;
          background:#fff;
        }

        .dm-r-totals-head{
          background:#FAFAFB;
          padding:8px 10px;
          font-size:9px;
          text-transform:uppercase;
          letter-spacing:.7px;
          color:var(--dm-muted);
          font-weight:900;
          border-bottom:1px solid var(--dm-line-soft);
        }

        .dm-r-total-row{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:10px;
          padding:8px 10px;
          border-bottom:1px solid var(--dm-line-soft);
          font-size:10.5px;
        }

        .dm-r-total-row:last-child{
          border-bottom:none;
        }

        .dm-r-total-row .label{
          color:#475467;
          font-weight:800;
        }

        .dm-r-total-row .value{
          text-align:right;
          font-weight:900;
          max-width:180px;
          white-space:normal;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-r-v-danger{
          color:var(--dm-danger);
        }

        .dm-r-v-success{
          color:var(--dm-success);
        }

        .dm-r-total-row-strong{
          background:#FFFDF2;
        }

        .dm-r-total-row-strong .label,
        .dm-r-total-row-strong .value{
          font-size:12px;
          font-weight:900;
          color:#111;
        }

        .dm-r-payment-box{
          border:1px solid var(--dm-line-soft);
          border-radius:10px;
          background:#FCFCFD;
          padding:9px 10px;
        }

        .dm-r-payment-line{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:10px;
          font-size:10.5px;
        }

        .dm-r-payment-line .left{
          color:var(--dm-muted);
          font-weight:800;
        }

        .dm-r-payment-line .right{
          text-align:right;
          font-weight:900;
          word-break:break-word;
        }

        .dm-r-note-box{
          border:1px dashed #D0D5DD;
          border-radius:10px;
          background:#fff;
          padding:9px 10px;
        }

        .dm-r-note-title{
          font-size:9px;
          text-transform:uppercase;
          letter-spacing:.7px;
          color:var(--dm-muted);
          font-weight:900;
          margin-bottom:5px;
        }

        .dm-r-note-body{
          font-size:10.5px;
          line-height:1.35;
          font-weight:700;
          color:#2F2F2F;
          white-space:pre-wrap;
          word-break:break-word;
        }

        .dm-r-bottom{
          margin-top:10px;
          display:grid;
          grid-template-columns:1fr 88px;
          gap:10px;
          align-items:end;
        }

        .dm-r-footer{
          border-top:1px solid var(--dm-line-soft);
          padding-top:8px;
        }

        .dm-r-footer-main{
          font-size:11px;
          font-weight:900;
        }

        .dm-r-qr{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:5px;
          border:1px solid var(--dm-line-soft);
          border-radius:10px;
          padding:7px;
          background:#fff;
        }

        .dm-r-qrtext{
          font-size:8.5px;
          line-height:1.2;
          text-align:center;
          color:var(--dm-muted);
          font-weight:800;
        }

        .dm-invoice-wrap{
          width:100%;
          background:#fff;
          color:#000;
          font-family:Arial, Helvetica, sans-serif;
        }

        .dm-invoice-page{
          width:100%;
          min-height:auto;
          background:#fff;
        }

        .dm-invoice-header-img,
        .dm-invoice-footer-img{
          display:block;
          width:100%;
          height:auto;
        }

        .dm-invoice-body{
          padding:4mm 8mm 5mm;
        }

        .dm-invoice-head{
          display:grid;
          grid-template-columns:minmax(0, 1fr) 82mm;
          gap:8mm;
          align-items:start;
          margin:0 0 3mm;
          min-height:28mm;
        }

        .dm-invoice-head-left{
          min-height:1px;
        }

        .dm-invoice-head-right{
          text-align:right;
        }

        .dm-invoice-date{
          font-size:11px;
          font-weight:700;
          line-height:1.2;
          margin-bottom:4px;
        }

        .dm-invoice-client-box{
          border:1.2px solid #111;
          padding:5px 6px;
          text-align:left;
          min-height:22mm;
          display:flex;
          flex-direction:column;
          justify-content:flex-start;
          overflow-wrap:anywhere;
          word-break:break-word;
        }

        .dm-invoice-client-name{
          font-size:10.5px;
          font-weight:800;
          line-height:1.2;
          text-transform:uppercase;
        }

        .dm-invoice-client-ice{
          margin-top:3px;
          font-size:9px;
          font-weight:700;
          line-height:1.15;
        }

        .dm-invoice-docline{
          display:grid;
          grid-template-columns:1fr auto auto;
          gap:6px;
          align-items:end;
          margin:0 0 3mm;
        }

        .dm-invoice-doclabel{
          font-size:12px;
          font-style:italic;
          font-weight:700;
          line-height:1.1;
        }

        .dm-invoice-docnumber{
          font-size:11px;
          font-weight:800;
          line-height:1.1;
          white-space:nowrap;
        }

        .dm-invoice-table{
          width:100%;
          border-collapse:collapse;
          table-layout:fixed;
          border:1.2px solid #111;
        }

        .dm-invoice-table th{
          background:#111;
          color:#fff;
          border:1px solid #4a4a4a;
          padding:6px 5px;
          text-align:center;
          font-size:9px;
          font-weight:800;
          line-height:1.15;
        }

        .dm-invoice-table td{
          border:1px solid #7f7f7f;
          padding:6px 5px;
          font-size:9px;
          line-height:1.18;
          vertical-align:top;
        }

        .dm-invoice-table .c-ref{
          width:16%;
          text-align:center;
        }

        .dm-invoice-table .c-designation{
          width:44%;
        }

        .dm-invoice-table .c-qty{
          width:10%;
          text-align:center;
          white-space:nowrap;
        }

        .dm-invoice-table .c-unit{
          width:15%;
          text-align:right;
          white-space:nowrap;
        }

        .dm-invoice-table .c-total{
          width:15%;
          text-align:right;
          white-space:nowrap;
        }

        .dm-invoice-line-name{
          font-weight:700;
          line-height:1.2;
          word-break:break-word;
        }

        .dm-invoice-line-sub{
          display:block;
          margin-top:2px;
          font-size:8px;
          font-weight:500;
          line-height:1.1;
        }

        .dm-invoice-bottom{
          display:flex;
          justify-content:flex-end;
          margin-top:4mm;
        }

        .dm-invoice-totals{
          width:76mm;
          border:1.2px solid #111;
          background:#fff;
        }

        .dm-invoice-total-row{
          display:grid;
          grid-template-columns:minmax(0, 1fr) auto;
          gap:10px;
          padding:6px 8px;
          border-bottom:1px solid #9f9f9f;
          align-items:center;
          font-size:10px;
          line-height:1.15;
        }

        .dm-invoice-total-row:last-child{
          border-bottom:none;
        }

        .dm-invoice-total-row .label{
          font-weight:800;
        }

        .dm-invoice-total-row .value{
          text-align:right;
          white-space:nowrap;
          font-weight:800;
        }

        .dm-invoice-total-row.ttc{
          background:#f3f3f3;
        }

        .dm-invoice-total-row.ttc .label,
        .dm-invoice-total-row.ttc .value{
          font-size:11px;
          font-weight:900;
        }

        @media (max-width: 900px){
          .dm-r-wrap{
            width:100%;
          }

          .dm-r-head-main,
          .dm-r-grid-main,
          .dm-r-mini-grid,
          .dm-r-bottom,
          .dm-invoice-head{
            grid-template-columns:1fr;
          }

          .dm-r-meta{
            text-align:left;
            min-width:0;
          }

          .dm-invoice-body{
            padding:10px 12px 12px;
          }

          .dm-invoice-head-right{
            text-align:left;
          }

          .dm-invoice-docline{
            grid-template-columns:1fr;
            gap:4px;
          }

          .dm-invoice-totals{
            width:100%;
          }
        }

        @media print{
          body.duu-printing > *:not(#duu-print-root){
            display:none !important;
          }

          body.duu-printing #duu-print-root{
            display:block !important;
          }

          @page{
            size:A4 portrait;
            margin:0;
          }

          html, body{
            background:#fff !important;
          }

          *{
            -webkit-print-color-adjust:exact !important;
            print-color-adjust:exact !important;
          }

          #duu-print-root{
            width:210mm !important;
            max-width:210mm !important;
            margin:0 auto !important;
          }

          #duu-print-root .dm-r-paper{
            border:none !important;
            border-radius:0 !important;
            box-shadow:none !important;
            overflow:visible !important;
          }

          #duu-print-root .dm-no-print{
            display:none !important;
          }

          #duu-print-root .dm-r-wrap{
            width:210mm !important;
            max-width:210mm !important;
            margin:0 auto !important;
          }

          #duu-print-root .dm-invoice-wrap,
          #duu-print-root .dm-invoice-page{
            width:210mm !important;
            max-width:210mm !important;
            min-height:297mm !important;
            box-shadow:none !important;
            border:none !important;
            overflow:hidden !important;
          }

          #duu-print-root .dm-invoice-header-img,
          #duu-print-root .dm-invoice-footer-img{
            width:210mm !important;
            max-width:210mm !important;
            height:auto !important;
            page-break-inside:avoid !important;
          }

          #duu-print-root .dm-invoice-table,
          #duu-print-root .dm-invoice-totals,
          #duu-print-root .dm-r-panel,
          #duu-print-root .dm-r-payment-box,
          #duu-print-root .dm-r-note-box,
          #duu-print-root .dm-r-totals{
            break-inside:avoid;
            page-break-inside:avoid;
          }
        }
      `}</style>

      <div className="dm-r-wrap">
        {!hidePrintButton ? (
          <div className="dm-actions dm-no-print">
            <button className="dm-btn" type="button" onClick={printTicket}>
              {isVendorView
                ? "Imprimer la facture vendeur"
                : "Imprimer le reçu"}
            </button>

            <button
              className="dm-btn-ghost"
              type="button"
              onClick={shareTicketAsImage}
              disabled={sharing}
            >
              {sharing ? "Préparation…" : "Partager WhatsApp (image)"}
            </button>
          </div>
        ) : null}

        <div ref={receiptRef} className="dm-r-paper">
          {isVendorView ? (
            <div className="dm-invoice-wrap">
              <div className="dm-invoice-page">
                <img
                  src="/entete.png"
                  alt="Entête facture"
                  className="dm-invoice-header-img"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />

                <div className="dm-invoice-body">
                  <div className="dm-invoice-head">
                    <div className="dm-invoice-head-left" />

                    <div className="dm-invoice-head-right">
                      <div className="dm-invoice-date">{createdDateOnly}</div>

                      <div className="dm-invoice-client-box">
                        <div className="dm-invoice-client-name">
                          {hasValue(customerTradeName) && customerTradeName !== "—"
                            ? customerTradeName
                            : fullName}
                        </div>

                        {hasValue(customerIce) && customerIce !== "—" ? (
                          <div className="dm-invoice-client-ice">
                            ICE {customerIce}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="dm-invoice-docline">
                    <div className="dm-invoice-doclabel">Facture</div>
                    <div className="dm-invoice-docnumber">N°</div>
                    <div className="dm-invoice-docnumber">{vendorInvoiceCode}</div>
                  </div>

                  <table className="dm-invoice-table">
                    <thead>
                      <tr>
                        <th className="c-ref">Référence</th>
                        <th className="c-designation">Désignation</th>
                        <th className="c-qty">Qté</th>
                        <th className="c-unit">Px U H.T</th>
                        <th className="c-total">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorItems.length ? (
                        vendorItems.map((it: any, idx: number) => {
                          const ref =
                            it?.reference ||
                            it?.sku ||
                            it?.product_sku ||
                            it?.product_ref ||
                            it?.code ||
                            "—";

                          const name =
                            it?.product_name ||
                            it?.name ||
                            `Produit #${it?.product_id || idx + 1}`;

                          const variant = [it?.variant_size, it?.variant_color]
                            .filter(Boolean)
                            .join(" / ");

                          const qty = Number(it?.qty || 1);
                          const unitTTC = getUnitPrice(it);
                          const unitHT = calcUnitHT(unitTTC);
                          const lineHT = calcLineHT(qty, unitTTC);

                          return (
                            <tr key={idx}>
                              <td className="c-ref">{ref}</td>
                              <td className="c-designation">
                                <div className="dm-invoice-line-name">{name}</div>
                                {variant ? (
                                  <span className="dm-invoice-line-sub">
                                    {variant}
                                  </span>
                                ) : null}
                              </td>
                              <td className="c-qty">{fmtQty(qty)}</td>
                              <td className="c-unit">{money(unitHT, currency)}</td>
                              <td className="c-total">{money(lineHT, currency)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="c-ref">—</td>
                          <td className="c-designation">Aucun produit.</td>
                          <td className="c-qty">—</td>
                          <td className="c-unit">0,00 MAD</td>
                          <td className="c-total">0,00 MAD</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div className="dm-invoice-bottom">
                    <div className="dm-invoice-totals">
                      <div className="dm-invoice-total-row">
                        <div className="label">TOTAL H.T :</div>
                        <div className="value">
                          {money(vendorTotals.totalHT, currency)}
                        </div>
                      </div>

                      <div className="dm-invoice-total-row">
                        <div className="label">T.V.A 20% :</div>
                        <div className="value">
                          {money(vendorTotals.tvaAmount, currency)}
                        </div>
                      </div>

                      <div className="dm-invoice-total-row ttc">
                        <div className="label">TOTAL T.T.C :</div>
                        <div className="value">
                          {money(vendorTotals.totalTTC, currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <img
                  src="/pied.png"
                  alt="Pied facture"
                  className="dm-invoice-footer-img"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="dm-receipt-modern">
              <div className="dm-r-topbar" />

              <div className="dm-r-header">
                <div className="dm-r-head-main">
                  <div className="dm-r-brand">
                    <div className="dm-r-logo">
                      <img
                        src={logoSrc}
                        alt={shopName}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>

                    <div>
                      <div className="dm-r-name">{shopName}</div>
                      <div className="dm-r-slogan">{slogan}</div>
                    </div>
                  </div>

                  <div className="dm-r-meta">
                    <div className="dm-r-badge">
                      Vue {viewerRoleLabel(viewerRole)}
                      {isImpersonating ? " • IMPERSONATION" : ""}
                    </div>

                    <div className="dm-r-doc-title">REÇU</div>

                    <div className="dm-r-doc-sub">
                      N° {code}
                      <br />
                      {created}
                      {!!hotlinePhone ? (
                        <>
                          <br />
                          Hotline: {hotlinePhone}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="dm-r-body">
                <div className="dm-r-panel dm-r-panel-soft">
                  <div className="dm-r-panel-title">Informations client</div>

                  <div className="dm-r-mini-grid">
                    {receiptRows.map((row) => (
                      <div className="dm-r-mini-row" key={row.label}>
                        <div className="dm-r-k">{row.label}</div>
                        <div className="dm-r-v">{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dm-r-grid-main">
                  <div>
                    <div className="dm-r-section-title">Détails produits</div>

                    <div className="dm-r-table-wrap">
                      <table className="dm-r-table">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Qté</th>
                            <th>PU</th>
                            <th>Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(order?.items) && order.items.length ? (
                            order.items.map((it: any, idx: number) => {
                              const name =
                                it.product_name ||
                                it.name ||
                                `Produit #${it.product_id}`;
                              const variant = [it.variant_size, it.variant_color]
                                .filter(Boolean)
                                .join(" / ");
                              const displayName = variant
                                ? `${name} (${variant})`
                                : name;

                              const qty = Number(it.qty || 1);
                              const unit = getUnitPrice(it);
                              const lineTotal = +(qty * unit).toFixed(2);

                              return (
                                <tr key={idx}>
                                  <td>
                                    <div className="dm-r-line-name">
                                      {displayName}
                                    </div>
                                  </td>
                                  <td className="num">{fmtQty(qty)}</td>
                                  <td className="num">{mad(unit)}</td>
                                  <td className="num">{mad(lineTotal)}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4}>Aucun produit.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="dm-r-side-stack">
                    <div className="dm-r-totals">
                      <div className="dm-r-totals-head">Résumé</div>

                      <div className="dm-r-total-row">
                        <div className="label">Sous-total</div>
                        <div className="value">{mad(summary.itemsSubtotal)}</div>
                      </div>

                      {summary.discountAmount > 0 ? (
                        <>
                          <div className="dm-r-total-row">
                            <div className="label">Type réduction</div>
                            <div className="value">{discountText}</div>
                          </div>

                          <div className="dm-r-total-row">
                            <div className="label">Réduction</div>
                            <div className="value dm-r-v-danger">
                              - {mad(summary.discountAmount)}
                            </div>
                          </div>

                          <div className="dm-r-total-row">
                            <div className="label">Après réduction</div>
                            <div className="value dm-r-v-success">
                              {mad(summary.discountedItemsAmount)}
                            </div>
                          </div>
                        </>
                      ) : null}

                      <div className="dm-r-total-row">
                        <div className="label">Livraison</div>
                        <div className="value">{mad(summary.deliveryFee)}</div>
                      </div>

                      <div className="dm-r-total-row dm-r-total-row-strong">
                        <div className="label">TOTAL</div>
                        <div className="value">{mad(summary.total)}</div>
                      </div>
                    </div>

                    <div className="dm-r-payment-box">
                      <div className="dm-r-payment-line">
                        <div className="left">Paiement</div>
                        <div className="right">{paymentLine || "—"}</div>
                      </div>
                    </div>

                    {cleanedNote ? (
                      <div className="dm-r-note-box">
                        <div className="dm-r-note-title">Note</div>
                        <div className="dm-r-note-body">{cleanedNote}</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="dm-r-bottom">
                  <div className="dm-r-footer">
                    <div className="dm-r-footer-main">
                      Merci pour votre commande — Duumini
                    </div>
                  </div>

                  <div className="dm-r-qr">
                    <QRCode value={verifyUrl || "https://duumini.com"} size={58} />
                    <div className="dm-r-qrtext">
                      Vérification
                      <br />
                      authenticité
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}