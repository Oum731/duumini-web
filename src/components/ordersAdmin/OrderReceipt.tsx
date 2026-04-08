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

type CustomerRole = "CLIENT" | "VENDEUR";

function safeUpper(v: any) {
  return String(v || "").trim().toUpperCase();
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function hasValue(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s === "—") return false;
  if (s.toLowerCase() === "null") return false;
  if (s.toLowerCase() === "undefined") return false;
  return true;
}

function reductionLabel(adminDiscount: any, currency = "MAD") {
  const type = safeUpper(adminDiscount?.type);
  const value = num(adminDiscount?.value, 0);

  if (!value || type === "NONE") return "—";
  if (type === "PERCENT") return `${value}%`;
  if (type === "AMOUNT") return `${value} ${currency}`;
  return "—";
}

function money(n?: number | null, currency = "MAD") {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function paymentMethodLabel(method: any) {
  const m = safeUpper(method);

  if (!m) return "—";
  if (["CASH", "ESPECES", "ESPÈCES"].includes(m)) return "Espèces";
  if (["CARD", "CARTE"].includes(m)) return "Carte";
  if (["BANK_TRANSFER", "TRANSFER", "VIREMENT", "BANK"].includes(m)) return "Virement";
  if (["DEPOT_VENTE", "DEPOT", "CONSIGNMENT"].includes(m)) return "Dépôt vente";

  return String(method);
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
    .replace(/\bPAID\b\s*\|\s*/gi, "")
    .replace(/\|\s*\bPAID\b/gi, "")
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

function calcFromTTC(ttc: number) {
  const safeTTC = +Math.max(0, Number(ttc || 0)).toFixed(2);
  const ht = +(safeTTC / 1.2).toFixed(2);
  const tva = +(safeTTC - ht).toFixed(2);
  return { ht, tva, ttc: safeTTC };
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

function normalizeCustomerRole(v: any): CustomerRole {
  const s = safeUpper(v);
  return s === "VENDEUR" || s === "VENDOR" || s === "SELLER" ? "VENDEUR" : "CLIENT";
}

function buildOrderDocumentNumber(rawDate: any, orderCode: string) {
  const d = new Date(rawDate || Date.now());
  if (Number.isNaN(d.getTime())) return orderCode;
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${orderCode}`;
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

  useAuth();

  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

  const orderCode = getOrderDisplayCode(order);

  const createdAt =
    order?.created_at ||
    order?.createdAt ||
    order?.date ||
    order?.ordered_at ||
    order?.order_date;

  const createdDateOnly = fmtDateOnly(createdAt);
  const documentNumber = buildOrderDocumentNumber(createdAt, orderCode);

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
    address?.commune ||
    contact?.commune ||
    order?.customer_commune ||
    "—";

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

  const customerTradeName =
    order?.customer_trade_name ||
    order?.commercial_name ||
    contact?.customer_trade_name ||
    contact?.trade_name ||
    contact?.commercial_name ||
    contact?.nom_commercial ||
    "—";

  const customerIce =
    order?.customer_ice ||
    order?.ice ||
    contact?.customer_ice ||
    contact?.ice ||
    "—";

  const orderCustomerRole: CustomerRole = normalizeCustomerRole(
    order?.customer_role ||
      order?.role_client ||
      contact?.customer_role ||
      contact?.role ||
      contact?.user_role ||
      ""
  );

  const hasVendorIdentity =
    (hasValue(customerTradeName) && customerTradeName !== "—") ||
    (hasValue(customerIce) && customerIce !== "—");

  const isVendorInvoice = orderCustomerRole === "VENDEUR" || hasVendorIdentity;

  const f = normFulfillment(order);
  const fBadge = fulfillmentLabel(f);

  const { itemsAmount, deliveryFee, total } = computeOrderAmounts(order);
  const pay = getPaymentFromOrder(order);

  const currency = String(order?.totals?.currency || order?.currency || "MAD").toUpperCase();
  const totals = order?.totals || {};
  const adminDiscount = order?.admin_discount || {};

  const itemsSubtotal = num(totals?.items_subtotal, itemsAmount);
  const discountAmount = num(adminDiscount?.amount, totals?.admin_discount_amount);
  const discountedItemsAmount = num(
    totals?.discounted_items_amount,
    Math.max(0, itemsSubtotal - discountAmount)
  );
  const displayDeliveryFee = num(totals?.delivery_fee, deliveryFee);
  const displayTotal = num(totals?.amount, total);

  const discountText = reductionLabel(adminDiscount, currency);
  const discountLabelText = String(adminDiscount?.label || "").trim();
  const cleanedNote = cleanPaymentNote(pay?.note);

  const paymentLine = [
    pay?.method ? `Méthode: ${paymentMethodLabel(pay.method)}` : null,
    `Payé: ${mad(pay?.paid_amount || 0)}`,
  ]
    .filter(Boolean)
    .join(" • ");

  const summary = useMemo(
    () => ({
      itemsSubtotal,
      discountAmount,
      discountedItemsAmount,
      deliveryFee: displayDeliveryFee,
      total: displayTotal,
    }),
    [itemsSubtotal, discountAmount, discountedItemsAmount, displayDeliveryFee, displayTotal]
  );

  const items = Array.isArray(order?.items) ? order.items : [];

  const invoiceTotals = useMemo(() => {
    const discount = +Math.max(0, discountAmount).toFixed(2);
    const netProducts = +Math.max(0, discountedItemsAmount).toFixed(2);
    const productTax = calcFromTTC(netProducts);

    return {
      discount,
      totalHT: productTax.ht,
      tvaAmount: productTax.tva,
      totalTTC: productTax.ttc,
    };
  }, [discountAmount, discountedItemsAmount]);

  function buildVerifyUrl(o: any) {
    const base =
      (publicWebBase || "").trim().replace(/\/+$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const token = o?.receipt_token ? String(o.receipt_token) : null;
    if (!token) return base;
    return `${base}/r/${encodeURIComponent(token)}`;
  }

  const verifyUrl = useMemo(() => buildVerifyUrl(order), [order, publicWebBase]);

  function cleanupPrintRoot() {
    document.body.classList.remove("duu-printing");
    const root = document.getElementById("duu-print-root");
    if (root) root.remove();
  }

  function waitImages(container: HTMLElement, timeoutMs = 2500) {
    const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
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

      const filename = `${isVendorInvoice ? "Facture" : "Recu"}-${documentNumber}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });

      const nav: any = navigator as any;

      if (nav?.share && (!nav?.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: isVendorInvoice ? "Facture vendeur" : "Reçu Duumini",
          text: isVendorInvoice ? "Facture vendeur." : "Reçu.",
          files: [file],
        });
        return;
      }

      await downloadDataUrl(dataUrl, filename);
    } finally {
      setSharing(false);
    }
  }

  const customerHeaderName =
    hasValue(customerTradeName) && customerTradeName !== "—"
      ? customerTradeName
      : fullName;

  const receiptInfoRows = [
    { label: "Client", value: fullName },
    ...(isVendorInvoice
      ? [{ label: "Nom commercial", value: customerHeaderName }]
      : []),
    ...(isVendorInvoice && hasValue(customerIce) ? [{ label: "ICE", value: customerIce }] : []),
    { label: "Téléphone", value: String(phone) },
    { label: "Ville", value: city },
    ...(hasValue(commune) ? [{ label: "Commune", value: commune }] : []),
    ...(hasValue(district) ? [{ label: "Quartier", value: district }] : []),
    ...(hasValue(addressLine) ? [{ label: "Adresse", value: addressLine }] : []),
    { label: "Rôle client", value: orderCustomerRole },
    { label: "Livraison", value: fBadge.text },
  ];

  return (
    <>
      <style>{`
        :root{
          --dm-yellow:#fff200;
          --dm-black:#0d0d0d;
          --dm-bg:#ededed;
          --dm-border:#7f7f7f;
          --dm-border-soft:#b7b7b7;
          --dm-danger:#c62828;
          --dm-text:#101010;
        }

        .dm-wrap{
          width:980px;
          max-width:100%;
          margin:0 auto;
          font-family:Arial, Helvetica, sans-serif;
          color:var(--dm-text);
        }

        .dm-actions{
          margin-bottom:12px;
          display:flex;
          gap:8px;
          justify-content:center;
          flex-wrap:wrap;
        }

        .dm-btn,
        .dm-btn-ghost{
          border-radius:10px;
          padding:10px 14px;
          font-weight:900;
          font-size:12px;
          cursor:pointer;
          width:100%;
          max-width:280px;
        }

        .dm-btn{
          border:1px solid #111;
          background:#111;
          color:#fff200;
        }

        .dm-btn-ghost{
          border:1px solid rgba(0,0,0,.15);
          background:#fff;
          color:#111;
        }

        .dm-btn:disabled,
        .dm-btn-ghost:disabled{
          opacity:.6;
          cursor:not-allowed;
        }

        .dm-paper{
          background:var(--dm-bg);
          border:1px solid rgba(0,0,0,.08);
          border-radius:28px;
          overflow:hidden;
          box-shadow:0 10px 26px rgba(0,0,0,.06);
        }

        .dm-page{
          background:var(--dm-bg);
          padding:24px 26px 0;
        }

        .dm-head{
          display:grid;
          grid-template-columns:82px minmax(0,1fr);
          gap:16px;
          align-items:start;
        }

        .dm-logo-box{
          width:78px;
          height:78px;
          background:#fff;
          border:1px solid rgba(0,0,0,.12);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }

        .dm-logo-box img{
          width:100%;
          height:100%;
          object-fit:contain;
          background:#fff;
        }

        .dm-brand{
          min-width:0;
        }

        .dm-brand-title{
          margin-top:6px;
          font-size:24px;
          line-height:1.04;
          font-weight:900;
          color:#d90000;
          text-shadow:1px 1px 0 rgba(0,0,0,.2);
          word-break:break-word;
        }

        .dm-brand-title.receipt{
          color:#111;
          text-shadow:none;
        }

        .dm-brand-sub{
          margin-top:8px;
          font-size:9px;
          line-height:1.3;
          text-align:center;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.35px;
        }

        .dm-invoice-head-image{
          width:100%;
          display:block;
          margin-bottom:12px;
          border-radius:0;
        }

        .dm-meta-line{
          display:flex;
          justify-content:flex-end;
          align-items:center;
          margin-top:8px;
          margin-bottom:10px;
        }

        .dm-date{
          text-align:right;
          font-size:12px;
          font-weight:900;
          white-space:nowrap;
        }

        .dm-client-box{
          width:100%;
          background:#fff;
          border:2px solid #555;
          padding:10px 12px;
          min-height:auto;
          box-sizing:border-box;
        }

        .dm-client-name{
          font-size:12px;
          line-height:1.14;
          font-weight:900;
          text-transform:uppercase;
          word-break:break-word;
          overflow-wrap:anywhere;
          margin-bottom:5px;
        }

        .dm-client-lines{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:4px 14px;
        }

        .dm-client-line{
          font-size:7px;
          line-height:1.28;
          font-weight:700;
          word-break:break-word;
          overflow-wrap:anywhere;
          min-width:0;
        }

        .dm-client-line b{
          font-weight:900;
        }

        .dm-doc-row{
          margin-top:18px;
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:20px;
          align-items:end;
        }

        .dm-doc-label{
          font-size:18px;
          line-height:1.05;
          font-style:italic;
          font-weight:700;
        }

        .dm-doc-number{
          font-size:13px;
          font-weight:900;
          text-align:right;
          white-space:nowrap;
        }

        .dm-table-wrap{
          margin-top:14px;
        }

        .dm-table{
          width:100%;
          border-collapse:collapse;
          table-layout:fixed;
          background:#fff;
        }

        .dm-table th{
          background:#000;
          color:#fff;
          border:2px solid #5c5c5c;
          padding:6px 4px;
          text-align:center;
          font-size:8px;
          line-height:1.1;
          font-weight:900;
        }

        .dm-table td{
          border:2px solid #8d8d8d;
          padding:7px 6px;
          font-size:7px;
          line-height:1.2;
          font-weight:700;
          vertical-align:top;
          background:#fff;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-table .c-ref{ width:16%; text-align:center; }
        .dm-table .c-name{ width:44%; }
        .dm-table .c-qty{ width:10%; text-align:center; }
        .dm-table .c-unit{ width:15%; text-align:right; white-space:nowrap; }
        .dm-table .c-total{ width:15%; text-align:right; white-space:nowrap; }

        .dm-line-name{
          font-size:7px;
          line-height:1.22;
          font-weight:900;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-line-sub{
          display:block;
          margin-top:2px;
          font-size:6px;
          line-height:1.1;
          font-weight:600;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-totals-wrap{
          display:flex;
          justify-content:flex-end;
          margin-top:18px;
          margin-bottom:20px;
        }

        .dm-totals{
          width:100%;
          max-width:560px;
          background:#fff;
          border:2px solid #585858;
        }

        .dm-total-row{
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:10px;
          align-items:center;
          padding:8px 12px;
          border-bottom:1px solid #bcbcbc;
        }

        .dm-total-row:last-child{
          border-bottom:none;
        }

        .dm-total-label{
          font-size:10px;
          font-weight:900;
          text-transform:uppercase;
        }

        .dm-total-value{
          font-size:10px;
          font-weight:900;
          text-align:right;
          white-space:nowrap;
        }

        .dm-total-row.strong .dm-total-label,
        .dm-total-row.strong .dm-total-value{
          font-size:11px;
        }

        .dm-total-row.discount .dm-total-value{
          color:var(--dm-danger);
        }

        .dm-receipt-bottom{
          display:grid;
          grid-template-columns:minmax(0,1fr) 104px;
          gap:14px;
          align-items:end;
          margin-bottom:20px;
        }

        .dm-box{
          background:#fff;
          border:2px solid #b8b8b8;
          padding:8px 10px;
        }

        .dm-box-title{
          font-size:8px;
          line-height:1.2;
          font-weight:900;
          text-transform:uppercase;
          margin-bottom:4px;
        }

        .dm-box-text{
          font-size:7px;
          line-height:1.28;
          font-weight:700;
          word-break:break-word;
          overflow-wrap:anywhere;
          white-space:pre-wrap;
        }

        .dm-qr-box{
          background:#fff;
          border:2px solid #d6d6d6;
          padding:7px;
          text-align:center;
        }

        .dm-qr-label{
          margin-top:4px;
          font-size:5.5px;
          line-height:1.12;
          font-weight:800;
          color:#5d5d5d;
        }

        .dm-thanks{
          margin-top:8px;
          font-size:8px;
          font-weight:900;
        }

        .dm-footer-yellow{
          background:var(--dm-yellow);
          padding:10px 16px 12px;
          text-align:center;
          border-top:1px solid rgba(0,0,0,.08);
        }

        .dm-footer-line{
          font-size:7px;
          line-height:1.2;
          font-weight:700;
          word-break:break-word;
        }

        .dm-footer-line + .dm-footer-line{
          margin-top:2px;
        }

        @media (max-width: 860px){
          .dm-wrap{
            width:100%;
          }

          .dm-page{
            padding:14px 12px 0;
          }

          .dm-head{
            grid-template-columns:58px minmax(0,1fr);
            gap:10px;
          }

          .dm-logo-box{
            width:54px;
            height:54px;
          }

          .dm-brand-title{
            font-size:16px;
          }

          .dm-brand-sub{
            font-size:7px;
          }

          .dm-client-lines{
            grid-template-columns:repeat(2, minmax(0, 1fr));
            gap:4px 8px;
          }

          .dm-doc-row{
            grid-template-columns:1fr;
            gap:5px;
          }

          .dm-doc-label{
            font-size:15px;
          }

          .dm-doc-number{
            text-align:left;
            font-size:11px;
            white-space:normal;
          }

          .dm-receipt-bottom{
            grid-template-columns:1fr;
          }

          .dm-meta-line{
            justify-content:flex-start;
          }

          .dm-date{
            text-align:left;
          }
        }

        @media (max-width: 640px){
          .dm-table th{
            font-size:7px;
            padding:5px 3px;
          }

          .dm-table td{
            font-size:6px;
            padding:5px 4px;
          }

          .dm-line-name{
            font-size:6px;
          }

          .dm-line-sub{
            font-size:5.5px;
          }

          .dm-total-label,
          .dm-total-value{
            font-size:9px;
          }

          .dm-total-row.strong .dm-total-label,
          .dm-total-row.strong .dm-total-value{
            font-size:10px;
          }

          .dm-client-name{
            font-size:10px;
          }

          .dm-client-line{
            font-size:6.2px;
          }

          .dm-client-lines{
            grid-template-columns:repeat(2, minmax(0, 1fr));
            gap:4px 6px;
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

          #duu-print-root .dm-wrap{
            width:210mm !important;
            max-width:210mm !important;
            margin:0 auto !important;
          }

          #duu-print-root .dm-paper{
            border:none !important;
            border-radius:0 !important;
            box-shadow:none !important;
            overflow:visible !important;
          }

          #duu-print-root .dm-page{
            width:210mm !important;
            max-width:210mm !important;
            min-height:297mm !important;
            padding:10mm 9mm 0 !important;
            box-sizing:border-box !important;
            background:#ededed !important;
          }

          #duu-print-root .dm-no-print{
            display:none !important;
          }

          #duu-print-root .dm-table,
          #duu-print-root .dm-totals,
          #duu-print-root .dm-box,
          #duu-print-root .dm-qr-box,
          #duu-print-root .dm-footer-yellow,
          #duu-print-root .dm-client-box{
            break-inside:avoid;
            page-break-inside:avoid;
          }
        }
      `}</style>

      <div className="dm-wrap">
        {!hidePrintButton ? (
          <div className="dm-actions dm-no-print">
            <button className="dm-btn" type="button" onClick={printTicket}>
              {isVendorInvoice ? "Imprimer la facture vendeur" : "Imprimer le reçu"}
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

        <div ref={receiptRef} className="dm-paper">
          {isVendorInvoice ? (
            <div className="dm-page">
              <img
                src="/entete.png"
                alt="Entête facture"
                className="dm-invoice-head-image"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />

              <div className="dm-meta-line">
                <div className="dm-date">{createdDateOnly}</div>
              </div>

              <div className="dm-client-box">
                <div className="dm-client-lines">
                  <div className="dm-client-line"><b>Client :</b> {fullName}</div>
                  <div className="dm-client-line"><b>Nom commercial :</b> {customerHeaderName}</div>
                  <div className="dm-client-line"><b>ICE :</b> {customerIce}</div>
                  <div className="dm-client-line"><b>Téléphone :</b> {phone}</div>
                  <div className="dm-client-line"><b>Ville :</b> {city}</div>
                  {hasValue(commune) ? <div className="dm-client-line"><b>Commune :</b> {commune}</div> : null}
                  {hasValue(district) ? <div className="dm-client-line"><b>Quartier :</b> {district}</div> : null}
                  {hasValue(addressLine) ? <div className="dm-client-line"><b>Adresse :</b> {addressLine}</div> : null}
                </div>
              </div>

              <div className="dm-doc-row">
                <div className="dm-doc-label">Facture</div>
                <div className="dm-doc-number">N° {documentNumber}</div>
              </div>

              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th className="c-ref">Référence</th>
                      <th className="c-name">Désignation</th>
                      <th className="c-qty">Qté</th>
                      <th className="c-unit">Px U H.T</th>
                      <th className="c-total">Montant HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((it: any, idx: number) => {
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
                            <td className="c-ref">{documentNumber}</td>
                            <td className="c-name">
                              <div className="dm-line-name">{name}</div>
                              {variant ? <span className="dm-line-sub">{variant}</span> : null}
                            </td>
                            <td className="c-qty">{fmtQty(qty)}</td>
                            <td className="c-unit">{money(unitHT, currency)}</td>
                            <td className="c-total">{money(lineHT, currency)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="c-ref">{documentNumber}</td>
                        <td className="c-name">Aucun produit.</td>
                        <td className="c-qty">—</td>
                        <td className="c-unit">0,00 MAD</td>
                        <td className="c-total">0,00 MAD</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dm-totals-wrap">
                <div className="dm-totals">
                  <div className="dm-total-row">
                    <div className="dm-total-label">TOTAL H.T :</div>
                    <div className="dm-total-value">{money(invoiceTotals.totalHT, currency)}</div>
                  </div>

                  <div className="dm-total-row">
                    <div className="dm-total-label">T.V.A 20% :</div>
                    <div className="dm-total-value">{money(invoiceTotals.tvaAmount, currency)}</div>
                  </div>

                  <div className="dm-total-row strong">
                    <div className="dm-total-label">TOTAL T.T.C :</div>
                    <div className="dm-total-value">{money(invoiceTotals.totalTTC, currency)}</div>
                  </div>

                  {invoiceTotals.discount > 0 ? (
                    <div className="dm-total-row discount">
                      <div className="dm-total-label">
                        RÉDUCTION{discountText !== "—" ? ` (${discountText})` : ""} :
                      </div>
                      <div className="dm-total-value">
                        - {money(invoiceTotals.discount, currency)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="dm-footer-yellow">
                <div className="dm-footer-line">
                  46 Boulevard ZERKTOUNI 2 eme étage Appt 6 CO STOR Conseil Casablanca
                </div>
                <div className="dm-footer-line">
                  RC CASABLANCA : 476059 - TP : 34260412 - IF : 47225785 ICE : 002641145000090
                </div>
                <div className="dm-footer-line">
                  Contact : +212 623677884 / +212 6 56 56 88 27 – email : lebesoingroup@gmail.com
                </div>
              </div>
            </div>
          ) : (
            <div className="dm-page">
              <div className="dm-head">
                <div className="dm-logo-box">
                  <img
                    src={logoSrc}
                    alt={shopName}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                <div className="dm-brand">
                  <div className="dm-brand-title receipt">{shopName}</div>
                  <div className="dm-brand-sub">{slogan}</div>
                </div>
              </div>

              <div className="dm-client-box">
                <div className="dm-client-lines">
                  {receiptInfoRows.map((row) => (
                    <div key={row.label} className="dm-client-line">
                      <b>{row.label} :</b> {row.value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="dm-doc-row">
                <div className="dm-doc-label">Reçu</div>
                <div className="dm-doc-number">N° {documentNumber}</div>
              </div>

              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th className="c-ref">Référence</th>
                      <th className="c-name">Désignation</th>
                      <th className="c-qty">Qté</th>
                      <th className="c-unit">Prix U.</th>
                      <th className="c-total">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((it: any, idx: number) => {
                        const name =
                          it?.product_name ||
                          it?.name ||
                          `Produit #${it?.product_id || idx + 1}`;

                        const variant = [it?.variant_size, it?.variant_color]
                          .filter(Boolean)
                          .join(" / ");

                        const qty = Number(it?.qty || 1);
                        const unit = getUnitPrice(it);
                        const lineTotal = +(qty * unit).toFixed(2);

                        return (
                          <tr key={idx}>
                            <td className="c-ref">{documentNumber}</td>
                            <td className="c-name">
                              <div className="dm-line-name">{name}</div>
                              {variant ? <span className="dm-line-sub">{variant}</span> : null}
                            </td>
                            <td className="c-qty">{fmtQty(qty)}</td>
                            <td className="c-unit">{money(unit, currency)}</td>
                            <td className="c-total">{money(lineTotal, currency)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="c-ref">{documentNumber}</td>
                        <td className="c-name">Aucun produit.</td>
                        <td className="c-qty">—</td>
                        <td className="c-unit">0,00 MAD</td>
                        <td className="c-total">0,00 MAD</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dm-totals-wrap">
                <div className="dm-totals">
                  <div className="dm-total-row">
                    <div className="dm-total-label">SOUS-TOTAL :</div>
                    <div className="dm-total-value">{money(summary.itemsSubtotal, currency)}</div>
                  </div>

                  {summary.discountAmount > 0 ? (
                    <div className="dm-total-row discount">
                      <div className="dm-total-label">
                        RÉDUCTION{discountText !== "—" ? ` (${discountText})` : ""} :
                      </div>
                      <div className="dm-total-value">
                        - {money(summary.discountAmount, currency)}
                      </div>
                    </div>
                  ) : null}

                  {discountLabelText ? (
                    <div className="dm-total-row">
                      <div className="dm-total-label">LIBELLÉ :</div>
                      <div className="dm-total-value">{discountLabelText}</div>
                    </div>
                  ) : null}

                  <div className="dm-total-row">
                    <div className="dm-total-label">LIVRAISON :</div>
                    <div className="dm-total-value">{money(summary.deliveryFee, currency)}</div>
                  </div>

                  <div className="dm-total-row strong">
                    <div className="dm-total-label">TOTAL :</div>
                    <div className="dm-total-value">{money(summary.total, currency)}</div>
                  </div>
                </div>
              </div>

              <div className="dm-receipt-bottom">
                <div>
                  <div className="dm-box">
                    <div className="dm-box-title">Paiement</div>
                    <div className="dm-box-text">{paymentLine || "—"}</div>
                  </div>

                  {cleanedNote ? (
                    <div className="dm-box" style={{ marginTop: 10, borderStyle: "dashed" }}>
                      <div className="dm-box-title">Note</div>
                      <div className="dm-box-text">{cleanedNote}</div>
                    </div>
                  ) : null}

                  <div className="dm-thanks">Merci pour votre commande — {shopName}</div>
                </div>

                <div className="dm-qr-box">
                  <QRCode value={verifyUrl || "https://duumini.com"} size={78} />
                  <div className="dm-qr-label">
                    Vérification
                    <br />
                    authenticité
                  </div>
                </div>
              </div>

              <div className="dm-footer-yellow">
                <div className="dm-footer-line">{shopName}</div>
                <div className="dm-footer-line">{slogan}</div>
                {!!hotlinePhone ? (
                  <div className="dm-footer-line">Hotline : {hotlinePhone}</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}