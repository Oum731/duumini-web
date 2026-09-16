// src/pages/admin/SuppliersAdminPage.tsx
//
// Vue "Fournisseurs" : présente les boutiques existantes sous l'angle
// fournisseur (contact, ville, catalogue) — n'importe quelle boutique
// active est considérée comme un fournisseur potentiel, sans changer son
// shop_type réel en base (le site public n'est pas affecté). Pour la vraie
// gestion des vendeurs (shop_type = VENDOR), voir la page Vendeurs.
import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { listShopsAdmin, type Shop } from "../../services/shops";
import { imgUrl } from "../../utils/media";

const PAGE_SIZE = 24;

export default function SuppliersAdminPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  async function refresh(query?: string, targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await listShopsAdmin({ pageSize: PAGE_SIZE, page: targetPage, q: query || undefined });
      setShops(res.items);
      setTotal(res.pageInfo.total);
    } catch (e: any) {
      setError(e?.payload?.error || e?.data?.error || e?.message || "Impossible de charger les fournisseurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(q, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const citiesCount = useMemo(() => new Set(shops.map((s) => s.city).filter(Boolean)).size, [shops]);

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        subtitle="Toutes les boutiques actives du réseau Duumini, sous l'angle fournisseur : contact, ville, catalogue."
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard icon={Building2} label="Fournisseurs actifs" value={shops.length} accent="blue" />
        </div>
        <div className="col-sm-4">
          <KpiCard icon={MapPin} label="Villes couvertes" value={citiesCount} accent="green" />
        </div>
      </div>

      <div className="d-flex gap-2 mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Rechercher un fournisseur..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (page === 1 ? refresh(q, 1) : setPage(1))}
        />
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => (page === 1 ? refresh(q, 1) : setPage(1))}
        >
          Rechercher
        </button>
      </div>

      {loading ? (
        <LoadingState label="Chargement des fournisseurs..." />
      ) : (
        <div className="row g-3">
          {shops.map((s) => (
            <div key={s.id} className="col-md-6 col-xl-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex gap-3">
                  <div
                    className="rounded-3 bg-light flex-shrink-0 d-flex align-items-center justify-content-center overflow-hidden"
                    style={{ width: 56, height: 56 }}
                  >
                    {s.logo ? (
                      <img src={imgUrl(s.logo)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Building2 size={22} className="text-muted" />
                    )}
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold text-truncate">{s.name}</div>
                    <div className="text-muted small">
                      {s.city || "Ville non renseignée"}
                      {(s as any).category_name ? ` · ${(s as any).category_name}` : ""}
                    </div>
                    <div className="d-flex gap-2 mt-2">
                      <Link to={`/boutique/${s.slug}`} className="btn btn-outline-dark btn-sm" target="_blank">
                        Voir la boutique
                      </Link>
                      <Link to="/admin/supplier-deliveries" className="btn btn-outline-secondary btn-sm">
                        <Truck size={14} className="me-1" /> Livraisons
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {shops.length === 0 ? (
            <div className="col-12 text-center text-muted py-4">Aucun fournisseur pour l'instant.</div>
          ) : null}
        </div>
      )}

      {!loading && shops.length > 0 ? (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="text-muted small">{total} fournisseur(s)</div>
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
      ) : null}
    </div>
  );
}
