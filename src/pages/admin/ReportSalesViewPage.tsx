import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toBlob, toPng } from "html-to-image";
import { getSalesReport, type SalesReport } from "../../services/reports";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (String(iso).length <= 10) return d.toLocaleDateString("fr-FR");
  return d.toLocaleString("fr-FR");
}

function safeErrorMessage(e: any) {
  return e?.response?.data?.error || e?.message || "Erreur";
}

function money(n?: number | null, currency = "MAD") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

function parseJson(value: any) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ReportSalesViewPage() {
  const { id } = useParams();
  const reportId = Number(id);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"share" | "wa" | "print" | null>(null);

  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!Number.isFinite(reportId) || reportId <= 0) {
      setError("ID invalide");
      setReport(null);
      return;
    }

    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getSalesReport(reportId);
        if (!mounted) return;
        setReport(r || null);
      } catch (e: any) {
        if (!mounted) return;
        setReport(null);
        setError(safeErrorMessage(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [reportId]);

  const details = useMemo(() => parseJson(report?.details_json), [report]);

  const paymentBreakdown = useMemo(() => {
    return Array.isArray(details?.payment_breakdown) ? details.payment_breakdown : [];
  }, [details]);

  const grossItemsAmount = useMemo(() => {
    return num(
      details?.gross_items_amount ??
        details?.gross_products_amount ??
        details?.items_subtotal
    );
  }, [details]);

  const adminDiscountAmount = useMemo(() => {
    return num(
      details?.admin_discount_amount ??
        details?.discount_amount ??
        details?.reduction_amount
    );
  }, [details]);

  const netItemsAmount = useMemo(() => {
    const direct = num(
      details?.net_items_amount ??
        details?.discounted_items_amount
    );
    if (direct > 0) return direct;

    const reportItems = num(report?.items_amount);
    if (reportItems > 0) return reportItems;

    return Math.max(0, grossItemsAmount - adminDiscountAmount);
  }, [details, report, grossItemsAmount, adminDiscountAmount]);

  const paidAmount = useMemo(() => {
    if (!report) return 0;

    const directCandidates = [
      details?.paid_amount,
      details?.amount_paid,
      details?.paid_total,
      details?.total_paid,
      details?.encaisse,
      details?.sum_paid,
    ];

    for (const v of directCandidates) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }

    if (paymentBreakdown.length) {
      return paymentBreakdown.reduce((sum: number, row: any) => {
        return sum + num(row?.paid_amount);
      }, 0);
    }

    return 0;
  }, [report, details, paymentBreakdown]);

  const remainingAmount = useMemo(() => {
    if (!report) return 0;

    const directCandidates = [
      details?.remaining_amount,
      details?.rest_to_pay,
      details?.remaining,
      details?.amount_remaining,
      details?.reste_a_payer,
    ];

    for (const v of directCandidates) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }

    const total = num(report.total_amount);
    const remain = total - paidAmount;
    return remain > 0 ? remain : 0;
  }, [report, details, paidAmount]);

  const shareText = useMemo(() => {
    if (!report) return "";
    return [
      `DUUMINI - Rapport de ventes`,
      ``,
      `Réf : #${report.id}`,
      `Type : ${report.period_type}`,
      `Devise : ${report.currency}`,
      `Début : ${fmt(report.period_start)}`,
      `Fin : ${fmt(report.period_end)}`,
      ``,
      `Résumé des ventes`,
      `- Nombre de commandes : ${report.orders_count ?? 0}`,
      `- Montant produits brut : ${money(grossItemsAmount, report.currency)}`,
      `- Réduction admin : ${money(adminDiscountAmount, report.currency)}`,
      `- Montant produits net : ${money(netItemsAmount, report.currency)}`,
      `- Livraison : ${money(report.delivery_amount, report.currency)}`,
      `- Total ventes : ${money(report.total_amount, report.currency)}`,
      ``,
      `Résumé financier`,
      `- Commission Duumini : ${money(report.duumini_commission, report.currency)}`,
      `- Somme payée : ${money(paidAmount, report.currency)}`,
      `- Reste à payer : ${money(remainingAmount, report.currency)}`,
      ``,
      `Merci d’utiliser Duumini`,
    ].join("\n");
  }, [
    report,
    grossItemsAmount,
    adminDiscountAmount,
    netItemsAmount,
    paidAmount,
    remainingAmount,
  ]);

  const getReceiptFileName = () => {
    if (!report) return "duumini-rapport.png";
    return `duumini-rapport-${report.id}.png`;
  };

  const getNodeSize = (node: HTMLDivElement) => {
    const rect = node.getBoundingClientRect();
    const width = Math.max(
      Math.ceil(node.scrollWidth || 0),
      Math.ceil(node.offsetWidth || 0),
      Math.ceil(node.clientWidth || 0),
      Math.ceil(rect.width || 0),
      760
    );

    const height = Math.max(
      Math.ceil(node.scrollHeight || 0),
      Math.ceil(node.offsetHeight || 0),
      Math.ceil(node.clientHeight || 0),
      Math.ceil(rect.height || 0)
    );

    return { width, height };
  };

  const captureReceiptBlob = async (): Promise<Blob> => {
    const node = printRef.current;
    if (!node) throw new Error("Zone du reçu introuvable.");

    const { width, height } = getNodeSize(node);

    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      canvasWidth: width,
      canvasHeight: height,
      width,
      height,
      skipFonts: false,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        margin: "0",
        transform: "none",
      },
    });

    if (!blob) throw new Error("Impossible de générer l'image du reçu.");
    return blob;
  };

  const captureReceiptDataUrl = async (): Promise<string> => {
    const node = printRef.current;
    if (!node) throw new Error("Zone du reçu introuvable.");

    const { width, height } = getNodeSize(node);

    return await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      canvasWidth: width,
      canvasHeight: height,
      width,
      height,
      skipFonts: false,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        margin: "0",
        transform: "none",
      },
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const onPrint = async () => {
    if (!report) return;

    try {
      setBusyAction("print");
      const dataUrl = await captureReceiptDataUrl();

      const w = window.open("", "_blank", "width=1000,height=1400");
      if (!w) throw new Error("La fenêtre d'impression a été bloquée.");

      w.document.open();
      w.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Rapport #${report.id}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4 portrait;
                margin: 10mm;
              }

              * {
                box-sizing: border-box;
              }

              html, body {
                margin: 0;
                padding: 0;
                background: #fff;
                width: 100%;
                height: 100%;
              }

              body {
                display: flex;
                align-items: flex-start;
                justify-content: center;
              }

              .page {
                width: 190mm;
                height: 277mm;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                overflow: hidden;
                margin: 0 auto;
              }

              img {
                display: block;
                max-width: 190mm;
                max-height: 277mm;
                width: auto;
                height: auto;
                object-fit: contain;
                margin: 0 auto;
                page-break-inside: avoid;
              }

              @media print {
                html, body {
                  background: #fff !important;
                  width: 100% !important;
                  height: 100% !important;
                }

                .page {
                  width: 190mm !important;
                  height: 277mm !important;
                  overflow: hidden !important;
                }

                img {
                  max-width: 190mm !important;
                  max-height: 277mm !important;
                  width: auto !important;
                  height: auto !important;
                  object-fit: contain !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="page">
              <img id="receipt-image" src="${dataUrl}" alt="Rapport de ventes" />
            </div>

            <script>
              const img = document.getElementById("receipt-image");
              img.onload = () => {
                window.focus();
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 250);
                }, 180);
              };
            </script>
          </body>
        </html>
      `);
      w.document.close();
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const onShare = async () => {
    if (!report) return;

    try {
      setBusyAction("share");
      const blob = await captureReceiptBlob();
      const file = new File([blob], getReceiptFileName(), { type: "image/png" });
      const url = window.location.href;

      const canShareFiles =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        (navigator as any).canShare?.({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          title: `Rapport de ventes #${report.id}`,
          text: `Rapport de ventes Duumini #${report.id}`,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `Rapport de ventes #${report.id}`,
          text: `${shareText}\n\n${url}`,
          url,
        });
        return;
      }

      downloadBlob(blob, getReceiptFileName());
      alert("Image du rapport téléchargée.");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        try {
          const blob = await captureReceiptBlob();
          downloadBlob(blob, getReceiptFileName());
          alert("Partage non supporté ici. Image du rapport téléchargée.");
        } catch {
          alert(safeErrorMessage(e));
        }
      }
    } finally {
      setBusyAction(null);
    }
  };

  const onWhatsappShare = async () => {
    if (!report) return;

    try {
      setBusyAction("wa");
      const blob = await captureReceiptBlob();
      const file = new File([blob], getReceiptFileName(), { type: "image/png" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        (navigator as any).canShare?.({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          title: `Rapport de ventes #${report.id}`,
          text: `Rapport de ventes Duumini #${report.id}`,
          files: [file],
        });
        return;
      }

      downloadBlob(blob, getReceiptFileName());

      const waText =
        `Rapport de ventes Duumini #${report.id}\n` +
        `L'image du reçu a été téléchargée. Joignez-la dans WhatsApp.\n\n` +
        `${window.location.href}`;

      const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="container py-3 report-page-root">
      <style>
        {`
          .report-board {
            width: 760px;
            max-width: 760px;
            min-width: 760px;
            margin: 0 auto;
          }

          .report-card {
            position: relative;
            background:
              radial-gradient(circle at top right, rgba(255,193,7,.10), transparent 24%),
              linear-gradient(180deg, #ffffff 0%, #fffdfa 100%);
            border: 1px solid #efe7d6;
            border-radius: 20px;
            box-shadow:
              0 12px 28px rgba(17, 24, 39, .06),
              0 2px 8px rgba(17, 24, 39, .04);
            overflow: hidden;
            isolation: isolate;
          }

          .report-card::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 5px;
            background: linear-gradient(180deg, #f4b400 0%, #f59e0b 45%, #111827 100%);
          }

          .report-body {
            padding: 14px 16px 12px 18px;
          }

          .report-header {
            display: grid;
            grid-template-columns: 1.1fr .9fr;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
          }

          .report-brand-side {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .report-logo-wrap {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: linear-gradient(180deg, #fff8e1 0%, #ffffff 100%);
            border: 1px solid #f5e6b2;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 16px rgba(245, 158, 11, .10);
            flex-shrink: 0;
          }

          .report-logo {
            width: 46px;
            height: 46px;
            object-fit: contain;
            border-radius: 10px;
          }

          .report-kicker {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .16em;
            color: #b45309;
            text-transform: uppercase;
            margin-bottom: 2px;
          }

          .report-title {
            font-size: 26px;
            line-height: 1.02;
            font-weight: 900;
            color: #111827;
            margin-bottom: 4px;
          }

          .report-subtitle {
            color: #6b7280;
            font-size: 12px;
            line-height: 1.35;
            max-width: 430px;
          }

          .report-header-side {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .report-ref-box,
          .report-mini-box {
            border: 1px solid #eee6d7;
            background: #fffdf8;
            border-radius: 12px;
            padding: 9px 10px;
          }

          .report-ref-id {
            font-size: 16px;
            font-weight: 900;
            color: #111827;
            line-height: 1.1;
          }

          .report-ref-meta {
            color: #6b7280;
            font-size: 10px;
            margin-top: 3px;
            line-height: 1.3;
          }

          .report-badges {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          .report-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 4px 9px;
            border-radius: 999px;
            background: #111827;
            color: #fff;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: .04em;
            text-transform: uppercase;
          }

          .report-badge-soft {
            background: #fff7ed;
            color: #c2410c;
            border: 1px solid #fed7aa;
          }

          .report-top-stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 10px;
          }

          .stat-box {
            background: linear-gradient(180deg, #ffffff 0%, #fffaf0 100%);
            border: 1px solid #f1e7d3;
            border-radius: 12px;
            padding: 9px 10px;
          }

          .stat-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: .06em;
            color: #6b7280;
            margin-bottom: 4px;
            font-weight: 800;
          }

          .stat-value {
            font-size: 18px;
            font-weight: 900;
            color: #111827;
            line-height: 1.08;
            word-break: break-word;
          }

          .report-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .section-card {
            border: 1px solid #eff2f5;
            background: #fff;
            border-radius: 13px;
            padding: 10px 10px 7px;
            box-shadow: 0 2px 6px rgba(17, 24, 39, .03);
            min-width: 0;
          }

          .section-card.span-2 {
            grid-column: 1 / -1;
          }

          .section-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .08em;
            color: #111827;
            margin-bottom: 6px;
          }

          .line-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
            padding: 4px 0;
            border-bottom: 1px dashed #edf0f2;
          }

          .line-row:last-child {
            border-bottom: 0;
          }

          .line-label {
            font-size: 12px;
            color: #4b5563;
            line-height: 1.3;
            word-break: break-word;
            overflow-wrap: anywhere;
            flex: 1;
            min-width: 0;
          }

          .line-value {
            font-size: 12px;
            font-weight: 800;
            color: #111827;
            text-align: right;
            line-height: 1.3;
            word-break: break-word;
            overflow-wrap: anywhere;
            flex-shrink: 0;
            max-width: 50%;
          }

          .line-value.good {
            color: #047857;
          }

          .line-value.warn {
            color: #b45309;
          }

          .grand-total {
            margin-top: 6px;
            padding: 8px 10px;
            border-radius: 13px;
            background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
            color: #fff;
          }

          .grand-total .line-row {
            border-bottom-color: rgba(255,255,255,.12);
          }

          .grand-total .line-label,
          .grand-total .line-value {
            color: #fff;
            font-size: 14px;
            font-weight: 900;
          }

          .payment-table {
            width: 100%;
            border-collapse: collapse;
          }

          .payment-table th,
          .payment-table td {
            padding: 5px 0;
            border-bottom: 1px dashed #edf0f2;
            font-size: 12px;
          }

          .payment-table th {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: .06em;
            color: #6b7280;
            text-align: left;
            font-weight: 800;
          }

          .payment-table td:last-child,
          .payment-table th:last-child {
            text-align: right;
            font-weight: 800;
            color: #111827;
          }

          .payment-table tr:last-child td {
            border-bottom: 0;
          }

          .footer-note {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #d7dce2;
            color: #6b7280;
            font-size: 11px;
            text-align: center;
            line-height: 1.35;
          }

          .receipt-actions .btn {
            border-radius: 12px;
            font-weight: 700;
          }

          @media (max-width: 991.98px) {
            .report-board {
              width: 100%;
              max-width: 100%;
              min-width: 0;
            }

            .report-header,
            .report-grid,
            .report-top-stats {
              grid-template-columns: 1fr;
            }

            .report-title {
              font-size: 24px;
            }

            .stat-value {
              font-size: 17px;
            }
          }

          @media print {
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3 no-print">
        <div>
          <h2 className="mb-0">Rapport imprimable</h2>
          <div className="text-muted small">Reçu de ventes Duumini</div>
        </div>

        <div className="d-flex gap-2 flex-wrap receipt-actions">
          <Link className="btn btn-outline-secondary" to="/admin/reports/sales">
            Retour
          </Link>

          <button
            className="btn btn-outline-dark"
            onClick={onShare}
            disabled={!report || !!busyAction}
          >
            {busyAction === "share" ? "Préparation..." : "Partager"}
          </button>

          <button
            className="btn btn-success"
            onClick={onWhatsappShare}
            disabled={!report || !!busyAction}
          >
            {busyAction === "wa" ? "Préparation..." : "WhatsApp"}
          </button>

          <button
            className="btn btn-primary"
            onClick={onPrint}
            disabled={!report || !!busyAction}
          >
            {busyAction === "print" ? "Préparation..." : "Imprimer"}
          </button>
        </div>
      </div>

      {loading && <div className="text-muted">Chargement…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!!report && (
        <div className="report-board">
          <div ref={printRef} className="report-card">
            <div className="report-body">
              <div className="report-header">
                <div className="report-brand-side">
                  <div className="report-logo-wrap">
                    <img
                      src="/logo.jpeg"
                      alt="Duumini"
                      className="report-logo"
                      crossOrigin="anonymous"
                      onError={(e: any) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  <div>
                    <div className="report-kicker">Duumini</div>
                    <div className="report-title">Rapport de ventes</div>
                    <div className="report-subtitle">
                      Reçu récapitulatif des commandes finalisées et des montants associés.
                    </div>
                  </div>
                </div>

                <div className="report-header-side">
                  <div className="report-ref-box">
                    <div className="report-ref-id">Réf. #{report.id}</div>
                    <div className="report-ref-meta">
                      Créé le {fmt(report.created_at || undefined)}
                    </div>
                  </div>

                  <div className="report-mini-box">
                    <div className="report-badges">
                      <span className="report-badge">Commandes DONE</span>
                      <span className="report-badge report-badge-soft">{report.currency}</span>
                      <span className="report-badge report-badge-soft">{report.period_type}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="report-top-stats">
                <div className="stat-box">
                  <div className="stat-label">Commandes</div>
                  <div className="stat-value">{report.orders_count ?? 0}</div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">Total ventes</div>
                  <div className="stat-value">{money(report.total_amount, report.currency)}</div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">Somme payée</div>
                  <div className="stat-value">{money(paidAmount, report.currency)}</div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">Reste à payer</div>
                  <div className="stat-value">{money(remainingAmount, report.currency)}</div>
                </div>
              </div>

              <div className="report-grid">
                <div className="section-card">
                  <div className="section-title">Résumé des ventes</div>

                  <div className="line-row">
                    <div className="line-label">Nombre de commandes</div>
                    <div className="line-value">{report.orders_count ?? 0}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Montant produits brut</div>
                    <div className="line-value">{money(grossItemsAmount, report.currency)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Réduction admin</div>
                    <div className="line-value warn">
                      {money(adminDiscountAmount, report.currency)}
                    </div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Montant produits net</div>
                    <div className="line-value">{money(netItemsAmount, report.currency)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Livraison</div>
                    <div className="line-value">{money(report.delivery_amount, report.currency)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Total ventes</div>
                    <div className="line-value">{money(report.total_amount, report.currency)}</div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-title">Résumé financier</div>

                  <div className="line-row">
                    <div className="line-label">Produits nets</div>
                    <div className="line-value">{money(netItemsAmount, report.currency)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Montant livraison</div>
                    <div className="line-value">{money(report.delivery_amount, report.currency)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Commission Duumini</div>
                    <div className="line-value">{money(report.duumini_commission, report.currency)}</div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-title">Paiement</div>

                  <div className="line-row">
                    <div className="line-label">Somme payée</div>
                    <div className="line-value good">{money(paidAmount, report.currency)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Reste à payer</div>
                    <div className="line-value warn">{money(remainingAmount, report.currency)}</div>
                  </div>

                  <div className="grand-total">
                    <div className="line-row">
                      <div className="line-label">Total global</div>
                      <div className="line-value">{money(report.total_amount, report.currency)}</div>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-title">Informations du rapport</div>

                  <div className="line-row">
                    <div className="line-label">Type</div>
                    <div className="line-value">{report.period_type}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Devise</div>
                    <div className="line-value">{report.currency}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Début période</div>
                    <div className="line-value">{fmt(report.period_start)}</div>
                  </div>

                  <div className="line-row">
                    <div className="line-label">Fin période</div>
                    <div className="line-value">{fmt(report.period_end)}</div>
                  </div>
                </div>

                <div className="section-card span-2">
                  <div className="section-title">Répartition des paiements</div>

                  {paymentBreakdown.length ? (
                    <table className="payment-table">
                      <thead>
                        <tr>
                          <th>Statut</th>
                          <th>Commandes</th>
                          <th>Montant total</th>
                          <th>Montant payé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentBreakdown.map((row: any, index: number) => (
                          <tr key={`${row?.payment_status || "row"}-${index}`}>
                            <td>{row?.payment_status || "—"}</td>
                            <td>{Number(row?.cnt || 0)}</td>
                            <td>{money(row?.amount, report.currency)}</td>
                            <td>{money(row?.paid_amount, report.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-muted small">
                      Aucun détail de paiement disponible.
                    </div>
                  )}
                </div>
              </div>

              <div className="footer-note">
                Merci d’utiliser Duumini
                <br />
                Les goûts de ton pays, partout où tu te trouves
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}