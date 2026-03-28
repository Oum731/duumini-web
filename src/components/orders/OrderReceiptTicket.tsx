// src/components/ordersAdmin/OrderReceipt.tsx
import { useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import type { OrderDetail } from "../../services/orders";
import { getOrderReceiptPdfUrl } from "../../services/orders";
import { API_BASE } from "../../services/http";

type Props = {
  order: OrderDetail;
  slogan?: string;
  hotlinePhone?: string;
  publicWebBase?: string;
  logoSrc?: string;
  showPdfButton?: boolean;
  shareLabel?: string;
};

function absUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

function safeUpper(v: any) {
  return String(v || "").trim().toUpperCase();
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(n?: number | null, currency = "MAD") {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return `${v.toFixed(2)} ${currency}`;
}

function pickPaymentMode(method?: string | null) {
  const m = safeUpper(method);
  if (!m) return "—";
  if (m === "CASH" || m === "COD") return "Cash";
  if (
    m === "VIREMENT" ||
    m === "BANK_TRANSFER" ||
    m === "BANK" ||
    m === "TRANSFER"
  ) {
    return "Virement";
  }
  if (m === "DEPOT_VENTE" || m === "DEPOT" || m === "CONSIGNMENT") {
    return "Dépôt vente";
  }
  return m;
}

function pickPayStatus(s?: string | null) {
  const v = safeUpper(s);
  if (!v) return "—";
  if (v === "PAID") return "Payé";
  if (v === "UNPAID") return "Non payé";
  if (v === "PARTIAL") return "Partiel";
  if (v === "PENDING") return "En attente";
  return v;
}

function formatDateFR(input?: string) {
  const d = input ? new Date(input) : new Date();
  try {
    return d.toLocaleString("fr-FR");
  } catch {
    return String(input || "");
  }
}

function buildVerifyUrl(order: any, publicWebBase?: string) {
  const base =
    (publicWebBase || "").trim().replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const token = order?.receipt_token ? String(order.receipt_token) : null;
  if (!token) return base;

  return `${base}/r/${encodeURIComponent(token)}`;
}

function receiptNumberOf(order: any) {
  const v = order?.receipt_number ? String(order.receipt_number) : null;
  if (v) return v;

  const id = Number(order?.id || 0);
  const y = new Date(order?.created_at || Date.now()).getFullYear();
  return id ? `DM-${y}-${String(id).padStart(6, "0")}` : "DM-—";
}

function reductionLabel(adminDiscount: any, currency: string) {
  const type = safeUpper(adminDiscount?.type);
  const value = num(adminDiscount?.value, 0);

  if (!value || type === "NONE") return "—";
  if (type === "PERCENT") return `${value}%`;
  if (type === "AMOUNT") return `${value} ${currency}`;
  return "—";
}

export default function OrderReceipt({
  order,
  slogan = "Les goûts de ton pays, partout où tu te trouves",
  hotlinePhone = "",
  publicWebBase,
  logoSrc = "/logo.jpeg",
  showPdfButton = true,
  shareLabel = "Partager WhatsApp (image)",
}: Props) {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

  const currency = String(
    order?.totals?.currency || order?.currency || "MAD"
  ).toUpperCase();

  const receiptNumber = receiptNumberOf(order);
  const dateLabel = formatDateFR(order?.created_at);

  const contact = (order as any)?.contact || (order as any)?.user || null;
  const fullName =
    `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() ||
    contact?.name ||
    "Client";
  const phone = contact?.phone || "—";

  const addr = (order as any)?.address || {};
  const city = addr?.city || addr?.ville || "—";
  const commune = addr?.commune || "—";
  const district = addr?.district || addr?.quartier || "—";
  const addressLine =
    addr?.address_line ||
    addr?.addressLine ||
    addr?.adresse ||
    addr?.address ||
    "—";
  const landmark =
    addr?.landmark ||
    addr?.repere ||
    addr?.reference ||
    addr?.note ||
    null;

  const deliveryMode = safeUpper(
    (order as any)?.delivery?.mode ||
      (order as any)?.delivery_mode ||
      (order as any)?.fulfillment ||
      ""
  );

  const items = Array.isArray(order?.items) ? order.items : [];
  const totals: any = (order as any)?.totals || {};
  const adminDiscount: any = (order as any)?.admin_discount || {};
  const payment = (order as any)?.payment || null;

  const itemsSubtotal = num(
    totals?.items_subtotal,
    items.reduce((sum: number, it: any) => {
      const qty = num(it?.qty, 1);
      const baseUnit = num(it?.base_unit_price ?? it?.unit_price ?? it?.price, 0);
      return sum + qty * baseUnit;
    }, 0)
  );

  const discountAmount = num(
    adminDiscount?.amount,
    totals?.admin_discount_amount
  );

  const discountText = reductionLabel(adminDiscount, currency);

  const discountedItemsAmount = num(
    totals?.discounted_items_amount,
    Math.max(0, itemsSubtotal - discountAmount)
  );

  const deliveryFee = num(totals?.delivery_fee, 0);

  const totalAmount = num(
    totals?.amount ?? (order as any)?.total,
    discountedItemsAmount + deliveryFee
  );

  const paidAmount = num(
    payment?.paid_amount ?? (order as any)?.paid_amount,
    0
  );

  const remainingAmount = num(
    payment?.remaining_amount ?? (order as any)?.remaining_amount,
    Math.max(0, totalAmount - paidAmount)
  );

  const payMode = pickPaymentMode(payment?.method ?? null);
  const payStatus = pickPayStatus(
    payment?.status ?? (order as any)?.payment_status ?? null
  );

  const verifyUrl = useMemo(
    () => buildVerifyUrl(order, publicWebBase),
    [order, publicWebBase]
  );

  const pdfHref = useMemo(() => {
    const id = Number((order as any)?.id || 0);
    if (!id) return "";
    return absUrl(getOrderReceiptPdfUrl(id));
  }, [order]);

  function cleanupPrintRoot() {
    document.body.classList.remove("duu-printing");
    const root = document.getElementById("duu-print-root");
    if (root) root.remove();
  }

  function waitImages(container: HTMLElement, timeoutMs = 1500) {
    const imgs = Array.from(
      container.querySelectorAll("img")
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

      const filename = `Recu-${receiptNumber}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });

      const nav: any = navigator as any;

      if (nav?.share && (!nav?.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: "Reçu Duumini",
          text: "Reçu.",
          files: [file],
        });
        return;
      }

      await downloadDataUrl(dataUrl, filename);
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <style>{`
        :root{
          --dm-yellow: #FFD000;
          --dm-yellow2:#FFB800;
          --dm-black: #111111;
          --dm-border:#EEEEEE;
          --dm-muted: rgba(17,17,17,.65);
          --dm-danger:#d92d20;
          --dm-success:#0f8f4f;
        }

        .dm-ticket-wrap{
          width: 302px;
          max-width: 100%;
          margin: 0 auto;
          color: var(--dm-black);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }

        .dm-ticket{
          border: 1px solid var(--dm-border);
          border-radius: 16px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 10px 28px rgba(0,0,0,.08);
        }

        .dm-header{
          background: linear-gradient(135deg, var(--dm-yellow) 0%, var(--dm-yellow2) 100%);
          padding: 14px 14px 12px;
        }

        .dm-brand{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }

        .dm-brand-left{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
        }

        .dm-logo{
          width: 44px;
          height: 44px;
          border-radius: 12px;
          overflow: hidden;
          background:#fff;
          border:1px solid rgba(0,0,0,.18);
          display:flex;
          align-items:center;
          justify-content:center;
          flex: 0 0 auto;
        }

        .dm-logo img{
          width:100%;
          height:100%;
          object-fit: cover;
        }

        .dm-title{
          font-weight: 1000;
          letter-spacing: .6px;
          font-size: 16px;
          line-height: 1.1;
          margin: 0;
        }

        .dm-subtitle{
          margin-top: 2px;
          font-size: 11px;
          font-weight: 800;
          opacity: .9;
          line-height: 1.15;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .dm-receipt-box{
          text-align:right;
          flex: 0 0 auto;
        }

        .dm-receipt-label{
          font-size: 10px;
          font-weight: 1000;
          opacity: .85;
          letter-spacing: .8px;
        }

        .dm-receipt-no{
          font-size: 13px;
          font-weight: 1000;
          margin-top: 2px;
        }

        .dm-receipt-date{
          font-size: 10px;
          font-weight: 800;
          opacity: .85;
          margin-top: 2px;
        }

        .dm-meta{
          margin-top: 10px;
          display:flex;
          flex-direction:column;
          gap: 2px;
          font-size: 11px;
          font-weight: 900;
          word-break: break-word;
          overflow-wrap:anywhere;
        }

        .dm-body{
          padding: 14px;
        }

        .dm-section{
          margin-top: 10px;
        }

        .dm-section-title{
          display:flex;
          align-items:center;
          gap: 8px;
          font-weight: 1000;
          font-size: 12px;
          margin: 0 0 8px;
        }

        .dm-dot{
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--dm-yellow);
          box-shadow: 0 0 0 3px rgba(255,208,0,.25);
        }

        .dm-card{
          border:1px solid var(--dm-border);
          border-radius: 14px;
          padding: 10px;
          background:#fff;
        }

        .dm-row{
          display:flex;
          justify-content:space-between;
          gap: 10px;
          padding: 3px 0;
          font-size: 11px;
        }

        .dm-k{
          font-weight: 900;
          color: var(--dm-muted);
          min-width: 86px;
        }

        .dm-v{
          font-weight: 1000;
          text-align:right;
          word-break: break-word;
          overflow-wrap:anywhere;
          max-width: 180px;
        }

        .dm-v-danger{ color: var(--dm-danger); }
        .dm-v-success{ color: var(--dm-success); }

        .dm-table{
          border:1px solid var(--dm-border);
          border-radius: 14px;
          overflow:hidden;
          background:#fff;
        }

        .dm-th{
          background: var(--dm-black);
          color: var(--dm-yellow);
          font-weight: 1000;
          font-size: 10px;
          padding: 8px 10px;
          display:grid;
          grid-template-columns: 1fr 36px 74px;
          gap: 8px;
        }

        .dm-tr{
          padding: 8px 10px;
          display:grid;
          grid-template-columns: 1fr 36px 74px;
          gap: 8px;
          border-top: 1px solid rgba(0,0,0,.06);
          font-size: 11px;
        }

        .dm-name{
          font-weight: 1000;
          line-height: 1.15;
          word-break: break-word;
          overflow-wrap:anywhere;
        }

        .dm-sub{
          font-size: 9px;
          font-weight: 900;
          color: rgba(17,17,17,.6);
          margin-top: 2px;
        }

        .dm-qty{ text-align:right; font-weight: 1000; }
        .dm-line{ text-align:right; font-weight: 1000; }

        .dm-totals{
          margin-top: 10px;
          border-top: 1px dashed rgba(0,0,0,.22);
          padding-top: 10px;
        }

        .dm-total{
          display:flex;
          justify-content:space-between;
          margin-top: 8px;
          font-size: 13px;
          font-weight: 1000;
          padding-top: 6px;
          border-top: 1px dashed rgba(0,0,0,.18);
        }

        .dm-qr{
          display:grid;
          grid-template-columns: 118px 1fr;
          gap: 10px;
          align-items:center;
        }

        .dm-qrbox{
          border:1px solid var(--dm-border);
          border-radius: 14px;
          padding: 10px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#fff;
        }

        .dm-qrtext{
          font-weight: 1000;
          font-size: 11px;
          line-height: 1.15;
        }

        .dm-qrurl{
          margin-top: 6px;
          font-size: 9px;
          font-weight: 900;
          opacity: .7;
          word-break: break-all;
        }

        .dm-footer{
          margin-top: 10px;
          text-align:center;
          font-size: 10px;
          font-weight: 900;
          opacity: .75;
        }

        .dm-actions{
          margin-top: 12px;
          display:flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .dm-btn{
          flex:1;
          border-radius: 12px;
          padding: 10px 10px;
          font-weight: 1000;
          font-size: 12px;
          cursor:pointer;
          border: 1px solid var(--dm-black);
          background: var(--dm-black);
          color: var(--dm-yellow);
        }

        .dm-btn-outline{
          flex:1;
          border-radius: 12px;
          padding: 10px 10px;
          font-weight: 1000;
          font-size: 12px;
          cursor:pointer;
          border: 1px solid var(--dm-black);
          background: #fff;
          color: var(--dm-black);
          text-align:center;
          text-decoration:none;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        @media print{
          body.duu-printing > *:not(#duu-print-root){
            display:none !important;
          }
          body.duu-printing #duu-print-root{
            display:block !important;
          }

          @page { size: 80mm auto; margin: 4mm; }

          *{
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #duu-print-root{
            width: 80mm !important;
            max-width: 80mm !important;
          }

          #duu-print-root .dm-ticket{
            border:none !important;
            border-radius:0 !important;
            box-shadow:none !important;
          }

          #duu-print-root, #duu-print-root *{
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #duu-print-root .dm-no-print{
            display:none !important;
          }
        }
      `}</style>

      <div className="dm-ticket-wrap">
        <div ref={receiptRef} className="dm-ticket">
          <div className="dm-header">
            <div className="dm-brand">
              <div className="dm-brand-left">
                <div className="dm-logo">
                  <img
                    src={logoSrc}
                    alt="Duumini"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="dm-title">DUUMINI</div>
                  <div className="dm-subtitle">{slogan}</div>
                </div>
              </div>

              <div className="dm-receipt-box">
                <div className="dm-receipt-label">REÇU</div>
                <div className="dm-receipt-no">{receiptNumber}</div>
                <div className="dm-receipt-date">{dateLabel}</div>
              </div>
            </div>

            <div className="dm-meta">
              <div>Ville : {city}</div>
              {!!hotlinePhone && <div>Téléphone : {hotlinePhone}</div>}
            </div>
          </div>

          <div className="dm-body">
            <div className="dm-section">
              <div className="dm-section-title">
                <span className="dm-dot" /> 🧾 Informations
              </div>
              <div className="dm-card">
                <div className="dm-row">
                  <div className="dm-k">Client</div>
                  <div className="dm-v">{fullName}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Téléphone</div>
                  <div className="dm-v">{phone}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Ville</div>
                  <div className="dm-v">{city}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Commune</div>
                  <div className="dm-v">{commune}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Quartier</div>
                  <div className="dm-v">{district}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Adresse</div>
                  <div className="dm-v">{addressLine}</div>
                </div>
                {landmark ? (
                  <div className="dm-row">
                    <div className="dm-k">Repère</div>
                    <div className="dm-v">{landmark}</div>
                  </div>
                ) : null}
                {deliveryMode ? (
                  <div className="dm-row">
                    <div className="dm-k">Livraison</div>
                    <div className="dm-v">{deliveryMode}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="dm-section">
              <div className="dm-section-title">
                <span className="dm-dot" /> 📦 Détails produits
              </div>

              <div className="dm-table">
                <div className="dm-th">
                  <div>Produit</div>
                  <div style={{ textAlign: "right" }}>Qté</div>
                  <div style={{ textAlign: "right" }}>Total</div>
                </div>

                {items.length ? (
                  items.map((it: any, idx: number) => {
                    const name =
                      it.product_name || it.name || `Produit #${it.product_id}`;
                    const variant = [it.variant_size, it.variant_color]
                      .filter(Boolean)
                      .join(" / ");
                    const displayName = variant ? `${name} (${variant})` : name;

                    const qty = num(it?.qty, 1);
                    const unit = num(it?.unit_price ?? it?.price, 0);
                    const lineTotal = qty * unit;

                    return (
                      <div className="dm-tr" key={idx}>
                        <div>
                          <div className="dm-name">{displayName}</div>
                          <div className="dm-sub">
                            {money(unit, currency)} × {qty}
                          </div>
                        </div>
                        <div className="dm-qty">{qty}</div>
                        <div className="dm-line">{money(lineTotal, currency)}</div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: 10, fontSize: 11, opacity: 0.7 }}>
                    Aucun produit.
                  </div>
                )}
              </div>

              <div className="dm-totals">
                <div className="dm-row">
                  <div className="dm-k">Sous-total</div>
                  <div className="dm-v">{money(itemsSubtotal, currency)}</div>
                </div>

                {discountAmount > 0 && (
                  <>
                    <div className="dm-row">
                      <div className="dm-k">Réduction</div>
                      <div className="dm-v dm-v-danger">{discountText}</div>
                    </div>

                    <div className="dm-row">
                      <div className="dm-k">Montant réduit</div>
                      <div className="dm-v dm-v-danger">
                        - {money(discountAmount, currency)}
                      </div>
                    </div>

                    <div className="dm-row">
                      <div className="dm-k">Après réduction</div>
                      <div className="dm-v dm-v-success">
                        {money(discountedItemsAmount, currency)}
                      </div>
                    </div>
                  </>
                )}

                <div className="dm-row">
                  <div className="dm-k">Livraison</div>
                  <div className="dm-v">{money(deliveryFee, currency)}</div>
                </div>

                <div className="dm-total">
                  <div>TOTAL</div>
                  <div>{money(totalAmount, currency)}</div>
                </div>
              </div>
            </div>

            <div className="dm-section">
              <div className="dm-section-title">
                <span className="dm-dot" /> 💰 Paiement
              </div>
              <div className="dm-card">
                <div className="dm-row">
                  <div className="dm-k">Méthode</div>
                  <div className="dm-v">{payMode}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Statut</div>
                  <div className="dm-v">{payStatus}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Payé</div>
                  <div className="dm-v">{money(paidAmount, currency)}</div>
                </div>
                <div className="dm-row">
                  <div className="dm-k">Reste</div>
                  <div className="dm-v">{money(remainingAmount, currency)}</div>
                </div>
                {payment?.note ? (
                  <div className="dm-row">
                    <div className="dm-k">Note</div>
                    <div className="dm-v">{String(payment.note)}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="dm-section">
              <div className="dm-section-title">
                <span className="dm-dot" /> 📲 QR Code
              </div>

              <div className="dm-card">
                <div className="dm-qr">
                  <div className="dm-qrbox">
                    <QRCode value={verifyUrl || "https://duumini.com"} size={110} />
                  </div>
                  <div>
                    <div className="dm-qrtext">
                      Scanner pour vérifier l’authenticité
                    </div>
                    <div className="dm-qrurl">{verifyUrl}</div>
                  </div>
                </div>
              </div>

              <div className="dm-footer">
                Merci pour votre commande — Duumini
              </div>

              <div className="dm-actions dm-no-print">
                <button className="dm-btn" type="button" onClick={printTicket}>
                  Imprimer
                </button>

                <button
                  className="dm-btn"
                  type="button"
                  onClick={shareTicketAsImage}
                  disabled={sharing}
                >
                  {sharing ? "Préparation…" : shareLabel}
                </button>

                {showPdfButton && pdfHref ? (
                  <a
                    className="dm-btn-outline"
                    href={pdfHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}