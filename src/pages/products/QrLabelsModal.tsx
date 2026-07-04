// src/pages/products/QrLabelsModal.tsx
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { getProduct, type ProductVariant } from "../../services/products";

type Label = {
  key: string;
  sku: string | null;
  size: string | null;
  color: string | null;
};

export default function QrLabelsModal({
  open,
  onClose,
  productId,
  productName,
}: {
  open: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await getProduct(productId, { variants: true });
        const variants = Array.isArray((p as any)?.variants) ? ((p as any).variants as ProductVariant[]) : [];
        if (!mounted) return;
        if (variants.length) {
          setLabels(
            variants.map((v) => ({
              key: String(v.id),
              sku: v.sku || null,
              size: v.size || null,
              color: v.color || null,
            }))
          );
        } else {
          setLabels([{ key: "base", sku: null, size: null, color: null }]);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Impossible de charger les variantes.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, productId]);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://duumini.com";

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ zIndex: 1060, background: "rgba(0,0,0,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .duu-qr-print-area, .duu-qr-print-area * { visibility: visible; }
          .duu-qr-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div className="h-100 d-flex align-items-center justify-content-center p-3">
        <div
          className="bg-white rounded-4 shadow w-100"
          style={{ maxWidth: 820, maxHeight: "92vh", overflow: "hidden" }}
        >
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
            <div className="fw-bold">Étiquettes QR — {productName}</div>
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              ×
            </button>
          </div>

          <div style={{ overflow: "auto", maxHeight: "calc(92vh - 110px)" }}>
            <div className="p-3">
              {loading ? (
                <div className="text-muted">Chargement…</div>
              ) : error ? (
                <div className="alert alert-danger">{error}</div>
              ) : (
                <div className="duu-qr-print-area row g-3">
                  {labels.map((l) => {
                    const url = `${origin}/gestion/produit/${productId}${l.sku ? `?sku=${encodeURIComponent(l.sku)}` : ""}`;
                    return (
                      <div className="col-6 col-md-4" key={l.key}>
                        <div className="border rounded-3 p-2 text-center h-100">
                          <QRCode value={url} size={96} style={{ width: "100%", height: "auto" }} />
                          <div className="small fw-semibold mt-2">{productName}</div>
                          <div className="small text-muted">
                            {l.size || l.color ? (
                              <>
                                {l.size ? `Taille ${l.size}` : ""}
                                {l.size && l.color ? " • " : ""}
                                {l.color ? l.color : ""}
                              </>
                            ) : (
                              `#${productId}`
                            )}
                          </div>
                          {l.sku ? <div className="small text-muted">{l.sku}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="px-3 py-2 border-top d-flex justify-content-end gap-2">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Fermer
            </button>
            <button className="btn btn-dark" onClick={() => window.print()} disabled={loading || !!error}>
              Imprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
