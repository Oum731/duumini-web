// src/pages/vendor/SupplierCatalogPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Search } from "lucide-react";
import { me } from "../../services/auth";
import { listSupplierProducts, type SupplierProduct } from "../../services/supplierProducts";
import { moneyMAD } from "../../utils/money";

type AnyObj = Record<string, any>;

function isProRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "VENDEUR" || r === "FOURNISSEUR" || r === "RESTAURANT";
}

export default function SupplierCatalogPage() {
  const [user, setUser] = useState<AnyObj | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [items, setItems] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (mounted) setUser((u as any) || null);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setUserLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      setQDebounced(q.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSupplierProducts({
        page,
        pageSize,
        q: qDebounced || undefined,
        onlyActive: 1,
      });
      setItems(res.items || []);
      setTotal(res.pageInfo?.total ?? 0);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le catalogue fournisseurs.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, qDebounced]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  if (userLoaded && !isProRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container-xxl py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h5 m-0">Catalogue fournisseurs</h1>
          <div className="text-muted small">
            Produits en gros proposés par les fournisseurs de la plateforme.
          </div>
        </div>
        <Link to="/ma-boutique" className="btn btn-outline-dark">
          Retour à ma boutique
        </Link>
      </div>

      <div className="input-group mb-3" style={{ maxWidth: 420 }}>
        <span className="input-group-text bg-white">
          <Search size={16} />
        </span>
        <input
          className="form-control"
          placeholder="Rechercher un produit fournisseur…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Rechercher"
        />
      </div>

      {!!error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="text-muted">Aucun produit fournisseur trouvé.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Fournisseur</th>
                    <th>Ville</th>
                    <th className="text-end">Prix de gros</th>
                    <th className="text-end">Stock</th>
                    <th>Unité</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="fw-semibold">{p.title}</div>
                        {p.description && (
                          <div className="text-muted small text-truncate" style={{ maxWidth: 360 }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td>{p.supplier_name || "—"}</td>
                      <td>{p.supplier_city || "—"}</td>
                      <td className="text-end">{moneyMAD(p.price_wholesale, 2)}</td>
                      <td className="text-end">{p.stock_qty}</td>
                      <td>{p.unit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="text-muted small">{total} produit(s)</div>
            <div className="btn-group">
              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Préc.
              </button>
              <span className="btn btn-sm btn-outline-dark disabled">
                {page} / {pages}
              </span>
              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suiv.
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
