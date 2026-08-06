// src/pages/vendor/MyShopPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { me } from "../../services/auth";
import {
  listMyShops,
  getShop,
  updateShop,
  createShopSafe,
  isShopLimitError,
  type Shop,
} from "../../services/shops";
import { listActiveCountries, type CountryConfig } from "../../services/countries";
import { imgUrl } from "../../utils/media";
import { Spinner } from "../../components/ui/Spinner";

type AnyObj = Record<string, any>;

type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
} & AnyObj;

const VENDOR_ROUTES = {
  shop: "/ma-boutique",
  products: "/vendeur/produits",
  orders: "/vendeur/commandes",
  promotions: "/vendeur/promotions",
};

function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "VENDEUR" || r === "VENDOR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE";
}

function toInput(v: any) {
  return v == null ? "" : String(v);
}

/**
 * ⚙️ Récupère un shop_id même si le backend renvoie des variantes
 * (shop_id/shopId/store_id/etc.)
 */
function pickShopId(u: AnyObj | null): number | null {
  if (!u) return null;
  const c = [
    u.shop_id,
    u.shopId,
    u.store_id,
    u.storeId,
    u.vendor_shop_id,
    u.vendor?.shop_id,
    u.shop?.id,
    u?.shop?.shop_id,
  ];
  const raw = c.find((x) => x != null);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function EmptyState({
  title,
  desc,
  actions,
  debug,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  debug?: React.ReactNode;
}) {
  return (
    <div className="card shadow-sm">
      <div className="card-body py-4">
        <div className="d-flex flex-column align-items-center text-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: 56,
              height: 56,
              background: "rgba(0,0,0,.06)",
              color: "rgba(0,0,0,.55)",
              fontSize: 24,
            }}
          >
            🏪
          </div>

          <div className="fw-semibold" style={{ fontSize: 16 }}>
            {title}
          </div>

          {desc ? (
            <div className="text-muted small" style={{ maxWidth: 560 }}>
              {desc}
            </div>
          ) : null}

          {actions ? (
            <div className="mt-2 w-100" style={{ maxWidth: 520 }}>
              {actions}
            </div>
          ) : null}

          {debug ? (
            <div className="mt-2 w-100 text-start" style={{ maxWidth: 520 }}>
              {debug}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MyShopPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [noShop, setNoShop] = useState(false);
  const [debugInfo, setDebugInfo] = useState<AnyObj | null>(null);

  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);
  const shopIdFromMe = useMemo(() => pickShopId(user as any), [user]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [countryCode, setCountryCode] = useState("MA");
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ""), [logoFile]);
  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : ""), [coverFile]);

  useEffect(() => {
    return () => {
      try {
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        if (coverPreview) URL.revokeObjectURL(coverPreview);
      } catch {}
    };
  }, [logoPreview, coverPreview]);

  // 1) Charger user (me)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (!mounted) return;
        setUser((u as any) || null);
      } catch {
        if (!mounted) return;
        setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Liste des pays actifs pour le sélecteur "Pays"
  useEffect(() => {
    let mounted = true;
    listActiveCountries()
      .then((items) => {
        if (mounted) setCountries(items);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Si connecté mais pas vendeur => home
  if (user && !isVendor) return <Navigate to="/" replace />;

  function applyShop(s: Shop) {
    setShop(s);
    setName(toInput((s as any).name));
    setDescription(toInput((s as any).description));
    setCity(toInput((s as any).city));
    setAddress(toInput((s as any).address));
    setCountryCode(toInput((s as any).country_code) || "MA");
  }

  // 2) Charger boutique (shopId OU fallback /mine)
  useEffect(() => {
    if (user === null) return;
    if (!isVendor) return;

    (async () => {
      setLoading(true);
      setErr(null);
      setOk(null);
      setNoShop(false);
      setShop(null);
      setDebugInfo(null);

      try {
        // A) si me() contient shop_id -> getShop(id)
        if (shopIdFromMe) {
          const s = await getShop(shopIdFromMe);
          applyShop(s);
          return;
        }

        // B) sinon -> /api/shops/mine
        const mines = await listMyShops();
        const arr = Array.isArray(mines) ? mines : [];

        if (arr.length) {
          const sorted = [...arr].sort((a: any, b: any) => {
            const da = new Date(a?.created_at ?? 0).getTime();
            const db = new Date(b?.created_at ?? 0).getTime();
            return db - da;
          });
          applyShop(sorted[0]);
          return;
        }

        // C) fallback debug
        setNoShop(true);
        setDebugInfo({
          role: user?.role ?? null,
          id: user?.id ?? null,
          shop_id_me: (user as any)?.shop_id ?? (user as any)?.shopId ?? null,
          vendor_id_me: (user as any)?.vendor_id ?? (user as any)?.vendorId ?? null,
          hint:
            "Si une boutique existe mais /api/shops/mine renvoie [], alors shops.owner_id n'est pas égal à users.id.",
        });
      } catch (e: any) {
        setErr(e?.message || "Erreur lors du chargement.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isVendor, shopIdFromMe]);

  async function onSave() {
    if (!shop?.id) return;
    if (saving) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const payload: Partial<Shop> & { description?: string | null } = {
        name: name.trim(),
        description: description.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        country: countries.find((c) => c.code === countryCode)?.label || countryCode,
        country_code: countryCode,
      };

      const updated = await updateShop(shop.id, payload, { logo: logoFile, cover: coverFile });

      setShop(updated);
      setOk("Boutique mise à jour.");

      setLogoFile(null);
      setCoverFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      if (coverInputRef.current) coverInputRef.current.value = "";
    } catch (e: any) {
      setErr(e?.message || "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Crée la première boutique du vendeur — jusqu'ici l'API POST /api/shops
  // existait déjà et fonctionnait, mais rien côté front ne l'appelait : un
  // vendeur sans boutique tombait dans une impasse (« Aucune boutique liée à
  // ce compte » sans aucun moyen d'en créer une), ce qui bloquait aussi
  // l'ajout de produits (qui exige un shop_id).
  async function onCreate() {
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setErr("Le nom de la boutique est obligatoire.");
      return;
    }

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const payload: Partial<Shop> & { description?: string | null } = {
        name: cleanName,
        description: description.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        country: countries.find((c) => c.code === countryCode)?.label || countryCode,
        country_code: countryCode,
      };

      const created = await createShopSafe(payload, { logo: logoFile, cover: coverFile });

      applyShop(created);
      setNoShop(false);
      setOk("Boutique créée avec succès.");

      setLogoFile(null);
      setCoverFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      if (coverInputRef.current) coverInputRef.current.value = "";
    } catch (e: any) {
      setErr(
        isShopLimitError(e)
          ? e?.message || "Limite de boutiques atteinte."
          : e?.message || "Impossible de créer la boutique."
      );
    } finally {
      setSaving(false);
    }
  }

  const cover = coverPreview || imgUrl((shop as any)?.cover) || "";
  const logo = logoPreview || imgUrl((shop as any)?.logo) || "";

  return (
    <div className="container-xxl py-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h5 m-0">Ma boutique</h1>
          <div className="text-muted small">
            {noShop ? "Crée ta boutique pour pouvoir ajouter des produits." : "Modifie les infos de ta boutique."}
          </div>
        </div>

        {/* ✅ Liens vendeur -> bonnes routes */}
        <div className="d-flex gap-2 flex-wrap">
          <Link to={VENDOR_ROUTES.products} className="btn btn-outline-dark">
            Gérer mes produits
          </Link>
          <Link to={VENDOR_ROUTES.orders} className="btn btn-outline-dark">
            Mes commandes
          </Link>
          <Link to={VENDOR_ROUTES.promotions} className="btn btn-outline-dark">
            Promotions
          </Link>
        </div>
      </div>

      {err ? <div className="alert alert-danger">{err}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}

      {loading ? (
        <div className="card shadow-sm">
          <div className="card-body py-4">
            <div className="d-flex align-items-center justify-content-center gap-2 text-muted">
              <Spinner size="sm" />
              <span>Chargement…</span>
            </div>
          </div>
        </div>
      ) : noShop ? (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2 className="h6 mb-1">Créer ma boutique</h2>
            <p className="text-muted small mb-3">
              Ton compte vendeur n’a pas encore de boutique. Crée-la ci-dessous
              pour pouvoir ajouter des produits.
            </p>

            <div className="row g-2">
              <div className="col-12">
                <label className="form-label">Nom de la boutique</label>
                <input
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  placeholder="Ex : Épicerie Bamba"
                />
              </div>

              <div className="col-12">
                <label className="form-label">Description (optionnel)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Pays</label>
                <select
                  className="form-select"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={saving}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Ville</label>
                <input
                  className="form-control"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Adresse (optionnel)</label>
                <input
                  className="form-control"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Logo (optionnel)</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  disabled={saving}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Couverture (optionnel)</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-duu-green" disabled={saving} onClick={onCreate}>
                {saving ? "Création…" : "Créer ma boutique"}
              </button>
            </div>
          </div>

          {import.meta.env.DEV ? (
            <div className="card-body border-top pt-3">
              <div className="text-muted small">
                <div className="fw-semibold">Debug (dev)</div>
                <div>role: {String(debugInfo?.role ?? "—")}</div>
                <div>id: {String(debugInfo?.id ?? "—")}</div>
                <div>shop_id (me): {String(debugInfo?.shop_id_me ?? "—")}</div>
                <div>vendor_id (me): {String(debugInfo?.vendor_id_me ?? "—")}</div>
                <div className="mt-2">{String(debugInfo?.hint ?? "")}</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : !shop ? (
        <EmptyState
          title="Boutique introuvable"
          desc="Une boutique semble référencée, mais n’a pas pu être chargée."
          actions={
            <div className="d-grid gap-2">
              <button className="btn btn-outline-dark" onClick={() => window.location.reload()}>
                Recharger
              </button>
              <Link to="/" className="btn btn-duu">
                Retour à l’accueil
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="card shadow-sm mb-3 overflow-hidden">
            <div
              style={{
                height: 180,
                background: cover ? `url(${cover}) center/cover no-repeat` : "linear-gradient(135deg,#f2f2f2,#e7e7e7)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,.45), rgba(0,0,0,.05))",
                }}
              />
              <div className="d-flex align-items-end gap-3 p-3" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "#fff",
                    border: "2px solid rgba(255,255,255,.6)",
                    boxShadow: "0 6px 18px rgba(0,0,0,.15)",
                  }}
                >
                  {logo ? (
                    <img src={logo} alt="Logo boutique" className="w-100 h-100 object-fit-cover" />
                  ) : (
                    <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">—</div>
                  )}
                </div>

                <div className="text-white" style={{ minWidth: 0 }}>
                  <div className="fw-bold text-truncate" style={{ fontSize: 18 }}>
                    {(shop as any).name}
                  </div>
                  <div className="small text-white-50 text-truncate">
                    #{(shop as any).id} • {(shop as any)?.city || "—"}
                  </div>
                </div>

                <div className="ms-auto d-none d-sm-flex gap-2">
                  <button className="btn btn-sm btn-light" onClick={() => coverInputRef.current?.click()} disabled={saving}>
                    Changer couverture
                  </button>
                  <button className="btn btn-sm btn-light" onClick={() => logoInputRef.current?.click()} disabled={saving}>
                    Changer logo
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body">
              <div className="row g-2">
                <div className="col-12 col-sm-6">
                  <label className="form-label">Couverture</label>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    disabled={saving}
                  />
                  <div className="text-muted small mt-1">Recommandé: 1200×400</div>
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label">Logo</label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    disabled={saving}
                  />
                  <div className="text-muted small mt-1">Recommandé: carré (512×512)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm">
                <div className="card-body">
                  <h2 className="h6 mb-3">Informations boutique</h2>

                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label">Nom</label>
                      <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Slug</label>
                      <input className="form-control" value={toInput((shop as any)?.slug)} disabled />
                      <div className="text-muted small mt-1">Le slug est généré/maintenu par le backend.</div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Pays</label>
                      <select
                        className="form-select"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        disabled={saving}
                      >
                        {countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Ville</label>
                      <input className="form-control" value={city} onChange={(e) => setCity(e.target.value)} disabled={saving} />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Adresse</label>
                      <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} />
                    </div>
                  </div>

                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button
                      className="btn btn-outline-dark"
                      disabled={saving}
                      onClick={() => {
                        setName(toInput((shop as any)?.name));
                        setDescription(toInput((shop as any)?.description));
                        setCity(toInput((shop as any)?.city));
                        setAddress(toInput((shop as any)?.address));
                        setCountryCode(toInput((shop as any)?.country_code) || "MA");
                        setLogoFile(null);
                        setCoverFile(null);
                        if (logoInputRef.current) logoInputRef.current.value = "";
                        if (coverInputRef.current) coverInputRef.current.value = "";
                        setOk(null);
                        setErr(null);
                      }}
                    >
                      Annuler
                    </button>

                    <button className="btn btn-dark" disabled={saving} onClick={onSave}>
                      {saving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="card shadow-sm">
                <div className="card-body">
                  <h2 className="h6 mb-2">Raccourcis</h2>

                  <div className="d-grid gap-2">
                    <Link to={VENDOR_ROUTES.products} className="btn btn-outline-dark">
                      Gérer mes produits
                    </Link>
                    <Link to={VENDOR_ROUTES.orders} className="btn btn-outline-dark">
                      Voir mes commandes
                    </Link>
                    <Link to={VENDOR_ROUTES.promotions} className="btn btn-outline-dark">
                      Promotions
                    </Link>
                  </div>

                  <hr className="my-3" />

                  <div className="text-muted small">
                    Boutique créée:{" "}
                    <span className="fw-semibold">
                      {(shop as any)?.created_at ? new Date((shop as any).created_at).toLocaleString("fr-FR") : "—"}
                    </span>
                    <br />
                    Dernière maj:{" "}
                    <span className="fw-semibold">
                      {(shop as any)?.updated_at ? new Date((shop as any).updated_at).toLocaleString("fr-FR") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
        }
        .btn-duu:hover{ filter: brightness(0.95); }
      `}</style>
    </div>
  );
}