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

  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

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
  const landmark =
    address?.landmark ||
    address?.repere ||
    address?.reference ||
    address?.note ||
    null;

  const f = normFulfillment(order);
  const fBadge = fulfillmentLabel(f);

  const { itemsAmount, deliveryFee, total, duuShare, vendorNet } =
    computeOrderAmounts(order);
  const pay = getPaymentFromOrder(order);

  const paymentLine = [
    pay?.method ? `Méthode: ${String(pay.method)}` : null,
    `Payé: ${mad(pay?.paid_amount || 0)}`,
  ]
    .filter(Boolean)
    .join(" • ");

  const summary = useMemo(
    () => ({ itemsAmount, deliveryFee, total, duuShare, vendorNet }),
    [itemsAmount, deliveryFee, total, duuShare, vendorNet]
  );

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

      const filename = `Recu-${code}.png`;
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
          --dm-yellow:#FFD000;
          --dm-black:#111111;
          --dm-muted: rgba(17,17,17,.65);
          --dm-line: rgba(0,0,0,.18);
        }

        .dm-r-wrap{
          width: 302px;
          max-width: 100%;
          margin: 0 auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #111;
        }

        .dm-r-paper{
          background: #fff;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 10px 26px rgba(0,0,0,.08);
        }

        .dm-r-top{
          padding: 12px 12px 10px;
          border-bottom: 1px dashed var(--dm-line);
        }

        .dm-r-brand{
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 8px;
        }

        .dm-r-logo{
          width: 44px;
          height: 44px;
          border-radius: 10px;
          overflow:hidden;
          border: 1px solid rgba(0,0,0,.14);
          background:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          flex: 0 0 auto;
        }

        .dm-r-logo img{
          width:100%;
          height:100%;
          object-fit:cover;
        }

        .dm-r-name{
          font-weight: 1000;
          letter-spacing: 1px;
          font-size: 16px;
          text-align:center;
          line-height: 1.1;
        }

        .dm-r-slogan{
          font-size: 10px;
          font-weight: 800;
          opacity: .8;
          text-align:center;
          margin-top: 2px;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .dm-r-meta{
          margin-top: 10px;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.35;
          text-align:center;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .dm-r-body{
          padding: 10px 12px 12px;
          font-size: 10px;
        }

        .dm-r-row{
          display:flex;
          justify-content:space-between;
          gap: 8px;
          padding: 3px 0;
        }

        .dm-r-k{
          opacity: .75;
          font-weight: 800;
          min-width: 74px;
        }

        .dm-r-v{
          text-align:right;
          font-weight: 900;
          max-width: 190px;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .dm-r-sep{
          border-top: 1px dashed var(--dm-line);
          margin: 10px 0;
        }

        .dm-r-items-title{
          font-weight: 1000;
          letter-spacing: .6px;
          font-size: 10px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .dm-r-item{
          padding: 6px 0;
          border-top: 1px dotted rgba(0,0,0,.12);
        }

        .dm-r-item:first-of-type{
          border-top:none;
        }

        .dm-r-item-name{
          font-weight: 1000;
          line-height: 1.2;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .dm-r-item-sub{
          display:flex;
          justify-content:space-between;
          gap: 8px;
          margin-top: 2px;
          opacity: .85;
          font-weight: 800;
        }

        .dm-r-total{
          display:flex;
          justify-content:space-between;
          gap: 8px;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: .3px;
          margin-top: 6px;
        }

        .dm-r-qr{
          display:flex;
          flex-direction:column;
          align-items:center;
          gap: 6px;
          padding: 10px 0 0;
        }

        .dm-r-qrtext{
          font-weight: 900;
          opacity: .85;
          text-align:center;
        }

        .dm-r-footer{
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed var(--dm-line);
          text-align:center;
          font-weight: 900;
          opacity: .8;
        }

        .dm-actions{
          margin-bottom: 10px;
          display:flex;
          gap: 8px;
          justify-content:center;
          flex-wrap: wrap;
        }

        .dm-btn{
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 1000;
          font-size: 12px;
          cursor:pointer;
          border: 1px solid var(--dm-black);
          background: var(--dm-black);
          color: var(--dm-yellow);
          width: 100%;
          max-width: 302px;
        }

        .dm-btn-ghost{
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 1000;
          font-size: 12px;
          cursor:pointer;
          border: 1px solid rgba(0,0,0,.16);
          background: #fff;
          color: var(--dm-black);
          width: 100%;
          max-width: 302px;
        }

        .dm-btn:disabled,
        .dm-btn-ghost:disabled{
          opacity: .6;
          cursor: not-allowed;
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

          #duu-print-root .dm-r-paper{
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          #duu-print-root,
          #duu-print-root *{
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #duu-print-root .dm-no-print{
            display:none !important;
          }
        }
      `}</style>

      <div className="dm-r-wrap">
        {!hidePrintButton ? (
          <div className="dm-actions dm-no-print">
            <button className="dm-btn" type="button" onClick={printTicket}>
              Imprimer le reçu (80mm)
            </button>

            <button
              className="dm-btn-ghost"
              type="button"
              onClick={shareTicketAsImage}
              disabled={sharing}
              title="Ouvre le menu Partager du téléphone (WhatsApp, etc.)"
            >
              {sharing ? "Préparation…" : "Partager WhatsApp (image)"}
            </button>
          </div>
        ) : null}

        <div ref={receiptRef} className="dm-r-paper">
          <div className="dm-r-top">
            <div className="dm-r-brand">
              <div className="dm-r-logo">
                <img
                  src={logoSrc}
                  alt={shopName}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <div className="dm-r-name">{shopName}</div>
            <div className="dm-r-slogan">{slogan}</div>

            <div className="dm-r-meta">
              <div>
                <b>REÇU</b> • #{code}
              </div>
              <div>{created}</div>
              {!!hotlinePhone && <div>Hotline: {hotlinePhone}</div>}
            </div>
          </div>

          <div className="dm-r-body">
            <div className="dm-r-row">
              <div className="dm-r-k">Client</div>
              <div className="dm-r-v">{fullName}</div>
            </div>
            <div className="dm-r-row">
              <div className="dm-r-k">Téléphone</div>
              <div className="dm-r-v">{String(phone)}</div>
            </div>
            <div className="dm-r-row">
              <div className="dm-r-k">Ville</div>
              <div className="dm-r-v">{city}</div>
            </div>
            <div className="dm-r-row">
              <div className="dm-r-k">Commune</div>
              <div className="dm-r-v">{commune}</div>
            </div>
            <div className="dm-r-row">
              <div className="dm-r-k">Quartier</div>
              <div className="dm-r-v">{district}</div>
            </div>
            <div className="dm-r-row">
              <div className="dm-r-k">Adresse</div>
              <div className="dm-r-v">{addressLine}</div>
            </div>
            {landmark ? (
              <div className="dm-r-row">
                <div className="dm-r-k">Repère</div>
                <div className="dm-r-v">{landmark}</div>
              </div>
            ) : null}
            <div className="dm-r-row">
              <div className="dm-r-k">Livraison</div>
              <div className="dm-r-v">{fBadge.text}</div>
            </div>

            <div className="dm-r-sep" />

            <div className="dm-r-items-title">Détails produits</div>

            {Array.isArray(order?.items) && order.items.length ? (
              order.items.map((it: any, idx: number) => {
                const name =
                  it.product_name || it.name || `Produit #${it.product_id}`;
                const variant = [it.variant_size, it.variant_color]
                  .filter(Boolean)
                  .join(" / ");
                const displayName = variant ? `${name} (${variant})` : name;

                const qty = Number(it.qty || 1);
                const unit = Number(it.unit_price || it.price || 0);
                const lineTotal = qty * unit;

                return (
                  <div className="dm-r-item" key={idx}>
                    <div className="dm-r-item-name">{displayName}</div>
                    <div className="dm-r-item-sub">
                      <div>
                        {mad(unit)} × {qty}
                      </div>
                      <div style={{ fontWeight: 1000 }}>{mad(lineTotal)}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "6px 0", opacity: 0.7 }}>
                Aucun produit.
              </div>
            )}

            <div className="dm-r-sep" />

            <div className="dm-r-row">
              <div className="dm-r-k">Sous-total</div>
              <div className="dm-r-v">{mad(summary.itemsAmount)}</div>
            </div>
            <div className="dm-r-row">
              <div className="dm-r-k">Livraison</div>
              <div className="dm-r-v">{mad(summary.deliveryFee)}</div>
            </div>

            <div className="dm-r-total">
              <div>TOTAL</div>
              <div>{mad(summary.total)}</div>
            </div>

            <div className="dm-r-sep" />

            <div className="dm-r-row">
              <div className="dm-r-k">Paiement</div>
              <div className="dm-r-v">{paymentLine || "—"}</div>
            </div>
            {pay?.note ? (
              <div className="dm-r-row">
                <div className="dm-r-k">Note</div>
                <div className="dm-r-v">{String(pay.note)}</div>
              </div>
            ) : null}

            <div className="dm-r-sep" />

            <div className="dm-r-qr">
              <QRCode value={verifyUrl || "https://duumini.com"} size={110} />
              <div className="dm-r-qrtext">
                Scanner pour vérifier l’authenticité
              </div>
            </div>

            <div className="dm-r-footer">
              Merci pour votre commande — Duumini
              <div style={{ marginTop: 6, fontSize: 9, opacity: 0.7 }}>
                • Net vendeur: {mad(summary.vendorNet)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}