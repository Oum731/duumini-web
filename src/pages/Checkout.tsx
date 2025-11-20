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
import {
  normalizePhoneInput,
  isValidPhoneIntl,
} from "../utils/phone";

/* ——— Style local : focus rouge + état loading ——— */
const FocusAndLoadingStyle = () => (
  <style>{`
    /* Focus rouge Duumini pour TOUS les boutons de cette page */
    .checkout .btn:focus,
    .checkout .btn:focus-visible {
      outline: none !important;
      box-shadow: 0 0 0 .25rem rgba(229, 57, 53, .35) !important; /* var(--duu-red) */
      border-color: #E53935 !important;
    }
    .checkout .btn-duu:focus,
    .checkout .btn-duu:focus-visible {
      box-shadow: 0 0 0 .3rem rgba(229, 57, 53, .35) !important;
    }

    /* Curseur & opacité en mode loading */
    .btn[aria-busy="true"] {
      pointer-events: none;
      opacity: .9;
    }

    /* Petites améliorations d'accessibilité */
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

const VILLE_FIXE = "Casablanca";
const COMMUNES = [
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
] as const;

type DeliveryMode = "EXPRESS" | "SIMPLE";
const FEES: Record<DeliveryMode, number> = { EXPRESS: 50, SIMPLE: 25 };

export default function CheckoutPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { lines, totalAmount, totalItems, clear } = useCart();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 👤 Utilisateur connecté
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // 👤 Invité
  const [guestName, setGuestName] = useState("");
  const [guestAddress, setGuestAddress] = useState("");

  const [phone, setPhone] = useState("");

  const [commune, setCommune] = useState<(typeof COMMUNES)[number]>(
    COMMUNES[0]
  );
  const [communeOther, setCommuneOther] = useState("");
  const [quartier, setQuartier] = useState("");

  const [useGps, setUseGps] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  // États de chargement des actions
  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingRefill, setLoadingRefill] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Par défaut: SIMPLE
  const [delivery, setDelivery] = useState<DeliveryMode>("SIMPLE");

  const deliveryFee = FEES[delivery];
  const grandTotal = totalAmount + deliveryFee;

  // Indique si on a un token (user potentiellement connecté)
  const hasToken = !!getAccessToken?.();

  // ✅ l’utilisateur a explicitement choisi "invité"
  const [guestConfirmed, setGuestConfirmed] = useState(false);

  // ✅ modale de succès pour commande invitée
  const [showGuestSuccess, setShowGuestSuccess] = useState(false);

  /* ---------- Pré-remplissage optionnel, sans obliger le login ---------- */
  useEffect(() => {
    // Pas de token → mode invité, pas de redirection
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
          const c = (u as any).commune as
            | (typeof COMMUNES)[number]
            | string
            | undefined;
          if (c && COMMUNES.includes(c as any)) {
            setCommune(c as any);
            setCommuneOther("");
          } else if (c) {
            setCommune("__other__");
            setCommuneOther(String(c));
          }
          if ((u as any).quartier) setQuartier((u as any).quartier);
        }
      } catch {
        // Si erreur (401, etc.), on reste simplement en mode formulaire manuel
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, location.pathname]);

  const validPhone = isValidPhoneIntl(phone);
  const communeVal = commune === "__other__" ? communeOther.trim() : commune;

  // ✅ conditions de nom :
  // - connecté : prénom ou nom
  // - invité   : Nom complet
  const hasName = hasToken
    ? firstName.trim().length > 0 || lastName.trim().length > 0
    : guestName.trim().length > 0;

  // ✅ conditions d'adresse :
  // - connecté : commune + (quartier ou GPS)
  // - invité   : adresse complète OU GPS
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

  // ✅ Normalisation du téléphone (00 -> +, suppression des espaces, format international)
  const handlePhoneChange = useCallback((e: any) => {
    const v = normalizePhoneInput(e.target.value as string);
    setPhone(v);
  }, []);

  // Recharger les champs depuis /me à la demande (utile seulement si connecté)
  const refillFromProfile = useCallback(async () => {
    try {
      setErr(null);
      setLoadingRefill(true);
      const u = await me();
      if (u) {
        setFirstName((u as any).first_name || "");
        setLastName((u as any).last_name || "");
        setPhone(normalizePhoneInput((u as any).phone || ""));
        const c = (u as any).commune as
          | (typeof COMMUNES)[number]
          | string
          | undefined;
        if (c && COMMUNES.includes(c as any)) {
          setCommune(c as any);
          setCommuneOther("");
        } else if (c) {
          setCommune("__other__");
          setCommuneOther(String(c));
        }
        setQuartier((u as any).quartier || "");
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger votre profil.");
    } finally {
      setLoadingRefill(false);
    }
  }, []);

  // Soumission commande (connecté OU invité)
    // Soumission commande (connecté OU invité)
  const submitOrder = useCallback(async () => {
    if (!canSubmit || submitting) return;

    try {
      setErr(null);
      setSubmitting(true);

      const normalizedPhone = normalizePhoneInput(phone.trim());

      // ✅ Adresse typée pour respecter CreateOrderPayload
      const address: CreateOrderPayload["address"] = hasToken
        ? {
            ville: VILLE_FIXE,
            // string ou undefined, pas de null
            commune: communeVal ? String(communeVal) : undefined,
            quartier: useGps ? null : quartier.trim() || null,
            gps: useGps && coords ? { lat: coords.lat, lng: coords.lng } : null,
          }
        : {
            ville: VILLE_FIXE,
            // invité : on ne met PAS null, juste undefined
            commune: undefined,
            quartier: useGps ? null : guestAddress.trim() || null,
            gps: useGps && coords ? { lat: coords.lat, lng: coords.lng } : null,
          };

      // Contact :
      const fullName = hasToken
        ? (`${firstName.trim()} ${lastName.trim()}`.trim() ||
            firstName.trim() ||
            lastName.trim())
        : guestName.trim();

      const contact = {
        first_name: hasToken ? firstName.trim() || undefined : undefined,
        last_name: hasToken ? lastName.trim() || undefined : undefined,
        name: !hasToken ? (fullName || undefined) : undefined,
        phone: normalizedPhone,
      };

      const payload: CreateOrderPayload = {
        contact,
        address,
        delivery: {
          mode: delivery,
          fee: deliveryFee,
          currency: "MAD",
        },
        items: lines.map((l) => ({
          product_id: l.id,
          name: l.name,
          price: l.price,
          qty: l.qty,
        })),
        totals: {
          items_count: totalItems,
          items_amount: totalAmount,
          delivery_fee: deliveryFee,
          amount: grandTotal,
          currency: "MAD",
        },
        payment: {
          method: "COD",
          note: "Paiement à la livraison. Aucun acompte requis.",
        },

        // Champs à plat optionnels (on gère undefined → null ici)
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

      // ✅ Code alphanumérique pour UI (id brut gardé pour le backend)
      const numericId =
        typeof orderId === "number" ? orderId : Number(orderId) || 0;
      const displayCode = numericId
        ? numericId.toString(36).toUpperCase()
        : String(orderId ?? "").toUpperCase();

      if (!hasToken) {
        const now = new Date();
        const minStart = delivery === "EXPRESS" ? 15 : 60;
        const minEnd = delivery === "EXPRESS" ? 45 : 120;

        const etaStart = new Date(now.getTime() + minStart * 60_000);
        const etaEnd = new Date(now.getTime() + minEnd * 60_000);
        const etaTarget = etaEnd;

        try {
          window.localStorage.setItem(
            "duumini:lastOrderInfo",
            JSON.stringify({
              id: numericId || orderId,
              displayCode,
              createdAt: now.toISOString(),
              deliveryMode: delivery,
              etaStart: etaStart.toISOString(),
              etaEnd: etaEnd.toISOString(),
              etaTarget: etaTarget.toISOString(),
              guest: true,
            })
          );
          window.localStorage.setItem("duumini:guestWidgetMinimized", "0");
        } catch {
          // silencieux
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
      setErr(
        e?.message || "Impossible de confirmer la commande pour le moment."
      );
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
    grandTotal,
    clear,
    nav,
    quartier,
    hasToken,
  ]);


  const headerRight = useMemo(
    () => (
      <div className="text-end">
        <div className="small text-muted">Total à payer</div>
        <div className="h5 m-0">{mad(grandTotal)}</div>
        <div className="small text-muted">
          Dont livraison: {mad(deliveryFee)}
        </div>
      </div>
    ),
    [grandTotal, deliveryFee]
  );

  if (loading) {
    return (
      <div className="container-xxl py-4">
        <div className="text-muted">Chargement…</div>
      </div>
    );
  }

  // ⚠️ On ne montre "panier vide" que si on n'est PAS dans l'écran de succès invité
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

      {/* ✅ Modale de succès pour commande INVITÉ */}
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
                    <strong>contacter très bientôt par téléphone</strong> pour
                    confirmer la prise en charge de votre commande.
                  </p>
                  <p className="mb-0 small text-muted">
                    Pour <strong>voir l’historique de vos commandes</strong> et
                    <strong> suivre l’évolution de vos futures commandes en temps réel</strong>,
                    vous pouvez vous connecter ou créer un compte Duumini.
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
          {/* Fond sombre de la modale */}
          <div className="modal-backdrop fade show" />
        </>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>
            Confirmer la commande
          </h1>
          <div className="text-muted">Livraison sur {VILLE_FIXE}</div>
        </div>
        {headerRight}
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {/* ✅ Proposition invité / connexion / inscription */}
      {!hasToken && (
        <div className="alert alert-info mb-3">
          <div className="fw-semibold mb-1">Commander sans créer de compte</div>
          <p className="mb-2 small">
            Vous pouvez finaliser votre commande{" "}
            <strong>en tant qu’invité</strong>. Dans ce cas, vous ne pourrez pas
            consulter l’historique dans l’espace « Mes commandes », mais nous
            vous contacterons directement sur le numéro indiqué en cas de
            besoin.
          </p>
          <div className="d-flex flex-wrap gap-2">
            {/* 🔓 confirme le mode invité */}
            <button
              type="button"
              className="btn btn-sm btn-dark"
              onClick={() => setGuestConfirmed(true)}
            >
              Continuer en tant qu’invité
            </button>

            {/* Connexion avec retour vers le checkout */}
            <Link
              to="/profile?tab=login&next=/checkout"
              className="btn btn-sm btn-outline-dark"
            >
              Se connecter
            </Link>

            {/* Inscription avec retour vers le checkout */}
            <Link
              to="/profile?tab=register&next=/checkout"
              className="btn btn-sm btn-outline-secondary"
            >
              Créer un compte
            </Link>
          </div>

          {guestConfirmed && (
            <p className="mt-2 small mb-0">
              ✅ Vous avez choisi de{" "}
              <strong>continuer en tant qu’invité</strong>. Remplissez le
              formulaire ci-dessous puis cliquez sur{" "}
              <strong>« Confirmer la commande »</strong> pour valider votre
              achat.
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

              {/* ✅ Formulaire différent selon connecté / invité */}
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
                        Numéro invalide. Utilisez le format international, par exemple :
                        +2126…, +22507…, +22360…, +1415…
                      </div>
                    )}
                    <div className="form-text">
                      🟢 <strong>Idéalement, utilisez votre numéro WhatsApp</strong>{" "}
                      pour que nous puissions vous joindre et vous envoyer les
                      informations de commande plus facilement.
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <input className="form-control" value={VILLE_FIXE} disabled />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Commune</label>
                    <select
                      className="form-select"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value as any)}
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
                          placeholder="Ex: Riad Oulfa, Terminus 20…"
                          value={quartier}
                          onChange={(e) => setQuartier(e.target.value)}
                        />
                        {gpsErr && (
                          <div className="form-text text-danger mt-1">
                            {gpsErr}
                          </div>
                        )}
                        <div className="form-text">
                          Vous pouvez soit saisir votre quartier, soit utiliser
                          votre position GPS.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="alert alert-info d-flex justify-content-between align-items-center">
                          <span>
                            Localisation GPS activée{" "}
                            {coords
                              ? `(${coords.lat.toFixed(
                                  5
                                )}, ${coords.lng.toFixed(5)})`
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
                        {gpsErr && (
                          <div className="form-text text-danger">{gpsErr}</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                // 🧾 Formulaire simplifié pour INVITÉ (Nom + Tel + Adresse OU GPS) :
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
                        Numéro invalide. Utilisez le format international, par exemple :
                        +2126…, +22507…, +22360…, +1415…
                      </div>
                    )}
                    <div className="form-text">
                      🟢 <strong>Idéalement, utilisez votre numéro WhatsApp</strong>{" "}
                      pour que nous puissions vous joindre et vous envoyer les
                      informations de commande plus facilement.
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <input className="form-control" value={VILLE_FIXE} disabled />
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
                          placeholder="Ex: Quartier Riad Oulfa, près du Terminus 20, immeuble B, appartement 3…"
                          value={guestAddress}
                          onChange={(e) => setGuestAddress(e.target.value)}
                        />
                        {gpsErr && (
                          <div className="form-text text-danger mt-1">
                            {gpsErr}
                          </div>
                        )}
                        <div className="form-text">
                          Vous pouvez renseigner votre adresse complète ou
                          choisir d’utiliser votre position GPS.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="alert alert-info d-flex justify-content-between align-items-center">
                          <span>
                            Localisation GPS activée{" "}
                            {coords
                              ? `(${coords.lat.toFixed(
                                  5
                                )}, ${coords.lng.toFixed(5)})`
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
                        {gpsErr && (
                          <div className="form-text text-danger">
                            {gpsErr}
                          </div>
                        )}
                        <div className="form-text">
                          Vous pouvez ajouter quelques précisions ci-dessous si
                          nécessaire (optionnel).
                        </div>
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
              <h2 className="h6 mb-3">Mode de livraison</h2>

              <div className="d-flex flex-column gap-2">
                {/* SIMPLE (default) */}
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
                      aria-label="Livraison simple sous 24h"
                    />
                    <div>
                      <div className="fw-semibold">
                        Livraison simple
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

                {/* EXPRESS */}
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
                      aria-label="Livraison Express 1 à 2 heures"
                    />
                    <div>
                      <div className="fw-semibold">
                        Express
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
                Frais applicables à {VILLE_FIXE}. Le mode choisi ajustera le
                total automatiquement.
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
              title={
                !canSubmit
                  ? "Complétez les champs requis"
                  : "Confirmer la commande"
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

        {/* Récap panier */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h6 mb-3">Récapitulatif</h2>
              <ul className="list-group list-group-flush">
                {lines.map((l) => (
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
                    Livraison {delivery === "EXPRESS" ? "Express" : "Simple"}
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
