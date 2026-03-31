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
  const created = order?.created_at
    ? new Date(order.created_at).toLocaleString("fr-FR")
    : "—";

  const contact = order?.contact || order?.user || order || {};
  const fullName =
    `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
    contact?.name ||
    "—";
  const phone = contact?.phone || "—";

  const address = order?.address || {};
  const city = address?.city || address?.ville || "—";
  const commune = address?.commune || "—";
  const district = address?.district || address?.quartier || "—";
  const addressLine =
    address?.address_line ||
    address?.addressLine ||
    address?.adresse ||
    address?.address ||
    address?.street ||
    "—";

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

  const vendorCompany = order?.vendor_company || order?.shop || {};

  const companyLegalName =
    vendorCompany?.legal_name ||
    vendorCompany?.company_name ||
    "LE BESOIN GROUP SARL AU";

  const companyCommercialName =
    vendorCompany?.commercial_name || vendorCompany?.trade_name || "BC :";

  const companyAddress =
    vendorCompany?.address_line ||
    vendorCompany?.address ||
    vendorCompany?.adresse ||
    "46 Bd Zerktouni 2eme Etg Appt";

  const companyAddress2 =
    vendorCompany?.address_line_2 ||
    vendorCompany?.address2 ||
    vendorCompany?.complement_adresse ||
    "Co Stor Conseil";

  const companyIce =
    vendorCompany?.ice || vendorCompany?.ICE || "002641145000090";

  const companyPhone = vendorCompany?.phone || hotlinePhone || "";
  const companyEmail = vendorCompany?.email || "";

  const totalHT = Math.max(0, summary.discountedItemsAmount);
  const totalTTC = +(totalHT + summary.deliveryFee).toFixed(2);

  const companyInfoRows = [
    hasValue(companyCommercialName) ? String(companyCommercialName) : null,
    hasValue(companyAddress) ? String(companyAddress) : null,
    hasValue(companyAddress2) ? String(companyAddress2) : null,
    hasValue(companyIce) ? `ICE N° ${companyIce}` : null,
    hasValue(companyPhone) ? `Tél : ${companyPhone}` : null,
    hasValue(companyEmail) ? `Email : ${companyEmail}` : null,
  ].filter(Boolean);

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

  function waitImages(container: HTMLElement, timeoutMs = 1500) {
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
    await new Promise((r) => setTimeout(r, 60));

    document.body.classList.add("duu-printing");

    const after = () => {
      window.removeEventListener("afterprint", after);
      cleanupPrintRoot();
    };
    window.addEventListener("afterprint", after);

    setTimeout(() => {
      window.print();
      setTimeout(() => cleanupPrintRoot(), 1800);
    }, 50);
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
      await new Promise((r) => setTimeout(r, 60));

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
    { label: "Livraison", value: fBadge.text },
  ];

  return (
    <>
      <style>{`
        :root{
          --dm-yellow:#FFD000;
          --dm-yellow-soft:#FFF7CC;
          --dm-black:#111111;
          --dm-text:#141414;
          --dm-muted:#667085;
          --dm-soft:#F8F9FB;
          --dm-line:#EAECF0;
          --dm-line-dark:#D0D5DD;
          --dm-danger:#D92D20;
          --dm-success:#12B76A;
        }

        .dm-r-wrap{
          width:${isVendorView ? "1000px" : "1000px"};
          max-width:100%;
          margin:0 auto;
          font-family:Inter, Arial, Helvetica, sans-serif;
          color:var(--dm-text);
        }

        .dm-r-paper{
          background:#fff;
          border:1px solid rgba(17,17,17,.06);
          border-radius:14px;
          overflow:hidden;
          box-shadow:0 8px 24px rgba(17,17,17,.06);
        }

        .dm-r-topbar{
          height:4px;
          background:linear-gradient(90deg, #FFD000 0%, #FFE04D 50%, #FFD000 100%);
        }

        .dm-r-header{
          padding:12px 16px 10px;
          border-bottom:1px solid var(--dm-line);
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

        .dm-r-brand-text{
          min-width:0;
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
          background:var(--dm-yellow-soft);
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

        .dm-r-grid-2{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:10px;
        }

        .dm-r-grid-main{
          display:grid;
          grid-template-columns:minmax(0, 1.35fr) minmax(290px, .9fr);
          gap:10px;
          align-items:start;
        }

        .dm-r-side-stack{
          display:grid;
          gap:10px;
        }

        .dm-r-panel{
          border:1px solid var(--dm-line);
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

        .dm-r-company-name{
          font-size:14px;
          font-weight:900;
          line-height:1.2;
        }

        .dm-r-company-lines{
          display:grid;
          gap:4px;
          margin-top:8px;
        }

        .dm-r-company-line{
          font-size:11px;
          line-height:1.3;
          color:#222;
          font-weight:600;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .dm-r-info-list{
          display:grid;
          gap:6px;
        }

        .dm-r-info-row{
          display:grid;
          grid-template-columns:90px 1fr;
          gap:8px;
          align-items:start;
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

        .dm-r-v-danger{
          color:var(--dm-danger);
        }

        .dm-r-v-success{
          color:var(--dm-success);
        }

        .dm-r-section{
          margin-top:10px;
        }

        .dm-r-section:first-child{
          margin-top:0;
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
          border:1px solid var(--dm-line);
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
          border-bottom:1px solid var(--dm-line);
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
          border:1px solid var(--dm-line);
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
          border-bottom:1px solid var(--dm-line);
        }

        .dm-r-total-row{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:10px;
          padding:8px 10px;
          border-bottom:1px solid var(--dm-line);
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

        .dm-r-total-row-strong{
          background:#FFFDF2;
        }

        .dm-r-total-row-strong .label,
        .dm-r-total-row-strong .value{
          font-size:12px;
          font-weight:900;
          color:#111;
        }

        .dm-r-note-box{
          border:1px dashed var(--dm-line-dark);
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

        .dm-r-mini-grid{
          display:grid;
          grid-template-columns:1fr 1fr 1fr;
          gap:6px 12px;
        }

        .dm-r-mini-row{
          display:grid;
          grid-template-columns:72px 1fr;
          gap:6px;
          align-items:start;
          min-width:0;
        }

        .dm-r-payment-box{
          border:1px solid var(--dm-line);
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

        .dm-r-bottom{
          margin-top:10px;
          display:grid;
          grid-template-columns:1fr 88px;
          gap:10px;
          align-items:end;
        }

        .dm-r-footer{
          border-top:1px solid var(--dm-line);
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
          border:1px solid var(--dm-line);
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

        @media (max-width: 900px){
          .dm-r-wrap{
            width:100%;
          }

          .dm-r-grid-2,
          .dm-r-grid-main,
          .dm-r-mini-grid,
          .dm-r-bottom{
            grid-template-columns:1fr;
          }

          .dm-r-head-main{
            grid-template-columns:1fr;
          }

          .dm-r-meta{
            text-align:left;
            min-width:0;
          }
        }

        @media (max-width: 640px){
          .dm-r-header{
            padding:12px;
          }

          .dm-r-body{
            padding:12px;
          }

          .dm-r-name,
          .dm-r-doc-title{
            font-size:16px;
          }

          .dm-r-table th,
          .dm-r-table td{
            padding:6px;
          }

          .dm-r-info-row,
          .dm-r-mini-row{
            grid-template-columns:78px 1fr;
          }

          .dm-r-logo{
            width:40px;
            height:40px;
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
            margin:8mm;
          }

          html, body{
            background:#fff !important;
          }

          *{
            -webkit-print-color-adjust:exact !important;
            print-color-adjust:exact !important;
          }

          #duu-print-root{
            width:100% !important;
            max-width:100% !important;
          }

          #duu-print-root .dm-r-paper{
            border:none !important;
            border-radius:0 !important;
            box-shadow:none !important;
          }

          #duu-print-root .dm-no-print{
            display:none !important;
          }

          #duu-print-root .dm-r-wrap{
            width:100% !important;
            max-width:100% !important;
          }

          #duu-print-root .dm-r-header{
            padding:10px 12px 8px !important;
          }

          #duu-print-root .dm-r-body{
            padding:10px 12px 10px !important;
            font-size:10px !important;
          }

          #duu-print-root .dm-r-grid-2,
          #duu-print-root .dm-r-grid-main{
            gap:8px !important;
          }

          #duu-print-root .dm-r-panel,
          #duu-print-root .dm-r-payment-box,
          #duu-print-root .dm-r-note-box,
          #duu-print-root .dm-r-totals{
            break-inside:avoid;
            page-break-inside:avoid;
          }

          #duu-print-root .dm-r-table-wrap{
            break-inside:auto;
            page-break-inside:auto;
          }

          #duu-print-root .dm-r-bottom{
            margin-top:8px !important;
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

                <div className="dm-r-brand-text">
                  <div className="dm-r-name">{shopName}</div>
                  <div className="dm-r-slogan">{slogan}</div>
                </div>
              </div>

              <div className="dm-r-meta">
                <div className="dm-r-badge">
                  Vue {viewerRoleLabel(viewerRole)}
                  {isImpersonating ? " • IMPERSONATION" : ""}
                </div>

                <div className="dm-r-doc-title">
                  {isVendorView ? "FACTURE" : "REÇU"}
                </div>

                <div className="dm-r-doc-sub">
                  N° {code}
                  <br />
                  {created}
                  {!isVendorView && !!hotlinePhone ? (
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
            {isVendorView ? (
              <>
                <div className="dm-r-grid-2">
                  <div className="dm-r-panel">
                    <div className="dm-r-panel-title">Entreprise</div>
                    <div className="dm-r-company-name">{companyLegalName}</div>

                    {companyInfoRows.length ? (
                      <div className="dm-r-company-lines">
                        {companyInfoRows.map((line, idx) => (
                          <div className="dm-r-company-line" key={idx}>
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="dm-r-panel dm-r-panel-soft">
                    <div className="dm-r-panel-title">Facturation</div>

                    <div className="dm-r-info-list">
                      <div className="dm-r-info-row">
                        <div className="dm-r-k">Facture N°</div>
                        <div className="dm-r-v">{code}</div>
                      </div>
                      <div className="dm-r-info-row">
                        <div className="dm-r-k">Date</div>
                        <div className="dm-r-v">{created}</div>
                      </div>
                      <div className="dm-r-info-row">
                        <div className="dm-r-k">Client</div>
                        <div className="dm-r-v">{fullName}</div>
                      </div>
                      <div className="dm-r-info-row">
                        <div className="dm-r-k">Téléphone</div>
                        <div className="dm-r-v">{String(phone)}</div>
                      </div>
                      <div className="dm-r-info-row">
                        <div className="dm-r-k">Ville</div>
                        <div className="dm-r-v">{city}</div>
                      </div>
                      <div className="dm-r-info-row">
                        <div className="dm-r-k">Adresse</div>
                        <div className="dm-r-v">{addressLine}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dm-r-grid-main">
                  <div className="dm-r-section" style={{ marginTop: 0 }}>
                    <div className="dm-r-section-title">Produits facturés</div>

                    <div className="dm-r-table-wrap">
                      <table className="dm-r-table">
                        <thead>
                          <tr>
                            <th>Désignation</th>
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
                              const unit = Number(it.unit_price || it.price || 0);
                              const lineTotal = +(qty * unit).toFixed(2);

                              return (
                                <tr key={idx}>
                                  <td>
                                    <div className="dm-r-line-name">
                                      {displayName}
                                    </div>
                                  </td>
                                  <td className="num">{qty}</td>
                                  <td className="num">{money(unit, currency)}</td>
                                  <td className="num">
                                    {money(lineTotal, currency)}
                                  </td>
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
                      <div className="dm-r-totals-head">Résumé financier</div>

                      <div className="dm-r-total-row">
                        <div className="label">Sous-total</div>
                        <div className="value">
                          {money(summary.itemsSubtotal, currency)}
                        </div>
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
                              - {money(summary.discountAmount, currency)}
                            </div>
                          </div>

                          <div className="dm-r-total-row">
                            <div className="label">Après réduction</div>
                            <div className="value dm-r-v-success">
                              {money(summary.discountedItemsAmount, currency)}
                            </div>
                          </div>
                        </>
                      ) : null}

                      <div className="dm-r-total-row">
                        <div className="label">Livraison</div>
                        <div className="value">
                          {money(summary.deliveryFee, currency)}
                        </div>
                      </div>

                      <div className="dm-r-total-row dm-r-total-row-strong">
                        <div className="label">TOTAL TTC</div>
                        <div className="value">{money(totalTTC, currency)}</div>
                      </div>

                      <div className="dm-r-total-row">
                        <div className="label">Règlement</div>
                        <div className="value">{paymentLine || "—"}</div>
                      </div>
                    </div>

                    {pay?.note ? (
                      <div className="dm-r-note-box">
                        <div className="dm-r-note-title">Note</div>
                        <div className="dm-r-note-body">{String(pay.note)}</div>
                      </div>
                    ) : (
                      <div className="dm-r-note-box">
                        <div className="dm-r-note-title">Informations</div>
                        <div className="dm-r-note-body">
                          Document généré automatiquement par Duumini.
                          {"\n"}
                          TVA non appliquée pour le moment.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
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

                <div className="dm-r-grid-main" style={{ marginTop: 10 }}>
                  <div className="dm-r-section" style={{ marginTop: 0 }}>
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
                              const unit = Number(it.unit_price || it.price || 0);
                              const lineTotal = +(qty * unit).toFixed(2);

                              return (
                                <tr key={idx}>
                                  <td>
                                    <div className="dm-r-line-name">
                                      {displayName}
                                    </div>
                                  </td>
                                  <td className="num">{qty}</td>
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

                    {pay?.note ? (
                      <div className="dm-r-note-box">
                        <div className="dm-r-note-title">Note</div>
                        <div className="dm-r-note-body">{String(pay.note)}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            <div className="dm-r-bottom">
              <div className="dm-r-footer">
                <div className="dm-r-footer-main">
                  {isVendorView
                    ? "Reçu — Duumini"
                    : "Merci pour votre commande — Duumini"}
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
      </div>
    </>
  );
}