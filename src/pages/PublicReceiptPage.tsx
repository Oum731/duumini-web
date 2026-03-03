// src/pages/PublicReceiptPage.tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/http";

// Optionnel: si tu veux réutiliser ton reçu UI
import OrderReceipt from "../components/ordersAdmin/OrderReceipt";
import type { AnyObj } from "../components/ordersAdmin/orderUtils";

export default function PublicReceiptPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = String(token || "").trim();
    if (!t) {
      setLoading(false);
      setError("Token manquant.");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setDetail(null);

      try {
        // ✅ route backend publique à créer (voir plus bas)
        const r = await api.get(`/api/orders/receipt/${encodeURIComponent(t)}`);
        const data: any = (r as any)?.data ?? r;

        if (!cancelled) setDetail(data || null);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Reçu introuvable.";
        if (!cancelled) setError(String(msg));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="container-xxl py-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h5 mb-1">Vérification du reçu</h1>
          <div className="text-muted small">
            Token : <span className="fw-semibold">{token || "—"}</span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Link to="/" className="btn btn-outline-secondary btn-sm">
            Accueil
          </Link>

          {/* PDF public (si tu ajoutes la route publique .pdf, voir plus bas) */}
          {token && (
            <a
              className="btn btn-sm btn-duu"
              href={`/api/orders/receipt/${encodeURIComponent(token)}/receipt.pdf`}
              target="_blank"
              rel="noreferrer"
            >
              PDF
            </a>
          )}
        </div>
      </div>

      {loading && <div className="text-muted">Chargement…</div>}

      {!loading && error && (
        <div className="alert alert-danger">
          <div className="fw-semibold">Page introuvable</div>
          <div className="small mt-1">{error}</div>
        </div>
      )}

      {!loading && !error && detail && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <OrderReceipt order={detail} />{" "}
          </div>
        </div>
      )}
    </main>
  );
}
