// src/pages/admin/ShopsAdminPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import {
  listShops,
  type Shop,
  type ShopStats,
  createShop,
  updateShop,
  removeShop,
  getShopStats,
} from "../../services/shops";
import { listProducts, type Product } from "../../services/products";
import { API_BASE } from "../../services/http";

type Draft = Partial<Shop> & { description?: string | null };

type ShopFilesLocal = {
  logo?: File | null;
  cover?: File | null;
};

type ShopProduct = Product & {
  total_qty?: number;
  total_amount?: number; // CA 30j pour ce produit (prix normal vendeur, hors livraison)
};

type CaFilter = "DAY" | "MONTH" | "YEAR";
type ProductFilter = "ALL" | "MOST_ORDERED" | "BEST_RATED";

// Helper URL logo
function shopLogoUrl(logo?: string | null) {
  if (!logo) return "";
  const u = String(logo);
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

// Helper image produit robuste
function productImgUrl(p: ShopProduct): string {
  const anyP = p as any;
  const raw =
    anyP.cover ||
    anyP.image ||
    anyP.thumb ||
    anyP.main_image ||
    anyP.product_cover ||
    "";
  if (!raw) return "";
  const u = String(raw);
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

// Helper format prix
const mad = (n?: number | null) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(Number(n || 0));

/* ======= Formulaire boutique ======= */

function ShopForm({
  initial,
  onSubmit,
}: {
  initial?: Draft;
  onSubmit: (d: Draft, files: ShopFilesLocal) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: initial?.name || "",
    description: (initial as any)?.description || "",
    category_id: initial?.category_id ?? null,
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const existingLogoUrl = shopLogoUrl((initial as any)?.logo || null);
  const existingCoverUrl = shopLogoUrl((initial as any)?.cover || null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = (draft.name ?? "").toString().trim();
    if (!cleanName) {
      alert("Le nom du restaurant / boutique est obligatoire.");
      return;
    }

    const finalDraft: Draft = {
      ...draft,
      name: cleanName,
      address: (draft.address ?? "") as string,
      city: (draft.city ?? "") as string,
      country: (draft.country ?? "") as string,
    };

    onSubmit(finalDraft, { logo: logoFile, cover: coverFile });
  }

  function onPickLogo() {
    logoInputRef.current?.click();
  }
  function onPickCover() {
    coverInputRef.current?.click();
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setLogoFile(f);
  }
  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setCoverFile(f);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-2">
        <label className="form-label">Nom du restaurant / boutique</label>
        <input
          className="form-control"
          value={draft.name || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value }))
          }
          required
        />
      </div>

      {initial?.slug && (
        <div className="mb-2">
          <label className="form-label">Slug (auto)</label>
          <input
            className="form-control"
            value={initial.slug}
            disabled
            readOnly
          />
          <small className="text-muted">
            Généré automatiquement à partir du nom.
          </small>
        </div>
      )}

      <div className="mb-2">
        <label className="form-label">Ville</label>
        <input
          className="form-control"
          placeholder="Ex : Casablanca"
          value={draft.city || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, city: e.target.value }))
          }
        />
      </div>

      <div className="mb-2">
        <label className="form-label">
          Adresse / localisation (Google Maps, quartier…)
        </label>
        <textarea
          className="form-control"
          rows={2}
          placeholder="Ex : Maârif, Boulevard Ghandi… ou collez un lien Google Maps"
          value={draft.address || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, address: e.target.value }))
          }
        />
      </div>

      {/* Logo */}
      <div className="mb-3">
        <label className="form-label d-flex justify-content-between align-items-center">
          Logo du restaurant
          <small className="text-muted">Carré recommandé</small>
        </label>

        <div className="d-flex align-items-center gap-3 mb-2">
          <div>
            {logoFile ? (
              <img
                src={URL.createObjectURL(logoFile)}
                alt="logo preview"
                className="rounded-circle border"
                style={{ width: 60, height: 60, objectFit: "cover" }}
              />
            ) : existingLogoUrl ? (
              <img
                src={existingLogoUrl}
                alt="logo actuel"
                className="rounded-circle border"
                style={{ width: 60, height: 60, objectFit: "cover" }}
              />
            ) : (
              <div
                className="rounded-circle border bg-light"
                style={{ width: 60, height: 60 }}
              />
            )}
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={onPickLogo}
            >
              Choisir une image
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={onPickLogo}
            >
              Prendre une photo
            </button>
            {logoFile && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setLogoFile(null)}
              >
                Retirer le logo
              </button>
            )}
          </div>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onLogoChange}
        />
      </div>

      {/* Cover */}
      <div className="mb-3">
        <label className="form-label d-flex justify-content-between align-items-center">
          Image de couverture (optionnel)
          <small className="text-muted">Bannière horizontale</small>
        </label>

        <div className="d-flex align-items-center gap-3 mb-2">
          <div>
            {coverFile ? (
              <img
                src={URL.createObjectURL(coverFile)}
                alt="cover preview"
                className="rounded border"
                style={{ width: 96, height: 60, objectFit: "cover" }}
              />
            ) : existingCoverUrl ? (
              <img
                src={existingCoverUrl}
                alt="cover actuelle"
                className="rounded border"
                style={{ width: 96, height: 60, objectFit: "cover" }}
              />
            ) : (
              <div
                className="rounded border bg-light"
                style={{ width: 96, height: 60 }}
              />
            )}
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={onPickCover}
            >
              Choisir une image
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={onPickCover}
            >
              Prendre une photo
            </button>
            {coverFile && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setCoverFile(null)}
              >
                Retirer la couverture
              </button>
            )}
          </div>
        </div>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onCoverChange}
        />
      </div>

      <div className="mb-2">
        <label className="form-label">Description</label>
        <textarea
          className="form-control"
          rows={3}
          value={(draft as any).description || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
        />
      </div>

      <div className="d-flex justify-content-end">
        <button className="btn btn-dark" type="submit">
          Enregistrer
        </button>
      </div>
    </form>
  );
}

/* ======= Page admin boutiques ======= */

export default function ShopsAdminPage() {
  const [items, setItems] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Shop | null>(null);

  const [selected, setSelected] = useState<Shop | null>(null);

  const [stats, setStats] = useState<ShopStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Filtre CA
  const [caFilter, setCaFilter] = useState<CaFilter>("DAY");

  // Produits de la boutique sélectionnée
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productFilter, setProductFilter] =
    useState<ProductFilter>("ALL");

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  async function refresh() {
    setLoading(true);
    try {
      const res = await listShops({ page, pageSize });
      setItems(res.items);
      setTotal(res.pageInfo.total);
      setError(null);

      if (!selected && res.items.length > 0) {
        setSelected(res.items[0]);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // Stats par boutique (basées sur orders + produits de cette boutique)
  useEffect(() => {
    if (!selected) {
      setStats(null);
      return;
    }
    (async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await getShopStats(selected.id);
        setStats(res);
      } catch (e: any) {
        setStatsError(e?.message || "Impossible de charger les stats.");
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [selected]);

  // Produits de la boutique (filtrés par shop_id, PAS par user)
  useEffect(() => {
    if (!selected) {
      setProducts([]);
      return;
    }
    (async () => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const res = await listProducts({
          page: 1,
          pageSize: 500,
          // IMPORTANT : filtre par id de boutique
          // ton backend doit accepter ce paramètre (shop_id ou équivalent)
          // @ts-ignore
          shop_id: selected.id,
        } as any);

        const base: Product[] = (res as any).items || [];

        // Merge avec top_products (commandes sur 30j)
        const mapTop = new Map<
          number,
          { total_qty: number; total_amount: number; cover?: string | null }
        >();
        stats?.top_products.forEach((tp: any) => {
          mapTop.set(tp.product_id, {
            total_qty: tp.total_qty,
            total_amount: tp.total_amount,
            cover: tp.cover || null,
          });
        });

        const merged: ShopProduct[] = base.map((p) => {
          const extra = mapTop.get((p as any).id) || {
            total_qty: 0,
            total_amount: 0,
            cover: (p as any).cover || null,
          };
          return {
            ...(p as any),
            total_qty: extra.total_qty,
            total_amount: extra.total_amount, // CA 30j basé sur prix normal, hors livraison
            cover: extra.cover ?? (p as any).cover ?? null,
          };
        });

        setProducts(merged);
      } catch (e: any) {
        console.error("Erreur chargement produits boutique", e);
        setProductsError(
          e?.message ||
            "Impossible de charger les produits de cette boutique."
        );
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, [selected, stats]);

  function openCreate() {
    setEdit(null);
    setShowForm(true);
  }
  function openEdit(s: Shop) {
    setEdit(s);
    setShowForm(true);
  }

  async function onSave(draft: Draft, files: ShopFilesLocal) {
    const cleanName = (draft.name ?? "").toString().trim();
    if (!cleanName) {
      alert("Le nom du restaurant / boutique est obligatoire.");
      return;
    }

    const payload: Draft = {
      name: cleanName,
      description: (draft as any).description ?? null,
      category_id: draft.category_id ?? null,
      address: draft.address ?? null,
      city: draft.city ?? null,
      country: draft.country ?? null,
      lat: draft.lat ?? null,
      lng: draft.lng ?? null,
    };

    try {
      let saved: Shop;
      if (edit == null) {
        saved = await createShop(payload, files);
      } else {
        saved = await updateShop(edit.id, payload, files);
      }
      setShowForm(false);
      await refresh();
      setSelected(saved);
    } catch (e: any) {
      console.error("Erreur create/update shop", e);
      const msg =
        (e?.response?.data?.error as string | undefined) ||
        e?.message ||
        "Une erreur est survenue lors de l'enregistrement de la boutique.";
      alert(msg);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Supprimer cette boutique ?")) return;
    await removeShop?.(id);
    await refresh();
    if (selected?.id === id) {
      setSelected(null);
      setStats(null);
      setProducts([]);
    }
  }

  const filtered = items.filter((s) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(t) ||
      (s.slug || "").toLowerCase().includes(t) ||
      (s.city || "").toLowerCase().includes(t) ||
      String(s.id).includes(t)
    );
  });

  // 💰 CA (turnover) basé sur le prix normal vendeur, et commission Duumini (duu)
  const turnover = stats?.turnover || { day: 0, month: 0, year: 0 };
  const duu = stats?.duumini || { day: 0, month: 0, year: 0 };

  // Part vendeur = CA (prix normal), on NE DÉDUIT PAS la commission
  const vendor = {
    day: turnover.day,
    month: turnover.month,
    year: turnover.year,
  };

  const caCurrent = useMemo(() => {
    if (caFilter === "DAY") {
      return {
        label: "Aujourd'hui",
        turnover: turnover.day, // CA (prix normal), hors livraison
        duu: duu.day,           // commission Duumini
        vendor: vendor.day,     // part vendeur = CA
      };
    }
    if (caFilter === "MONTH") {
      return {
        label: "Ce mois-ci",
        turnover: turnover.month,
        duu: duu.month,
        vendor: vendor.month,
      };
    }
    return {
      label: "Cette année",
      turnover: turnover.year,
      duu: duu.year,
      vendor: vendor.year,
    };
  }, [caFilter, turnover, duu, vendor]);

  // 🔥 Filtrage réel des produits selon le type de tri
  const displayedProducts = useMemo(() => {
    const arr = [...products];

    if (productFilter === "ALL") {
      return arr;
    }

    if (productFilter === "MOST_ORDERED") {
      // On garde uniquement les produits qui ont été commandés (total_qty > 0)
      return arr
        .filter((p) => Number(p.total_qty || 0) > 0)
        .sort((a, b) => {
          const qa = Number(a.total_qty || 0);
          const qb = Number(b.total_qty || 0);
          if (qb !== qa) return qb - qa;
          const aa = Number(a.total_amount || 0);
          const ab = Number(b.total_amount || 0);
          return ab - aa;
        });
    }

    if (productFilter === "BEST_RATED") {
      // On garde uniquement les produits qui ont une note > 0
      return arr
        .map((p) => {
          const anyP = p as any;
          const rating =
            Number(
              anyP.avg_rating ??
                anyP.average_rating ??
                anyP.rating ??
                0
            ) || 0;
          const ratingCount = Number(
            anyP.rating_count ?? anyP.ratings_count ?? 0
          );
          return { p, rating, ratingCount };
        })
        .filter((x) => x.rating > 0)
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.ratingCount - a.ratingCount;
        })
        .map((x) => x.p);
    }

    return arr;
  }, [products, productFilter]);

  return (
    <div className="container-xxl py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h5 m-0">Boutiques & performances</h1>
        <button className="btn btn-dark" onClick={openCreate}>
          + Nouvelle boutique
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        {/* Colonne gauche : menu de boutiques */}
        <div className="col-12 col-md-4 col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <input
                className="form-control mb-3"
                placeholder="Recherche… (nom, ville, id)"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />

              {loading ? (
                <div className="text-muted">Chargement des boutiques…</div>
              ) : filtered.length === 0 ? (
                <div className="text-muted small">
                  Aucune boutique trouvée.
                </div>
              ) : (
                <div
                  className="list-group flex-grow-1"
                  style={{ maxHeight: "60vh", overflowY: "auto" }}
                >
                  {filtered.map((s) => {
                    const logo = (s as any).logo as string | null | undefined;
                    const logoSrc = shopLogoUrl(logo);
                    const active = selected?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={
                          "list-group-item list-group-item-action d-flex align-items-center justify-content-between gap-2 " +
                          (active ? "active" : "")
                        }
                        onClick={() => setSelected(s)}
                      >
                        <div className="d-flex align-items-center gap-2">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={s.name}
                              className="rounded-circle border"
                              style={{
                                width: 32,
                                height: 32,
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              className="rounded-circle border bg-light"
                              style={{ width: 32, height: 32 }}
                            />
                          )}
                          <div className="text-start">
                            <div className="small fw-semibold text-truncate">
                              {s.name}
                            </div>
                            <div className="text-muted small text-truncate">
                              {s.city || "Ville inconnue"}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex flex-column align-items-end gap-1">
                          <button
                            type="button"
                            className={
                              "btn btn-xs btn-outline-light border-0 px-2 py-0 " +
                              (active ? "" : "text-muted")
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(s);
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-danger border-0 px-2 py-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(s.id);
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="text-muted small">{total} boutiques</div>
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-dark"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Préc.
                  </button>
                  <span className="btn btn-outline-dark disabled">
                    {page} / {pages}
                  </span>
                  <button
                    className="btn btn-outline-dark"
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

        {/* Colonne droite : stats & produits */}
        <div className="col-12 col-md-8 col-lg-9">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              {!selected ? (
                <div className="text-muted">
                  Sélectionnez une boutique dans le menu de gauche pour voir
                  son chiffre d'affaires et ses produits.
                </div>
              ) : (
                <>
                  {/* En-tête boutique */}
                  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                    <div className="d-flex align-items-center gap-2">
                      {selected.logo ? (
                        <img
                          src={shopLogoUrl(selected.logo as any)}
                          alt={selected.name}
                          className="rounded-circle border"
                          style={{ width: 40, height: 40, objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          className="rounded-circle border bg-light"
                          style={{ width: 40, height: 40 }}
                        />
                      )}
                      <div>
                        <h2 className="h6 m-0">{selected.name}</h2>
                        <div className="text-muted small">
                          {selected.city || "Ville inconnue"}
                          {selected.address
                            ? ` — ${selected.address.slice(0, 40)}${
                                selected.address.length > 40 ? "…" : ""
                              }`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-outline-dark btn-sm"
                      onClick={() => openEdit(selected)}
                    >
                      Modifier la boutique
                    </button>
                  </div>

                  {/* CA filtrable */}
                  {statsLoading ? (
                    <div className="text-muted">Chargement des stats…</div>
                  ) : statsError ? (
                    <div className="alert alert-danger">{statsError}</div>
                  ) : !stats ? (
                    <div className="text-muted">
                      Aucune donnée de chiffre d'affaires pour cette boutique.
                    </div>
                  ) : (
                    <>
                      <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
                        <h6 className="m-0">
                          Chiffre d'affaires (prix normal, hors frais de livraison)
                        </h6>
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className={
                              "btn btn-outline-dark " +
                              (caFilter === "DAY" ? "active" : "")
                            }
                            onClick={() => setCaFilter("DAY")}
                          >
                            Aujourd'hui
                          </button>
                          <button
                            type="button"
                            className={
                              "btn btn-outline-dark " +
                              (caFilter === "MONTH" ? "active" : "")
                            }
                            onClick={() => setCaFilter("MONTH")}
                          >
                            Ce mois-ci
                          </button>
                          <button
                            type="button"
                            className={
                              "btn btn-outline-dark " +
                              (caFilter === "YEAR" ? "active" : "")
                            }
                            onClick={() => setCaFilter("YEAR")}
                          >
                            Cette année
                          </button>
                        </div>
                      </div>

                      <div className="row g-3 mb-4">
                        <div className="col-12 col-md-6 col-lg-4">
                          <div className="card border-0 shadow-sm h-100">
                            <div className="card-body">
                              <div className="text-muted small mb-1">
                                {caCurrent.label}
                              </div>
                              <div className="h5 mb-2">
                                {mad(caCurrent.turnover)} {/* CA (prix normal) */}
                              </div>
                              <div className="small text-muted">
                                Duumini :{" "}
                                <span className="fw-semibold">
                                  {mad(caCurrent.duu)} {/* commission */}
                                </span>
                              </div>
                              <div className="small text-muted">
                                Vendeur :{" "}
                                <span className="fw-semibold">
                                  {mad(caCurrent.vendor)} {/* part vendeur = CA */}
                                </span>
                              </div>
                              <div className="text-muted small mt-1">
                                <em>Montants hors frais de livraison</em>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Produits de la boutique */}
                      <div className="card border-0 shadow-sm">
                        <div className="card-body">
                          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                            <h6 className="m-0">Produits de la boutique</h6>
                            <div className="btn-group btn-group-sm">
                              <button
                                type="button"
                                className={
                                  "btn btn-outline-dark " +
                                  (productFilter === "ALL"
                                    ? "active"
                                    : "")
                                }
                                onClick={() => setProductFilter("ALL")}
                              >
                                Tous
                              </button>
                              <button
                                type="button"
                                className={
                                  "btn btn-outline-dark " +
                                  (productFilter === "MOST_ORDERED"
                                    ? "active"
                                    : "")
                                }
                                onClick={() =>
                                  setProductFilter("MOST_ORDERED")
                                }
                              >
                                Plus commandés
                              </button>
                              <button
                                type="button"
                                className={
                                  "btn btn-outline-dark " +
                                  (productFilter === "BEST_RATED"
                                    ? "active"
                                    : "")
                                }
                                onClick={() =>
                                  setProductFilter("BEST_RATED")
                                }
                              >
                                Mieux notés
                              </button>
                            </div>
                          </div>

                          {productsLoading ? (
                            <div className="text-muted small">
                              Chargement des produits…
                            </div>
                          ) : productsError ? (
                            <div className="alert alert-warning mb-0">
                              {productsError}
                            </div>
                          ) : displayedProducts.length === 0 ? (
                            <div className="text-muted small">
                              Aucun produit ne correspond à ce filtre.
                            </div>
                          ) : (
                            <div className="table-responsive">
                              <table className="table align-middle mb-0">
                                <thead>
                                  <tr>
                                    <th>Produit</th>
                                    <th className="text-center">
                                      Qté totale (30j)
                                    </th>
                                    <th className="text-end">
                                      CA généré (30j, prix normal, hors livraison)
                                    </th>
                                    <th className="text-center">
                                      Note
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayedProducts.map((p) => {
                                    const anyP = p as any;
                                    const rating =
                                      Number(
                                        anyP.avg_rating ??
                                          anyP.average_rating ??
                                          anyP.rating ??
                                          0
                                      ) || 0;
                                    const ratingCount = Number(
                                      anyP.rating_count ??
                                        anyP.ratings_count ??
                                        0
                                    );
                                    const img = productImgUrl(p);
                                    return (
                                      <tr key={p.id}>
                                        <td>
                                          <div className="d-flex align-items-center gap-2">
                                            {img ? (
                                              <img
                                                src={img}
                                                alt={p.name}
                                                style={{
                                                  width: 40,
                                                  height: 40,
                                                  borderRadius: 8,
                                                  objectFit: "cover",
                                                }}
                                              />
                                            ) : (
                                              <div
                                                className="bg-light border rounded"
                                                style={{
                                                  width: 40,
                                                  height: 40,
                                                }}
                                              />
                                            )}
                                            <div className="text-truncate">
                                              <div className="fw-semibold text-truncate">
                                                {p.name}
                                              </div>
                                              <div className="text-muted small">
                                                Prix normal :{" "}
                                                {mad((p as any).price)}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="text-center">
                                          {p.total_qty ?? 0}
                                        </td>
                                        <td className="text-end">
                                          {mad(p.total_amount ?? 0)}
                                        </td>
                                        <td className="text-center">
                                          {rating > 0 ? (
                                            <span className="small">
                                              ⭐ {rating.toFixed(1)}{" "}
                                              {ratingCount > 0 && (
                                                <span className="text-muted">
                                                  ({ratingCount})
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            <span className="text-muted small">
                                              -
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,.2)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {edit == null ? "Nouvelle boutique" : "Modifier boutique"}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setShowForm(false)}
                />
              </div>
              <div className="modal-body">
                <ShopForm initial={edit || undefined} onSubmit={onSave} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
