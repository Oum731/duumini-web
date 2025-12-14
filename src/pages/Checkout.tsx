// src/pages/Checkout.tsx
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
    .btn[aria-busy="true"] {
      pointer-events: none;
      opacity: .9;
    }
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
  `}</style>
);

/* =========================
   ✅ Communes par ville
   ========================= */

const COMMUNES_BY_CITY: Record<string, readonly string[]> = {
  CASABLANCA: [
    "Anfa",
    "Maârif",
    "Sidi Belyout",
    "Aïn Chock",
    "Hay Hassani",
    "Ben Msick",
    "Moulay Rachid",
    "Sidi Bernoussi",
    "Aïn Sebaâ",
    "Al Fida",
    "Mers Sultan",
    "Sidi Othmane",
    "__other__",
  ],
  MARRAKECH: [
    "Gueliz",
    "Hivernage",
    "Medina",
    "Sidi Youssef Ben Ali",
    "Menara",
    "Annakhil (Palmeraie)",
    "Tassoultante",
    "Saada",
    "Ouahat Sidi Brahim",
    "__other__",
  ],
};

const COMMUNES_DEFAULT = ["__other__"] as const;

function cityKeyFromLabel(label: string) {
  const k = String(label || "").trim().toUpperCase();
  if (k.includes("CASA")) return "CASABLANCA";
  if (k.includes("MARRA")) return "MARRAKECH";
  return k;
}

type DeliveryMode = "EXPRESS" | "SIMPLE";
const FEES: Record<DeliveryMode, number> = { EXPRESS: 50, SIMPLE: 25 };

export default function CheckoutPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { lines, totalAmount, totalItems, clear } = useCart();

  // ✅ Ville depuis LocationContext (modifiable via LocationGate)
  const { city, setCity, isReady } = useLocationCity();

  const cityLabel = useMemo(() => {
    const found = CITY_OPTIONS.find((c) => c.code === city);
    return found?.label || "";
  }, [city]);

  const cityKey = useMemo(() => cityKeyFromLabel(cityLabel), [cityLabel]);

  const COMMUNES = useMemo(() => {
    const arr = COMMUNES_BY_CITY[cityKey];
    return (arr && arr.length ? arr : COMMUNES_DEFAULT) as readonly string[];
  }, [cityKey]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestAddress, setGuestAddress] = useState("");

  const [phone, setPhone] = useState("");

  // ✅ commune dynamique (string) + autre
  const [commune, setCommune] = useState<string>("__other__");
  const [communeOther, setCommuneOther] = useState("");
  const [quartier, setQuartier] = useState("");

  const [useGps, setUseGps] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingRefill, setLoadingRefill] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [delivery, setDelivery] = useState<DeliveryMode>("SIMPLE");

  const hasToken = !!getAccessToken?.();
  const [guestConfirmed, setGuestConfirmed] = useState(false);

  useEffect(() => {
    if (!hasToken) setGuestConfirmed(true);
  }, [hasToken]);

  const [showGuestSuccess, setShowGuestSuccess] = useState(false);

  /* ✅ Détection panier promo (au moins 1 produit promo non-food) */
  const hasPromoInCart = useMemo(() => {
    return (lines || []).some((l: any) => {
      const p = l?.product ?? l;
      const isFood =
        String(p?.sub_category || p?.category || "").toLowerCase() === "food";
      const eligible = Number(p?.promo_eligible ?? 0) === 1;
      const val = Number(p?.promo_discount_value ?? 0) > 0;
      return !isFood && eligible && val;
    });
  }, [lines]);

  const deliveryFee = hasPromoInCart ? 0 : FEES[delivery];
  const grandTotal = totalAmount + deliveryFee;

  // ✅ Si la ville change, on garde l’UX : si la commune n’existe plus → reset propre
  useEffect(() => {
    if (!COMMUNES.includes(commune)) {
      setCommune(
        COMMUNES.includes("__other__")
          ? "__other__"
          : String(COMMUNES[0] || "__other__")
      );
      setCommuneOther("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey]);

  /* ---------- Pré-remplissage optionnel depuis /me ---------- */
  useEffect(() => {
    if (!isReady) return;

    // Pas de token → mode invité
    if (!hasToken) {
      setLoading(false);
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

          // ✅ Ville du profil : si aucune ville choisie côté app, on prend celle du profil
          // (ne remplace pas un choix déjà fait par l’utilisateur dans LocationGate)
          const profileCityRaw = String((u as any).city || (u as any).ville || "")
            .trim()
            .toLowerCase();

          if (!city) {
            if (profileCityRaw.includes("casa")) {
              setCity("CASABLANCA" as CityCode);
            } else if (profileCityRaw.includes("marr")) {
              setCity("MARRAKECH" as CityCode);
            }
          }

          // ✅ Commune du profil : si pas dans la liste de la ville → "Autre…"
          const c = String((u as any).commune || "").trim();
          if (c && COMMUNES.includes(c)) {
            setCommune(c);
            setCommuneOther("");
          } else if (c) {
            setCommune("__other__");
            setCommuneOther(c);
          }

          if ((u as any).quartier) setQuartier((u as any).quartier);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, location.pathname, isReady]);

  const validPhone = isValidPhoneIntl(phone);
  const communeVal = commune === "__other__" ? communeOther.trim() : commune;

  const hasName = hasToken
    ? firstName.trim().length > 0 || lastName.trim().length > 0
    : guestName.trim().length > 0;

  const addressOk = hasToken
    ? !!communeVal &&
      communeVal.length > 0 &&
      (useGps ? !!coords : quartier.trim().length > 0)
    : guestAddress.trim().length > 0 || !!coords;

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

  const handlePhoneChange = useCallback((e: any) => {
    const v = normalizePhoneInput(e.target.value as string);
    setPhone(v);
  }, []);

  // ✅ Recharge depuis /me, en respectant COMMUNES_BY_CITY + ville profil (si city vide)
  const refillFromProfile = useCallback(async () => {
    try {
      setErr(null);
      setLoadingRefill(true);
      const u = await me();
      if (u) {
        setFirstName((u as any).first_name || "");
        setLastName((u as any).last_name || "");
        setPhone(normalizePhoneInput((u as any).phone || ""));

        const profileCityRaw = String((u as any).city || (u as any).ville || "")
          .trim()
          .toLowerCase();

        if (!city) {
          if (profileCityRaw.includes("casa")) {
            setCity("CASABLANCA" as CityCode);
          } else if (profileCityRaw.includes("marr")) {
            setCity("MARRAKECH" as CityCode);
          }
        }

        const c = String((u as any).commune || "").trim();
        if (c && COMMUNES.includes(c)) {
          setCommune(c);
          setCommuneOther("");
        } else if (c) {
          setCommune("__other__");
          setCommuneOther(c);
        }

        setQuartier((u as any).quartier || "");
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger votre profil.");
    } finally {
      setLoadingRefill(false);
    }
  }, [COMMUNES, city, setCity]);

  const submitOrder = useCallback(async () => {
    if (!canSubmit || submitting) return;

    try {
      setErr(null);
      setSubmitting(true);

      const normalizedPhone = normalizePhoneInput(phone.trim());

      // ✅ ville = ville courante (LocationGate) OU fallback label OU vide
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
        name: !hasToken ? (fullName || undefined) : undefined,
        phone: normalizedPhone,
      };

      // ✅ Promo : livraison gratuite partout
      const finalDeliveryMode = hasPromoInCart ? ("PROMO_FREE" as any) : delivery;
      const finalDeliveryFee = hasPromoInCart ? 0 : deliveryFee;
      const finalGrandTotal = totalAmount + finalDeliveryFee;

      const payload: CreateOrderPayload = {
        contact,
        address,
        delivery: {
          mode: finalDeliveryMode,
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
        address_commune: address.commune ?? null,
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
            const category = l.category_name || l.sub_category || "";
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

      const minStart = hasPromoInCart ? 30 : delivery === "EXPRESS" ? 15 : 60;
      const minEnd = hasPromoInCart ? 120 : delivery === "EXPRESS" ? 45 : 120;

      const etaStart = new Date(createdAt.getTime() + minStart * 60_000);
      const etaEnd = new Date(createdAt.getTime() + minEnd * 60_000);
      const etaTarget = etaEnd;

      try {
        window.localStorage.setItem(
          "duumini:lastOrderInfo",
          JSON.stringify({
            id: numericId || orderId,
            displayCode,
            createdAt: createdAt.toISOString(),
            deliveryMode: finalDeliveryMode,
            etaStart: etaStart.toISOString(),
            etaEnd: etaEnd.toISOString(),
            etaTarget: etaTarget.toISOString(),
            guest: !hasToken,
            city: finalCity || null,
          })
        );
        if (!hasToken) {
          window.localStorage.setItem("duumini:guestWidgetMinimized", "0");
        }
      } catch {}

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
    firstName,
    lastName,
    guestName,
    guestAddress,
    phone,
    communeVal,
    useGps,
    coords,
    delivery,
    lines,
    totalItems,
    totalAmount,
    deliveryFee,
    clear,
    nav,
    quartier,
    hasToken,
    hasPromoInCart,
    cityLabel,
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

  return (
    <section className="container-xxl py-4 checkout">
      <FocusAndLoadingStyle />

      {/* ✅ Modale de succès invité */}
      {showGuestSuccess && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
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
                  <p className="mb-2">
                    Merci&nbsp;! Votre commande a bien été envoyée.
                  </p>
                  <p className="mb-2">
                    Un membre de l’équipe Duumini va vous{" "}
                    <strong>contacter très bientôt par téléphone</strong>.
                  </p>
                  <p className="mb-0 small text-muted">
                    Pour <strong>voir l’historique</strong> et{" "}
                    <strong>suivre vos commandes</strong>, vous pouvez vous
                    connecter ou créer un compte.
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

          {hasPromoInCart ? (
            <div className="text-muted">
              🚚 Livraison gratuite <strong>partout</strong> (offres promotionnelles)
            </div>
          ) : (
            <div className="text-muted">
              Livraison sur{" "}
              <strong>{cityLabel || "—"}</strong>{" "}
              <button
                type="button"
                className="btn btn-sm btn-outline-dark ms-2"
                onClick={() => window.dispatchEvent(new Event("city:open"))}
              >
                Changer
              </button>
            </div>
          )}
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
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
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
                      className={`form-control ${
                        phone && !isValidPhoneIntl(phone) ? "is-invalid" : ""
                      }`}
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
                    <div className="form-text">
                      La ville vient de votre sélection (LocationGate).
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Commune</label>
                    <select
                      className="form-select"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                    >
                      {COMMUNES.map((c) => (
                        <option key={c} value={c}>
                          {c === "__other__" ? "Autre…" : c}
                        </option>
                      ))}
                    </select>
                    {commune === "__other__" && (
                      <input
                        className="form-control mt-2"
                        placeholder="Saisir votre commune"
                        value={communeOther}
                        onChange={(e) => setCommuneOther(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Quartier OU GPS */}
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center justify-content-between">
                      <span>Quartier / Localisation</span>
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
                            {loadingGps ? (
                              <>
                                <span
                                  className="spinner-border spinner-border-sm me-2"
                                  role="status"
                                  aria-hidden="true"
                                />
                                Activation…
                                <span className="visually-hidden">
                                  de la géolocalisation
                                </span>
                              </>
                            ) : (
                              "Utiliser ma position"
                            )}
                          </button>
                        )}
                      </span>
                    </label>

                    {!useGps ? (
                      <>
                        <input
                          className="form-control"
                          placeholder="Ex: Quartier…, repère…"
                          value={quartier}
                          onChange={(e) => setQuartier(e.target.value)}
                        />
                        {gpsErr && (
                          <div className="form-text text-danger mt-1">{gpsErr}</div>
                        )}
                        <div className="form-text">
                          Saisissez votre quartier ou utilisez le GPS.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="alert alert-info d-flex justify-content-between align-items-center">
                          <span>
                            Localisation GPS activée{" "}
                            {coords
                              ? `(${coords.lat.toFixed(5)}, ${coords.lng.toFixed(
                                  5
                                )})`
                              : ""}
                            .
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
                      </>
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
                      className={`form-control ${
                        phone && !isValidPhoneIntl(phone) ? "is-invalid" : ""
                      }`}
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
                    <div className="form-text">
                      La ville vient de votre sélection (LocationGate).
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
                            {loadingGps ? (
                              <>
                                <span
                                  className="spinner-border spinner-border-sm me-2"
                                  role="status"
                                  aria-hidden="true"
                                />
                                Activation…
                                <span className="visually-hidden">
                                  de la géolocalisation
                                </span>
                              </>
                            ) : (
                              "Utiliser ma position"
                            )}
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
                        {gpsErr && (
                          <div className="form-text text-danger mt-1">{gpsErr}</div>
                        )}
                        <div className="form-text">Adresse complète ou GPS.</div>
                      </>
                    ) : (
                      <>
                        <div className="alert alert-info d-flex justify-content-between align-items-center">
                          <span>
                            Localisation GPS activée{" "}
                            {coords
                              ? `(${coords.lat.toFixed(5)}, ${coords.lng.toFixed(
                                  5
                                )})`
                              : ""}
                            .
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

          {/* Livraison */}
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h6 mb-3">Livraison</h2>

              {hasPromoInCart ? (
                <div className="alert alert-success mb-0">
                  <div className="fw-semibold">🚚 Livraison gratuite</div>
                  <div className="small">
                    Votre panier contient une offre promotionnelle. Livraison gratuite partout.
                  </div>
                </div>
              ) : (
                <>
                  <div className="d-flex flex-column gap-2">
                    <label
                      className={
                        "p-3 border rounded-3 d-flex align-items-center justify-content-between gap-3 " +
                        (delivery === "SIMPLE"
                          ? "border-dark bg-light"
                          : "border-secondary-subtle")
                      }
                      role="button"
                      aria-pressed={delivery === "SIMPLE"}
                      onClick={() => setDelivery("SIMPLE")}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="delivery"
                          checked={delivery === "SIMPLE"}
                          onChange={() => setDelivery("SIMPLE")}
                          style={{ transform: "scale(1.3)" }}
                          aria-label="Livraison simple"
                        />
                        <div>
                          <div className="fw-semibold">
                            Livraison simple{" "}
                            <span className="badge text-bg-dark ms-2">
                              {mad(FEES.SIMPLE)}
                            </span>
                          </div>
                          <small className="text-muted">
                            Livraison estimée en <strong>1h à 2h</strong>.
                          </small>
                        </div>
                      </div>
                    </label>

                    <label
                      className={
                        "p-3 border rounded-3 d-flex align-items-center justify-content-between gap-3 " +
                        (delivery === "EXPRESS"
                          ? "border-dark bg-light"
                          : "border-secondary-subtle")
                      }
                      role="button"
                      aria-pressed={delivery === "EXPRESS"}
                      onClick={() => setDelivery("EXPRESS")}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="delivery"
                          checked={delivery === "EXPRESS"}
                          onChange={() => setDelivery("EXPRESS")}
                          style={{ transform: "scale(1.3)" }}
                          aria-label="Livraison express"
                        />
                        <div>
                          <div className="fw-semibold">
                            Express{" "}
                            <span className="badge text-bg-dark ms-2">
                              {mad(FEES.EXPRESS)}
                            </span>
                          </div>
                          <small className="text-muted">
                            Livraison rapide en{" "}
                            <strong style={{ color: "var(--duu-red)" }}>
                              15 à 45 min
                            </strong>
                            .
                          </small>
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="form-text mt-2">
                    Frais applicables à{" "}
                    <strong>{cityLabel || "votre ville"}</strong>. Le mode choisi
                    ajustera le total automatiquement.
                  </div>
                </>
              )}
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
              title={
                !canSubmit ? "Complétez les champs requis" : "Confirmer la commande"
              }
            >
              {submitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
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
                  <span className="text-muted">
                    Livraison{" "}
                    {hasPromoInCart ? "Promo" : delivery === "EXPRESS" ? "Express" : "Simple"}
                  </span>
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
