// src/components/orders/OrderReceiptButton.tsx
import { useMemo } from "react";
import { Download, FileText, Receipt } from "lucide-react";
import { API_BASE } from "../../services/http";
import type { OrderDetail } from "../../services/orders";
import { getOrderReceiptPdfUrl } from "../../services/orders";

type Props = {
  orderId?: number;
  order?: Partial<OrderDetail> | null;
  className?: string;
  variant?: "button" | "link";
  label?: string;

  /** ✅ ouvre un modal/page qui affiche <OrderReceiptTicket order=... /> */
  onOpenTicket?: (orderId: number) => void;

  /** afficher le bouton PDF */
  showPdf?: boolean;
};

function absUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

export default function OrderReceiptButton({
  orderId,
  order,
  className = "",
  variant = "button",
  label,
  onOpenTicket,
  showPdf = true,
}: Props) {
  const id = Number(orderId ?? order?.id ?? 0);

  const receiptNumber = useMemo(() => {
    const n = (order as any)?.receipt_number || null;
    return n ? String(n) : null;
  }, [order]);

  const pdfHref = useMemo(() => {
    if (!id) return "";
    return absUrl(getOrderReceiptPdfUrl(id));
  }, [id]);

  const text = label || (receiptNumber ? `Reçu ${receiptNumber}` : "Reçu");

  if (!id) return null;

  // Variante lien: on garde un lien vers PDF (si demandé)
  if (variant === "link") {
    return (
      <div className={["inline-flex items-center gap-3", className].join(" ")}>
        {onOpenTicket ? (
          <button
            type="button"
            onClick={() => onOpenTicket(id)}
            className={[
              "inline-flex items-center gap-2 text-sm font-extrabold",
              "underline underline-offset-4",
              "text-[#111] hover:opacity-80",
            ].join(" ")}
          >
            <Receipt className="h-4 w-4" />
            {text}
          </button>
        ) : null}

        {showPdf && pdfHref ? (
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            className={[
              "inline-flex items-center gap-2 text-sm font-extrabold",
              "underline underline-offset-4",
              "text-[#111] hover:opacity-80",
            ].join(" ")}
          >
            <FileText className="h-4 w-4" />
            PDF
          </a>
        ) : null}
      </div>
    );
  }

  // Variante button
  return (
    <div className={["inline-flex items-center gap-2", className].join(" ")}>
      {onOpenTicket ? (
        <button
          type="button"
          onClick={() => onOpenTicket(id)}
          className={[
            "inline-flex items-center justify-center gap-2",
            "rounded-xl px-4 py-2 text-sm font-extrabold",
            "bg-[#111] text-[#FFD000] border border-[#111]",
            "hover:opacity-90 active:scale-[0.99] transition",
            "shadow-sm",
          ].join(" ")}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Receipt className="h-4 w-4" />
          {text}
        </button>
      ) : null}

      {showPdf && pdfHref ? (
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className={[
            "inline-flex items-center justify-center gap-2",
            "rounded-xl px-4 py-2 text-sm font-extrabold",
            "bg-white text-[#111] border border-[#111]",
            "hover:opacity-90 active:scale-[0.99] transition",
            "shadow-sm",
          ].join(" ")}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Download className="h-4 w-4" />
          PDF
        </a>
      ) : null}
    </div>
  );
}