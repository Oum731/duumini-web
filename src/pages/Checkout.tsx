// src/pages/CheckoutPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useCart, mad } from "../store/cart";
import { me, getAccessToken } from "../services/auth";
import {
  createOrder,
  createGuestOrder,
  type CreateOrderPayload,
} from "../services/orders";
import { normalizePhoneInput, isValidPhoneIntl } from "../utils/phone";
import { trackPurchase } from "../lib/analytics";
import {
  useLocationCity,
  CITY_OPTIONS,
  type CityCode,
} from "../context/LocationContext";
import { api } from "../services/http";

/* ——— Style local : focus rouge + état loading ——— */
const FocusAndLoadingStyle = () => (
  <style>{`
    .checkout .btn:focus,
    .checkout .btn:focus-visible {
      outline: none !important;
      box-shadow: 0 0 0 .25rem rgba(229, 57, 53, .35) !important;
      border-color: #E53935 !important;
    }
    .checkout .btn-duu:focus,
    .checkout .btn-duu:focus-visible {
      box-shadow: 0 0 0 .3rem rgba(229, 57, 53, .35) !important;
    }
    .btn[aria-busy="true"] { pointer-events: none; opacity: .9; }
    .btn .visually-hidden {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    /* petites améliorations UI */
    .addr-pill{
      display:inline-flex;
      align-items:center;
      gap:.5rem;
      padding:.35rem .6rem;
      border-radius:999px;
      border:1px solid rgba(0,0,0,.08);
      background:rgba(255,255,255,.7);
      font-weight:700;
      color:#111;
      max-width:100%;
    }
    .addr-pill small{
      font-weight:600;
      color:rgba(0,0,0,.62);
    }
  `}</style>
);

/* =========================
   ✅ Location Suggestions API
   (table: location_suggestions)
   ========================= */

type LocationSuggestion = {
  value: string;
  count?: number;
};

type ItemsEnvelope<T> = { items: T[] };

function normalizeSuggestionItems(input: any): LocationSuggestion[] {
  const arr = input?.items ?? input ?? [];
  if (!Array.isArray(arr)) return [];
  // items: string[]
  if (arr.length && typeof arr[0] === "string") {
    return arr.map((s: string) => ({ value: String(s) }));
  }
  // items: {value,count}[]
  return arr
    .map((x: any) => ({
      value: String(x?.value ?? x?.name ?? "").trim(),
      count: x?.count != null ? Number(x.count) || 0 : undefined,
    }))
    .filter((x: LocationSuggestion) => !!x.value);
}

async function listCommunesByCity(ville?: string) {
  const v = String(ville || "").trim();
  if (!v) return [] as LocationSuggestion[];
  const res = await api.get<ItemsEnvelope<any>>("/api/locations/communes", {
    query: { ville: v, limit: 30 },
  });
  return normalizeSuggestionItems(res);
}

async function listQuartiersByCityCommune(ville?: string, commune?: string) {
  const v = String(ville || "").trim();
  const c = String(commune || "").trim();
  if (!v || !c) return [] as LocationSuggestion[];
  const res = await api.get<ItemsEnvelope<any>>("/api/locations/quartiers", {
    query: { ville: v, commune: c, limit: 30 },
  });
  return normalizeSuggestionItems(res);
}

async function trackLocationSuggestion(
  kind: "VILLE" | "COMMUNE" | "QUARTIER",
  payload: { ville?: string; commune?: string; quartier?: string }
) {
  // Best-effort (pas bloquant)
  try {
    await api.post("/api/locations/track", { kind, ...payload });
  } catch {
    // ignore
  }
}

/* =========================
   ✅ Livraison pro (sans Simple/Express)
   - Casablanca: 25 DH
   - Hors Casablanca: dès 60 DH (selon la ville)
   ========================= */

function normToken(x: any) {
  return String(x ?? "").trim().toLowerCase();
}
function productSubToken(p: any) {
  const bySlug = normToken(p?.sub_category_slug);
  if (bySlug) return bySlug;

  const byName = normToken(p?.sub_category_name);
  if (byName) return byName;

  const id = p?.sub_category_id;
  if (id != null && String(id).trim() !== "") return normToken(String(id));

  return "";
}
function isFoodLike(p: any) {
  const t = productSubToken(p);
  if (t) return t === "food" || t.includes("food") || t.includes("alimentation");
  return normToken(p?.category) === "food";
}

/** ✅ Barème pro: configurable */
const DELIVERY_RULES = {
  CASABLANCA_FEE: 25,
  DEFAULT_MIN_OUTSIDE_CASA: 60,
};

function cityLabelFromCode(city?: string | null) {
  const found = CITY_OPTIONS.find((c) => c.code === city);
  return found?.label || "";
}
function isCasablanca(label: string) {
  const s = String(label || "").trim().toLowerCase();
  return s.includes("casa");
}
function computeDeliveryFeeByCity(cityLabel: string) {
  if (!cityLabel) return DELIVERY_RULES.DEFAULT_MIN_OUTSIDE_CASA;
  if (isCasablanca(cityLabel)) return DELIVERY_RULES.CASABLANCA_FEE;
  return DELIVERY_RULES.DEFAULT_MIN_OUTSIDE_CASA;
}

/* =========================
   ✅ Checkout
   ========================= */

export default function CheckoutPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { lines, totalAmount, totalItems, clear } = useCart();

  const { city, setCity, isReady } = useLocationCity();
  const cityLabel = useMemo(() => cityLabelFromCode(city), [city]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestAddress, setGuestAddress] = useState("");

  const [phone, setPhone] = useState("");

  const [commune, setCommune] = useState<string>("");
  const [communeOther, setCommuneOther] = useState("");
  const [quartier, setQuartier] = useState("");

  const [communeSuggestions, setCommuneSuggestions] = useState<LocationSuggestion[]>([]);
  const [quartierSuggestions, setQuartierSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const [useGps, setUseGps] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingRefill, setLoadingRefill] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingAddress, setEditingAddress] = useState(true);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);

  const hasToken = !!getAccessToken?.();
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  useEffect(() => {
    if (!hasToken) setGuestConfirmed(true);
  }, [hasToken]);

  const [showGuestSuccess, setShowGuestSuccess] = useState(false);

  // (info uniquement)
  const hasPromoInCart = useMemo(() => {
    return (lines || []).some((l: any) => {
      const p = l?.product ?? l;
      const isFood = isFoodLike(p);
      const eligible = Number(p?.promo_eligible ?? 0) === 1;
      const val = Number(p?.promo_discount_value ?? 0) > 0;
      return !isFood && eligible && val;
    });
  }, [lines]);

  const deliveryFee = useMemo(() => computeDeliveryFeeByCity(cityLabel), [cityLabel]);
  const grandTotal = totalAmount + deliveryFee;

  const handlePhoneChange = useCallback((e: any) => {
    const v = normalizePhoneInput(e.target.value as string);
    setPhone(v);
  }, []);

  const validPhone = isValidPhoneIntl(phone);

  const communeVal = useMemo(() => {
    const base = String(commune || "").trim();
    if (!base) return communeOther.trim();
    if (base === "__other__") return communeOther.trim();
    return base;
  }, [commune, communeOther]);

  const hasName = hasToken
    ? firstName.trim().length > 0 || lastName.trim().length > 0
    : guestName.trim().length > 0;

  const addressOk = hasToken
    ? !!cityLabel && (useGps ? !!coords : (communeVal.length > 0 && quartier.trim().length > 0))
    : !!cityLabel && (useGps ? !!coords : guestAddress.trim().length > 0);

  const canSubmit =
    lines.length > 0 &&
    hasName &&
    validPhone &&
    addressOk &&
    (hasToken || guestConfirmed);

  const askGps = useCallback(() => {
    setGpsErr(null);
    setLoadingGps(true);
    if (!("geolocation" in navigator)) {
      setGpsErr("La géolocalisation n’est pas supportée par ce navigateur.");
      setLoadingGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUseGps(true);
        setLoadingGps(false);
      },
      (err) => {
        setGpsErr(
          err?.message ||
            "Impossible d’obtenir la position (permission refusée ou indisponible)."
        );
        setLoadingGps(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  /* ---------- Pré-remplissage depuis /me ---------- */
  useEffect(() => {
    if (!isReady) return;

    if (!hasToken) {
      setLoading(false);
      setEditingAddress(true);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const u = await me();
        if (u) {
          setFirstName((u as any).first_name || "");
          setLastName((u as any).last_name || "");
          setPhone(normalizePhoneInput((u as any).phone || ""));

          const profileCityRaw = String((u as any).city || (u as any).ville || "")
            .trim()
            .toLowerCase();

          if (!city) {
            if (profileCityRaw.includes("casa")) setCity("CASABLANCA" as CityCode);
            else if (profileCityRaw.includes("marr")) setCity("MARRAKECH" as CityCode);
          }

          const c = String((u as any).commune || "").trim();
          const q = String((u as any).quartier || "").trim();
          setCommune(c || "");
          setCommuneOther("");
          setQuartier(q || "");

          setEditingAddress(false);
          setSaveAddressToProfile(false);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, location.pathname, isReady]);

  const refillFromProfile = useCallback(async () => {
    try {
      setErr(null);
      setLoadingRefill(true);
      const u = await me();
      if (u) {
        setFirstName((u as any).first_name || "");
        setLastName((u as any).last_name || "");
        setPhone(normalizePhoneInput((u as any).phone || ""));

        const c = String((u as any).commune || "").trim();
        const q = String((u as any).quartier || "").trim();
        setCommune(c || "");
        setCommuneOther("");
        setQuartier(q || "");

        setEditingAddress(false);
        setSaveAddressToProfile(false);
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger votre profil.");
    } finally {
      setLoadingRefill(false);
    }
  }, []);

  /* ✅ Suggestions */
  useEffect(() => {
    if (!isReady) return;
    const v = String(cityLabel || "").trim();
    if (!v) return;

    setLoadingSuggest(true);
    (async () => {
      try {
        const communes = await listCommunesByCity(v);
        setCommuneSuggestions(communes || []);
      } catch {
        setCommuneSuggestions([]);
      } finally {
        setLoadingSuggest(false);
      }
    })();

    trackLocationSuggestion("VILLE", { ville: v });
  }, [cityLabel, isReady]);

  useEffect(() => {
    const v = String(cityLabel || "").trim();
    const c = String(communeVal || "").trim();
    if (!v || !c) {
      setQuartierSuggestions([]);
      return;
    }

    setLoadingSuggest(true);
    (async () => {
      try {
        const qs = await listQuartiersByCityCommune(v, c);
        setQuartierSuggestions(qs || []);
      } catch {
        setQuartierSuggestions([]);
      } finally {
        setLoadingSuggest(false);
      }
    })();

    trackLocationSuggestion("COMMUNE", { ville: v, commune: c });
  }, [cityLabel, communeVal]);

  const submitOrder = useCallback(async () => {
    if (!canSubmit || submitting) return;

    try {
      setErr(null);
      setSubmitting(true);

      const normalizedPhone = normalizePhoneInput(phone.trim());
      const finalCity = cityLabel || "";

      const address: CreateOrderPayload["address"] = hasToken
        ? {
            ville: finalCity || undefined,
            commune: communeVal ? String(communeVal) : undefined,
            quartier: useGps ? null : quartier.trim() || null,
            gps: useGps && coords ? { lat: coords.lat, lng: coords.lng } : null,
          }
        : {
            ville: finalCity || undefined,
            commune: undefined,
            quartier: useGps ? null : guestAddress.trim() || null,
            gps: useGps && coords ? { lat: coords.lat, lng: coords.lng } : null,
          };

      const fullName = hasToken
        ? (
            `${firstName.trim()} ${lastName.trim()}`.trim() ||
            firstName.trim() ||
            lastName.trim()
          ).trim()
        : guestName.trim();

      const contact = {
        first_name: hasToken ? firstName.trim() || undefined : undefined,
        last_name: hasToken ? lastName.trim() || undefined : undefined,
        name: !hasToken ? fullName || undefined : undefined,
        phone: normalizedPhone,
      };

      const finalDeliveryFee = deliveryFee;
      const finalGrandTotal = totalAmount + finalDeliveryFee;

      const payload: CreateOrderPayload = {
        contact,
        address,
        delivery: {
          mode: isCasablanca(finalCity) ? ("CASABLANCA" as any) : ("CITY" as any),
          fee: finalDeliveryFee,
          currency: "MAD",
        },
        items: lines.map((l: any) => ({
          product_id: l.id,
          name: l.name,
          price: l.price,
          qty: l.qty,
        })),
        totals: {
          items_count: totalItems,
          items_amount: totalAmount,
          delivery_fee: finalDeliveryFee,
          amount: finalGrandTotal,
          currency: "MAD",
        },
        payment: {
          method: "COD",
          note: "Paiement à la livraison. Aucun acompte requis.",
        },

        address_city: address.ville,
        address_commune: (address as any).commune ?? null,
        address_district: address.quartier,
        address_gps_lat: address.gps?.lat ?? null,
        address_gps_lng: address.gps?.lng ?? null,
      };

      const result = hasToken
        ? await createOrder(payload)
        : await createGuestOrder(payload);

      const orderId = (result as any).id;

      const createdAtStr =
        (result as any).created_at ||
        (result as any).created ||
        new Date().toISOString();
      const createdAt = new Date(createdAtStr);

      const numericId =
        typeof orderId === "number" ? orderId : Number(orderId) || 0;
      const displayCode = numericId
        ? numericId.toString(36).toUpperCase()
        : String(orderId ?? "").toUpperCase();

      try {
        trackPurchase({
          orderId: orderId ?? displayCode,
          value: finalGrandTotal,
          currency: "MAD",
          items: lines.map((l: any) => {
            const category =
              l.category_name ||
              l.sub_category_name ||
              l.sub_category_slug ||
              (l.sub_category_id != null && String(l.sub_category_id).trim() !== ""
                ? String(l.sub_category_id)
                : "") ||
              "";

            return {
              id: l.id,
              name: l.name,
              price: l.price,
              quantity: l.qty,
              category,
            };
          }),
        });
      } catch {}

      const isCasa = isCasablanca(finalCity);
      const minStart = isCasa ? 25 : 60;
      const minEnd = isCasa ? 90 : 180;

      const etaStart = new Date(createdAt.getTime() + minStart * 60_000);
      const etaEnd = new Date(createdAt.getTime() + minEnd * 60_000);

      try {
        window.localStorage.setItem(
          "duumini:lastOrderInfo",
          JSON.stringify({
            id: numericId || orderId,
            displayCode,
            createdAt: createdAt.toISOString(),
            deliveryMode: isCasa ? "CASABLANCA" : "CITY",
            etaStart: etaStart.toISOString(),
            etaEnd: etaEnd.toISOString(),
            etaTarget: etaEnd.toISOString(),
            guest: !hasToken,
            city: finalCity || null,
          })
        );
        if (!hasToken) {
          window.localStorage.setItem("duumini:guestWidgetMinimized", "0");
        }
      } catch {}

      if (!useGps) {
        trackLocationSuggestion("QUARTIER", {
          ville: finalCity,
          commune: communeVal || undefined,
          quartier: hasToken ? quartier.trim() : guestAddress.trim(),
        });
      }

      if (hasToken && saveAddressToProfile) {
        try {
          await api.put("/api/user/me", {
            ville: finalCity,
            commune: communeVal || null,
            quartier: useGps ? null : quartier.trim() || null,
          });
        } catch {
          // non bloquant
        }
      }

      clear();

      if (hasToken) {
        nav(`/orders?order=${orderId}`);
      } else {
        setShowGuestSuccess(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de confirmer la commande pour le moment.");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    submitting,
    phone,
    cityLabel,
    hasToken,
    communeVal,
    quartier,
    useGps,
    coords,
    firstName,
    lastName,
    guestName,
    guestAddress,
    deliveryFee,
    totalAmount,
    totalItems,
    lines,
    clear,
    nav,
    saveAddressToProfile,
  ]);

  const headerRight = useMemo(
    () => (
      <div className="text-end">
        <div className="small text-muted">Total à payer</div>
        <div className="h5 m-0">{mad(grandTotal)}</div>
        <div className="small text-muted">Dont livraison: {mad(deliveryFee)}</div>
      </div>
    ),
    [grandTotal, deliveryFee]
  );

  if (!isReady || loading) {
    return (
      <div className="container-xxl py-4">
        <div className="text-muted">Chargement…</div>
      </div>
    );
  }

  if (!lines.length && !showGuestSuccess) {
    return (
      <div className="container-xxl py-4">
        <div className="text-center text-muted py-5">
          <p className="mb-3">Votre panier est vide.</p>
          <Link to="/" className="btn btn-dark">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  const deliveryTitle = isCasablanca(cityLabel)
    ? "Livraison Casablanca 25 DH"
    : "Hors Casablanca dès 60 DH (selon la ville)";

  return (
    <section className="container-xxl py-4 checkout">
      <FocusAndLoadingStyle />

      {/* ✅ Modale de succès invité */}
      {showGuestSuccess && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Commande envoyée <span aria-hidden="true">🎉</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fermer"
                    onClick={() => {
                      setShowGuestSuccess(false);
                      nav("/");
                    }}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-2">Merci&nbsp;! Votre commande a bien été envoyée.</p>
                  <p className="mb-2">
                    Un membre de l’équipe Duumini va vous{" "}
                    <strong>contacter très bientôt par téléphone</strong>.
                  </p>
                  <p className="mb-0 small text-muted">
                    Pour <strong>voir l’historique</strong> et{" "}
                    <strong>suivre vos commandes</strong>, vous pouvez vous connecter
                    ou créer un compte.
                  </p>
                </div>
                <div className="modal-footer d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setShowGuestSuccess(false);
                      nav("/");
                    }}
                  >
                    Retour à l’accueil
                  </button>

                  <Link
                    to="/profile?tab=login&next=/orders"
                    className="btn btn-outline-dark"
                    onClick={() => setShowGuestSuccess(false)}
                  >
                    Se connecter
                  </Link>

                  <Link
                    to="/profile?tab=register&next=/orders"
                    className="btn btn-duu"
                    onClick={() => setShowGuestSuccess(false)}
                  >
                    Créer un compte
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>
            Confirmer la commande
          </h1>

          <div className="text-muted d-flex flex-wrap align-items-center gap-2">
            <span>
              Livraison sur{" "}
              <span className="addr-pill">
                <span>📍 {cityLabel || "—"}</span>
                <small>• {mad(deliveryFee)}</small>
              </span>
            </span>

            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={() => window.dispatchEvent(new Event("city:open"))}
              title="Changer la ville de livraison"
            >
              Changer de ville
            </button>

            {hasPromoInCart && (
              <span className="badge text-bg-warning">
                Promo active (sans livraison gratuite)
              </span>
            )}
          </div>
        </div>

        {headerRight}
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {!hasToken && (
        <div className="alert alert-info mb-3">
          <div className="fw-semibold mb-1">Commander sans créer de compte</div>
          <p className="mb-2 small">
            Vous pouvez finaliser votre commande <strong>en tant qu’invité</strong>.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-dark"
              onClick={() => setGuestConfirmed(true)}
            >
              Continuer en tant qu’invité
            </button>
            <Link
              to="/profile?tab=login&next=/checkout"
              className="btn btn-sm btn-outline-dark"
            >
              Se connecter
            </Link>
            <Link
              to="/profile?tab=register&next=/checkout"
              className="btn btn-sm btn-outline-secondary"
            >
              Créer un compte
            </Link>
          </div>

          {guestConfirmed && (
            <p className="mt-2 small mb-0">
              ✅ Mode invité activé. Remplissez le formulaire puis confirmez la commande.
            </p>
          )}
        </div>
      )}

      <div className="row g-4">
        {/* Formulaire */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h6 m-0">Vos coordonnées</h2>

                {hasToken && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={refillFromProfile}
                    disabled={loadingRefill}
                    aria-busy={loadingRefill}
                  >
                    {loadingRefill ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Rechargement…
                        <span className="visually-hidden">en cours</span>
                      </>
                    ) : (
                      "Recharger depuis mon profil"
                    )}
                  </button>
                )}
              </div>

              {/* ✅ Formulaire connecté vs invité */}
              {hasToken ? (
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Prénom</label>
                    <input
                      className="form-control"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Nom</label>
                    <input
                      className="form-control"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Nom"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Téléphone</label>
                    <input
                      type="tel"
                      className={`form-control ${phone && !isValidPhoneIntl(phone) ? "is-invalid" : ""}`}
                      placeholder="+212..."
                      value={phone}
                      onChange={handlePhoneChange}
                    />
                    {phone && !isValidPhoneIntl(phone) && (
                      <div className="invalid-feedback">
                        Numéro invalide. Utilisez le format international : +2126…, +225…, +223…, +1…
                      </div>
                    )}
                    <div className="form-text">
                      🟢 <strong>Idéalement, utilisez votre numéro WhatsApp</strong>.
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <div className="d-flex gap-2">
                      <input className="form-control" value={cityLabel || ""} disabled />
                      <button
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() => window.dispatchEvent(new Event("city:open"))}
                        title="Changer la ville de livraison"
                      >
                        Changer
                      </button>
                    </div>
                    <div className="form-text">La ville vient de votre sélection (LocationGate).</div>
                  </div>

                  {/* ✅ Adresse pro */}
                  <div className="col-12">
                    {!editingAddress ? (
                      <div className="alert alert-light border d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div className="small">
                          <div className="fw-semibold">Adresse de livraison</div>
                          <div className="text-muted">
                            {cityLabel || "—"}
                            {communeVal ? `, ${communeVal}` : ""}
                            {quartier ? ` — ${quartier}` : ""}
                            {useGps && coords
                              ? ` (GPS ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
                              : ""}
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark"
                            onClick={() => setEditingAddress(true)}
                          >
                            Changer d’adresse
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label">Commune</label>
                          <select
                            className="form-select"
                            value={commune || "__other__"}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCommune(v === "__other__" ? "" : v);
                              if (v !== "__other__") setCommuneOther("");
                            }}
                          >
                            <option value="__other__">Autre…</option>
                            {(communeSuggestions || []).map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.value}
                                {s.count ? ` (${s.count})` : ""}
                              </option>
                            ))}
                          </select>

                          {(!commune || commune === "__other__") && (
                            <input
                              className="form-control mt-2"
                              placeholder="Saisir votre commune"
                              value={communeOther}
                              onChange={(e) => setCommuneOther(e.target.value)}
                            />
                          )}

                          <div className="form-text">
                            {loadingSuggest
                              ? "Chargement suggestions…"
                              : "Choisissez une commune ou saisissez-la."}
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label">Quartier</label>
                          {!useGps ? (
                            <>
                              <input
                                className="form-control"
                                value={quartier}
                                onChange={(e) => setQuartier(e.target.value)}
                                placeholder="Ex: Quartier…, repère…"
                                list="quartier-suggestions"
                              />
                              <datalist id="quartier-suggestions">
                                {(quartierSuggestions || []).map((s) => (
                                  <option key={s.value} value={s.value} />
                                ))}
                              </datalist>
                              <div className="form-text">
                                Astuce : commence à taper pour voir des suggestions.
                              </div>
                            </>
                          ) : (
                            <div className="alert alert-info d-flex justify-content-between align-items-center">
                              <span>
                                Localisation GPS activée{" "}
                                {coords ? `(${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})` : ""}.
                              </span>
                              <button
                                className="btn btn-sm btn-outline-dark"
                                type="button"
                                onClick={() => {
                                  setUseGps(false);
                                  setCoords(null);
                                }}
                              >
                                Changer
                              </button>
                            </div>
                          )}

                          {!useGps && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark mt-2"
                              onClick={askGps}
                              disabled={loadingGps}
                              aria-busy={loadingGps}
                            >
                              {loadingGps ? "Activation…" : "Utiliser ma position"}
                            </button>
                          )}

                          {gpsErr && <div className="form-text text-danger">{gpsErr}</div>}
                        </div>

                        <div className="col-12 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                          <label className="form-check m-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={saveAddressToProfile}
                              onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                            />
                            <span className="form-check-label ms-2">
                              Enregistrer cette adresse dans mon profil
                            </span>
                          </label>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              setEditingAddress(false);
                              setSaveAddressToProfile(false);
                            }}
                          >
                            Terminer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Nom complet</label>
                    <input
                      className="form-control"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ex: Oumar Traoré"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Téléphone</label>
                    <input
                      type="tel"
                      className={`form-control ${phone && !isValidPhoneIntl(phone) ? "is-invalid" : ""}`}
                      placeholder="+212..., +225..., +223..., +1..."
                      value={phone}
                      onChange={handlePhoneChange}
                    />
                    {phone && !isValidPhoneIntl(phone) && (
                      <div className="invalid-feedback">
                        Numéro invalide. Utilisez le format international : +2126…, +225…, +223…, +1…
                      </div>
                    )}
                    <div className="form-text">
                      🟢 <strong>Idéalement, utilisez votre numéro WhatsApp</strong>.
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <div className="d-flex gap-2">
                      <input className="form-control" value={cityLabel || ""} disabled />
                      <button
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() => window.dispatchEvent(new Event("city:open"))}
                        title="Changer la ville de livraison"
                      >
                        Changer
                      </button>
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label d-flex align-items-center justify-content-between">
                      <span>Adresse complète / Localisation</span>
                      <span className="small">
                        {useGps && coords ? (
                          <span className="text-success">
                            GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark"
                            onClick={askGps}
                            disabled={loadingGps}
                            aria-busy={loadingGps}
                          >
                            {loadingGps ? "Activation…" : "Utiliser ma position"}
                          </button>
                        )}
                      </span>
                    </label>

                    {!useGps ? (
                      <>
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="Ex: Quartier..., immeuble..., appartement..."
                          value={guestAddress}
                          onChange={(e) => setGuestAddress(e.target.value)}
                        />
                        {gpsErr && <div className="form-text text-danger mt-1">{gpsErr}</div>}
                        <div className="form-text">Adresse complète ou GPS.</div>
                      </>
                    ) : (
                      <>
                        <div className="alert alert-info d-flex justify-content-between align-items-center">
                          <span>
                            Localisation GPS activée{" "}
                            {coords ? `(${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})` : ""}.
                          </span>
                          <button
                            className="btn btn-sm btn-outline-dark"
                            type="button"
                            onClick={() => {
                              setUseGps(false);
                              setCoords(null);
                            }}
                          >
                            Changer
                          </button>
                        </div>
                        {gpsErr && <div className="form-text text-danger">{gpsErr}</div>}
                        <div className="form-text">Précisions optionnelles :</div>
                        <textarea
                          className="form-control mt-2"
                          rows={2}
                          placeholder="Repère, étage, porte… (optionnel)"
                          value={guestAddress}
                          onChange={(e) => setGuestAddress(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Livraison (nouveau modèle) */}
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h6 mb-2">Livraison</h2>

              <div className="alert alert-light border mb-0">
                <div className="fw-semibold">🚚 {deliveryTitle}</div>
                <div className="small text-muted">
                  La livraison est calculée automatiquement selon votre ville.
                </div>
                <div className="small mt-2">
                  Ville sélectionnée : <strong>{cityLabel || "—"}</strong> • Frais :{" "}
                  <strong>{mad(deliveryFee)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="d-grid d-sm-flex gap-2 mt-3">
            <Link to="/cart" className="btn btn-outline-dark">
              Retour au panier
            </Link>

            <button
              className="btn btn-duu"
              onClick={submitOrder}
              disabled={!canSubmit || submitting}
              aria-busy={submitting}
              title={!canSubmit ? "Complétez les champs requis" : "Confirmer la commande"}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Confirmation…
                  <span className="visually-hidden">de la commande</span>
                </>
              ) : (
                "Confirmer la commande"
              )}
            </button>
          </div>
        </div>

        {/* Récap */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h6 mb-3">Récapitulatif</h2>

              <ul className="list-group list-group-flush">
                {lines.map((l: any) => (
                  <li
                    key={l.id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <span className="text-truncate" style={{ maxWidth: 260 }}>
                      {l.name} <span className="text-muted">×{l.qty}</span>
                    </span>
                    <span className="fw-semibold">{mad(l.qty * l.price)}</span>
                  </li>
                ))}

                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span className="text-muted">Livraison</span>
                  <span className="fw-semibold">{mad(deliveryFee)}</span>
                </li>
              </ul>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="text-muted">Sous-total articles</div>
                <div className="fw-semibold">{mad(totalAmount)}</div>
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted">Total à payer</div>
                <div className="h5 m-0">{mad(grandTotal)}</div>
              </div>

              <div className="alert alert-secondary mt-3 mb-0">
                <div className="fw-semibold mb-1">Paiement à la livraison</div>
                <small className="d-block text-muted">
                  Vous réglez <strong>à la réception</strong> — en{" "}
                  <strong>espèces</strong>. Aucun acompte requis.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
