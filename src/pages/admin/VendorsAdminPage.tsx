// src/pages/admin/VendorsAdminPage.tsx
//
// Vraie gestion multi-vendeurs (shop_type = VENDOR) : pensée pour accueillir
// d'autres vendeurs à l'avenir, Duumini étant le seul vendeur pour
// l'instant. Deux façons d'ajouter un vendeur : créer une nouvelle boutique
// vendeur, ou promouvoir une boutique existante (déjà listée côté
// Fournisseurs) en la taguant VENDOR.
import { useEffect, useState } from "react";
import { Store, PlusCircle, ArrowUpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { listVendors, listShopsAdmin, createShop, updateShop, type Shop } from "../../services/shops";
import { imgUrl } from "../../utils/media";

export default function VendorsAdminPage() {
  const [vendors, setVendors] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [showPromote, setShowPromote] = useState(false);
  const [promoteQuery, setPromoteQuery] = useState("");
  const [promoteResults, setPromoteResults] = useState<Shop[]>([]);
  const [promoting, setPromoting] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listVendors({ pageSize: 100 });
      setVendors(res.items);
    } catch (e: any) {
      setError(e?.payload?.error || e?.data?.error || e?.message || "Impossible de charger les vendeurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return setError("Le nom est obligatoire.");
    setSaving(true);
    setError(null);
    try {
      await createShop({ name: name.trim(), city: city.trim() || undefined, description: description.trim() || null, shop_type: "VENDOR" });
      setShowCreate(false);
      setName("");
      setCity("");
      setDescription("");
      await refresh();
    } catch (e: any) {
      setError(e?.payload?.error || e?.data?.error || e?.message || "Impossible de créer ce vendeur.");
    } finally {
      setSaving(false);
    }
  }

  async function searchToPromote(q: string) {
    setPromoteQuery(q);
    if (!q.trim()) {
      setPromoteResults([]);
      return;
    }
    try {
      const res = await listShopsAdmin({ q: q.trim(), pageSize: 8 });
      setPromoteResults(res.items.filter((s) => s.shop_type !== "VENDOR"));
    } catch {
      setPromoteResults([]);
    }
  }

  async function handlePromote(shop: Shop) {
    setPromoting(true);
    setError(null);
    try {
      await updateShop(shop.id, { shop_type: "VENDOR" });
      setShowPromote(false);
      setPromoteQuery("");
      setPromoteResults([]);
      await refresh();
    } catch (e: any) {
      setError(e?.payload?.error || e?.data?.error || e?.message || "Impossible de promouvoir cette boutique.");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendeurs"
        subtitle="Les entités qui vendent sur Duumini — Duumini est le seul vendeur pour l'instant, prêt à en accueillir d'autres."
        right={
          <div className="d-flex gap-2">
            <button className="btn btn-outline-dark btn-sm d-flex align-items-center gap-1" onClick={() => setShowPromote((v) => !v)}>
              <ArrowUpCircle size={16} /> Promouvoir une boutique
            </button>
            <button className="btn btn-duu btn-sm d-flex align-items-center gap-1" onClick={() => setShowCreate((v) => !v)}>
              <PlusCircle size={16} /> Nouveau vendeur
            </button>
          </div>
        }
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <KpiCard icon={Store} label="Vendeurs" value={vendors.length} accent="orange" />
        </div>
      </div>

      {showCreate ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body row g-2">
            <div className="col-md-4">
              <input className="form-control" placeholder="Nom du vendeur" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-md-3">
              <input className="form-control" placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Description (optionnel)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="col-md-1">
              <button className="btn btn-dark w-100" disabled={saving} onClick={handleCreate}>
                {saving ? "..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPromote ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <input
              className="form-control mb-2"
              placeholder="Rechercher une boutique à promouvoir en vendeur..."
              value={promoteQuery}
              onChange={(e) => searchToPromote(e.target.value)}
            />
            {promoteResults.length > 0 ? (
              <div className="list-group">
                {promoteResults.map((s) => (
                  <button
                    key={s.id}
                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    disabled={promoting}
                    onClick={() => handlePromote(s)}
                  >
                    <span>
                      {s.name} <span className="text-muted small">({s.city || "ville inconnue"})</span>
                    </span>
                    <span className="badge bg-dark">Promouvoir</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Chargement des vendeurs..." />
      ) : (
        <div className="row g-3">
          {vendors.map((s) => (
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
                      <Store size={22} className="text-muted" />
                    )}
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold text-truncate">{s.name}</div>
                    <div className="text-muted small">{s.city || "Ville non renseignée"}</div>
                    <Link to={`/boutique/${s.slug}`} className="btn btn-outline-dark btn-sm mt-2" target="_blank">
                      Voir la boutique
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {vendors.length === 0 ? (
            <div className="col-12 text-center text-muted py-4">
              Aucun vendeur pour l'instant — crée "Duumini" comme premier vendeur ci-dessus.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
