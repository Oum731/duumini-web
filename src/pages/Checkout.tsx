// src/pages/CheckoutPage.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useCart, mad } from "../store/cart";
import { me, getAccessToken } from "../services/auth";
import { Spinner, PageLoader } from "../components/ui/Spinner";
import {
  createOrder,
  createGuestOrder,
  type CreateOrderPayload,
} from "../services/orders";
import { normalizePhoneInput, isValidPhoneIntl } from "../utils/phone";
import { trackPurchase } from "../lib/analytics";
import {
  useLocationCity,
  type CityCode,
} from "../context/LocationContext";
import { api } from "../services/http";
import { metaInitiateCheckout, metaPurchase, setMetaAdvancedMatchingPhone } from "../lib/metaPixel";
import type { FulfillmentMode, PaymentMethod, LocationSuggestion } from "./checkout/types";
import {
  normalizePaymentMethod,
  paymentMethodLabel,
  isFoodLike,
  DELIVERY_RULES,
  BANK_RIB,
  GAZHALA_PAYMENT,
  isCasablanca,
  computeDeliveryFeeByCity,
  getLineVariantLabel,
  getLineVariantId,
  lineKey,
  cityCodeFromText,
  parseGpsInput,
} from "./checkout/helpers";
import {
  listCommunesByCity,
  listQuartiersByCityCommune,
  trackLocationSuggestion,
} from "./checkout/api";
import { useDebouncedValue } from "./profile/hooks/useDebouncedValue";
import { FocusAndLoadingStyle } from "./checkout/components/FocusAndLoadingStyle";

export default function CheckoutPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { lines, totalAmount, totalItems, clear } = useCart();

  const { setCity, isReady } = useLocationCity();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestAddress, setGuestAddress] = useState("");

  const [phone, setPhone] = useState("");

  const [cityInput, setCityInput] = useState("");
  const [, setCityTouched] = useState(false);
  const [, setCityManuallyEdited] = useState(false);

  const [commune, setCommune] = useState<string>("");
  const [communeOther, setCommuneOther] = useState("");
  const [quartier, setQuartier] = useState("");

  const [communeSuggestions, setCommuneSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [quartierSuggestions, setQuartierSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const [useGps, setUseGps] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [gpsInput, setGpsInput] = useState("");

  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingRefill, setLoadingRefill] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingAddress, setEditingAddress] = useState(true);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);

  const hasToken = !!getAccessToken?.();
  const [showGuestSuccess, setShowGuestSuccess] = useState(false);

  const [fulfillment, setFulfillment] = useState<FulfillmentMode>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  const metaInitDoneRef = useRef(false);

  const cityText = useMemo(() => String(cityInput || "").trim(), [cityInput]);

  const hasPromoInCart = useMemo(() => {
    return (lines || []).some((l: any) => {
      const p = l?.product ?? l;
      const isFood = isFoodLike(p);
      const eligible = Number(p?.promo_eligible ?? 0) === 1;
      const val = Number(p?.promo_discount_value ?? 0) > 0;
      return !isFood && eligible && val;
    });
  }, [lines]);

  const deliveryFee = useMemo(() => {
    if (fulfillment === "PICKUP") return 0;
    if (fulfillment === "EXPEDITION") return DELIVERY_RULES.EXPEDITION_DROP_FEE;
    return computeDeliveryFeeByCity(cityText);
  }, [cityText, fulfillment]);

  const grandTotalUi = totalAmount + deliveryFee;

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

  const debouncedCityText = useDebouncedValue(
    String(cityText || "").trim(),
    250,
  );
  const debouncedCommuneVal = useDebouncedValue(
    String(communeVal || "").trim(),
    250,
  );

  const hasName = hasToken
    ? firstName.trim().length > 0 || lastName.trim().length > 0
    : guestName.trim().length > 0;

  const addressOk = useMemo(() => {
    if (!cityText) return false;

    if (fulfillment === "PICKUP" || fulfillment === "EXPEDITION") return true;

    if (hasToken) {
      return useGps
        ? !!coords
        : communeVal.length > 0 && quartier.trim().length > 0;
    }

    return useGps ? !!coords : guestAddress.trim().length > 0;
  }, [
    cityText,
    fulfillment,
    hasToken,
    useGps,
    coords,
    communeVal,
    quartier,
    guestAddress,
  ]);

  const canSubmit = lines.length > 0 && hasName && validPhone && addressOk;

  const applyCoords = useCallback(
    (nextCoords: { lat: number; lng: number }) => {
      setGpsErr(null);
      setCoords(nextCoords);
      setGpsInput(`${nextCoords.lat}, ${nextCoords.lng}`);
      setUseGps(true);
    },
    [],
  );

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
        const nextCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        applyCoords(nextCoords);
        setLoadingGps(false);
      },
      (error) => {
        setGpsErr(
          error?.message ||
            "Impossible d’obtenir la position. Vous pouvez saisir votre adresse manuellement.",
        );
        setLoadingGps(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [applyCoords]);

  const applyPastedGps = useCallback(() => {
    const parsed = parseGpsInput(gpsInput);
    if (!parsed) {
      setGpsErr("Coordonnées invalides. Format attendu : 5.3600, -4.0083");
      return;
    }

    if (Math.abs(parsed.lat) > 90 || Math.abs(parsed.lng) > 180) {
      setGpsErr("Coordonnées invalides.");
      return;
    }

    applyCoords(parsed);
  }, [gpsInput, applyCoords]);

  useEffect(() => {
    let alive = true;

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
        if (!alive) return;

        if (u) {
          setFirstName((u as any).first_name || "");
          setLastName((u as any).last_name || "");
          setPhone(normalizePhoneInput((u as any).phone || ""));

          setCityInput("");
          setCityTouched(false);
          setCityManuallyEdited(false);
          setCommune("");
          setCommuneOther("");
          setQuartier("");

          setUseGps(false);
          setCoords(null);
          setGpsErr(null);
          setGpsInput("");

          setEditingAddress(true);
          setSaveAddressToProfile(false);
        }
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
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

        setCityInput("");
        setCityTouched(false);
        setCityManuallyEdited(false);
        setCommune("");
        setCommuneOther("");
        setQuartier("");

        setUseGps(false);
        setCoords(null);
        setGpsErr(null);
        setGpsInput("");

        setEditingAddress(true);
        setSaveAddressToProfile(false);
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger votre profil.");
    } finally {
      setLoadingRefill(false);
    }
  }, []);

  const communeCacheRef = useRef<Map<string, LocationSuggestion[]>>(new Map());
  const quartierCacheRef = useRef<Map<string, LocationSuggestion[]>>(new Map());

  const communesAbortRef = useRef<AbortController | null>(null);
  const quartiersAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isReady) return;

    const v = debouncedCityText;
    if (!v) return;
    if (fulfillment !== "DELIVERY") return;

    setQuartier("");
    setQuartierSuggestions([]);

    const cached = communeCacheRef.current.get(v);
    if (cached) {
      setCommuneSuggestions(cached);
      trackLocationSuggestion("VILLE", { ville: v });
      return;
    }

    try {
      communesAbortRef.current?.abort();
    } catch {}

    const ac = new AbortController();
    communesAbortRef.current = ac;

    setLoadingSuggest(true);

    (async () => {
      try {
        const communes = await listCommunesByCity(v, ac.signal);
        communeCacheRef.current.set(v, communes || []);
        setCommuneSuggestions(communes || []);
      } catch {
        if (!ac.signal.aborted) setCommuneSuggestions([]);
      } finally {
        if (!ac.signal.aborted) setLoadingSuggest(false);
      }
    })();

    trackLocationSuggestion("VILLE", { ville: v });

    return () => {
      try {
        ac.abort();
      } catch {}
    };
  }, [debouncedCityText, isReady, fulfillment]);

  useEffect(() => {
    if (fulfillment !== "DELIVERY") return;

    const v = debouncedCityText;
    const c = debouncedCommuneVal;

    if (!v || !c) {
      setQuartierSuggestions([]);
      return;
    }

    const cacheKey = `${v}__${c}`;
    const cached = quartierCacheRef.current.get(cacheKey);

    if (cached) {
      setQuartierSuggestions(cached);
      trackLocationSuggestion("COMMUNE", { ville: v, commune: c });
      return;
    }

    try {
      quartiersAbortRef.current?.abort();
    } catch {}

    const ac = new AbortController();
    quartiersAbortRef.current = ac;

    setLoadingSuggest(true);

    (async () => {
      try {
        const qs = await listQuartiersByCityCommune(v, c, ac.signal);
        quartierCacheRef.current.set(cacheKey, qs || []);
        setQuartierSuggestions(qs || []);
      } catch {
        if (!ac.signal.aborted) setQuartierSuggestions([]);
      } finally {
        if (!ac.signal.aborted) setLoadingSuggest(false);
      }
    })();

    trackLocationSuggestion("COMMUNE", { ville: v, commune: c });

    return () => {
      try {
        ac.abort();
      } catch {}
    };
  }, [debouncedCityText, debouncedCommuneVal, fulfillment]);

  useEffect(() => {
    const onCitySelected = (ev: Event) => {
      const custom = ev as CustomEvent<{
        code?: string;
        label?: string;
        value?: string;
      }>;
      const code = String(custom.detail?.code || "").trim();
      const label = String(
        custom.detail?.label || custom.detail?.value || "",
      ).trim();

      if (code) setCity(code as CityCode);

      if (label) {
        setCityTouched(true);
        setCityManuallyEdited(false);
        setCityInput(label);
      }
    };

    window.addEventListener("city:selected", onCitySelected as EventListener);

    return () => {
      window.removeEventListener(
        "city:selected",
        onCitySelected as EventListener,
      );
    };
  }, [setCity]);

  useEffect(() => {
    if (metaInitDoneRef.current) return;
    if (!isReady || loading) return;
    if (!lines?.length) return;

    try {
      metaInitiateCheckout({
        product_ids: lines.map((l: any) => Number(l.id)),
        value: Number(grandTotalUi || 0),
      });
      metaInitDoneRef.current = true;
    } catch {}
  }, [isReady, loading, lines, grandTotalUi]);

  const submitOrder = useCallback(async () => {
    if (!canSubmit || submitting) return;

    try {
      setErr(null);
      setSubmitting(true);

      const normalizedPhone = normalizePhoneInput(phone.trim());
      setMetaAdvancedMatchingPhone(normalizedPhone);
      const finalCity = String(cityText || "").trim();
      const paymentLabel = paymentMethodLabel(paymentMethod);
      const backendPaymentMethod = normalizePaymentMethod(paymentMethod);

      const address: CreateOrderPayload["address"] =
        fulfillment === "DELIVERY"
          ? hasToken
            ? {
                ville: finalCity || undefined,
                commune: communeVal ? String(communeVal) : undefined,
                quartier: useGps ? null : quartier.trim() || null,
                gps:
                  useGps && coords
                    ? { lat: coords.lat, lng: coords.lng }
                    : null,
              }
            : {
                ville: finalCity || undefined,
                commune: undefined,
                quartier: useGps ? null : guestAddress.trim() || null,
                gps:
                  useGps && coords
                    ? { lat: coords.lat, lng: coords.lng }
                    : null,
              }
          : {
              ville: finalCity || undefined,
              commune: undefined,
              quartier: null,
              gps: null,
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

      const deliveryMode =
        fulfillment === "PICKUP"
          ? ("PICKUP" as any)
          : fulfillment === "EXPEDITION"
            ? ("EXPEDITION" as any)
            : isCasablanca(finalCity)
              ? ("CASABLANCA" as any)
              : ("CITY" as any);

      const deliveryNote =
        fulfillment === "PICKUP"
          ? "Retrait sur place gratuit."
          : fulfillment === "EXPEDITION"
            ? "Les frais d’expédition ne sont pas inclus dans la commande. Le client les paiera directement auprès de la compagnie d’expédition lors de la récupération du colis."
            : isCasablanca(finalCity)
              ? "Livraison à domicile Casablanca. Les frais de livraison sont inclus."
              : "Les frais d’expédition ne sont pas inclus dans la commande. Le client les paiera directement auprès de la compagnie d’expédition lors de la récupération du colis.";

      const paymentNote =
        paymentMethod === "BMCE"
          ? `Paiement BMCE en attente de confirmation. Merci d’envoyer votre reçu.\nRIB: ${BANK_RIB.rib}\nIBAN: ${BANK_RIB.iban}\nBIC: ${BANK_RIB.bic}\nCompte: ${BANK_RIB.account_name}${
              paymentReference.trim()
                ? `\nRéférence: ${paymentReference.trim()}`
                : ""
            }`
          : paymentMethod === "GAZHALA"
            ? `Paiement GAZHALA en attente de confirmation. Merci d’envoyer votre reçu.\nCanal: ${GAZHALA_PAYMENT.note}\nCompte: ${GAZHALA_PAYMENT.account_name}${
                paymentReference.trim()
                  ? `\nRéférence: ${paymentReference.trim()}`
                  : ""
              }`
            : "Paiement cash à la livraison.";

      const payload: CreateOrderPayload = {
        contact,
        address,

        delivery: {
          mode: deliveryMode,
          fee: Number(deliveryFee || 0),
          currency: "MAD",
          note: deliveryNote as any,
        } as any,

        items: lines.map((l: any) => {
          const variant_id = getLineVariantId(l);

          return {
            product_id: Number(l.id),
            qty: Number(l.qty || 0),
            variant_id,
          } as any;
        }),

        totals: {
          items_count: totalItems,
          items_amount: Number(totalAmount || 0),
          delivery_fee: Number(deliveryFee || 0),
          amount: Number(totalAmount || 0) + Number(deliveryFee || 0),
          currency: "MAD",
        },

        payment: {
          method: backendPaymentMethod,
          method_label: paymentLabel,
          reference: paymentReference.trim() || null,
          status: paymentMethod === "CASH" ? undefined : ("PENDING" as any),
          note: paymentNote,
        } as any,

        address_city: address.ville,
        address_commune: (address as any).commune ?? null,
        address_district: (address as any).quartier ?? null,
        address_gps_lat: (address as any).gps?.lat ?? null,
        address_gps_lng: (address as any).gps?.lng ?? null,
      };

      const result = hasToken
        ? await createOrder(payload)
        : await createGuestOrder(payload);

      const orderId = (result as any).id;
      const serverTotal = Number(
        (result as any).total ?? (result as any).amount ?? 0,
      );
      const serverCurrency = String(
        (result as any).currency || "MAD",
      ).toUpperCase();

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
          value: serverTotal || Number(totalAmount + deliveryFee),
          currency: serverCurrency,
          items: lines.map((l: any) => {
            const category =
              l.category_name ||
              l.sub_category_name ||
              l.sub_category_slug ||
              (l.sub_category_id != null &&
              String(l.sub_category_id).trim() !== ""
                ? String(l.sub_category_id)
                : "") ||
              "";

            const vLabel = getLineVariantLabel(l);
            const name = vLabel ? `${l.name} — ${vLabel}` : l.name;

            return {
              id: Number(l.id),
              name: String(name || ""),
              price: Number(l.price || 0),
              quantity: Number(l.qty || 0),
              category,
            };
          }),
        });
      } catch {}

      try {
        metaPurchase({
          product_ids: lines.map((l: any) => Number(l.id)),
          value: serverTotal || Number(totalAmount + deliveryFee),
        });
      } catch {}

      const isCasa = isCasablanca(finalCity);
      const minStart = isCasa ? 25 : 60;
      const minEnd = isCasa ? 90 : 180;

      const etaStart =
        fulfillment === "DELIVERY"
          ? new Date(createdAt.getTime() + minStart * 60_000)
          : null;
      const etaEnd =
        fulfillment === "DELIVERY"
          ? new Date(createdAt.getTime() + minEnd * 60_000)
          : null;

      try {
        window.localStorage.setItem(
          "duumini:lastOrderInfo",
          JSON.stringify({
            id: numericId || orderId,
            displayCode,
            createdAt: createdAt.toISOString(),
            fulfillment,
            deliveryMode,
            etaStart: etaStart ? etaStart.toISOString() : null,
            etaEnd: etaEnd ? etaEnd.toISOString() : null,
            guest: !hasToken,
            city: finalCity || null,
            items_amount: Number(totalAmount || 0),
            delivery_fee: Number(deliveryFee || 0),
            total: Number(totalAmount || 0) + Number(deliveryFee || 0),
            currency: serverCurrency,
            paymentMethod: paymentLabel,
            paymentBackendMethod: backendPaymentMethod,
            paymentStatus: paymentMethod === "CASH" ? "COD" : "PENDING",
            paymentReference: paymentReference.trim() || null,
          }),
        );

        if (!hasToken)
          window.localStorage.setItem("duumini:guestWidgetMinimized", "0");
      } catch {}

      if (fulfillment === "DELIVERY" && !useGps) {
        trackLocationSuggestion("QUARTIER", {
          ville: finalCity,
          commune: communeVal || undefined,
          quartier: hasToken ? quartier.trim() : guestAddress.trim(),
        });
      }

      if (hasToken && saveAddressToProfile && fulfillment === "DELIVERY") {
        try {
          await api.put("/api/user/me", {
            ville: finalCity,
            commune: communeVal || null,
            quartier: useGps ? null : quartier.trim() || null,
          });
        } catch {}
      }

      clear();

      if (hasToken) nav(`/orders?order=${orderId}`);
      else {
        setShowGuestSuccess(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Impossible de confirmer la commande pour le moment.";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    submitting,
    phone,
    cityText,
    fulfillment,
    paymentMethod,
    paymentReference,
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
        <div className="h5 m-0">{mad(grandTotalUi)}</div>
        <div className="small text-muted">
          Articles: {mad(totalAmount)}{" "}
          {fulfillment !== "PICKUP" && <>• Frais inclus: {mad(deliveryFee)}</>}
        </div>
      </div>
    ),
    [grandTotalUi, totalAmount, deliveryFee, fulfillment],
  );

  if (!isReady || loading) {
    return (
      <div className="container-xxl py-4">
        <PageLoader />
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

  const deliveryTitle =
    fulfillment === "PICKUP"
      ? "Retrait sur place gratuit"
      : fulfillment === "EXPEDITION"
        ? "Expédition — frais à payer auprès de la compagnie d’expédition"
        : isCasablanca(cityText)
          ? "Livraison Casablanca 25 DH"
          : "Hors Casablanca — frais d’expédition à payer à la récupération";

  return (
    <section className="container-xxl py-4 checkout">
      <FocusAndLoadingStyle />

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
                    Pour <strong>suivre vos commandes</strong>, vous pouvez{" "}
                    <strong>créer un compte</strong> optionnellement.
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
                    to="/profile?tab=register&next=/orders"
                    className="btn btn-duu"
                    onClick={() => setShowGuestSuccess(false)}
                  >
                    Créer un compte pour suivre
                  </Link>

                  <Link
                    to="/profile?tab=login&next=/orders"
                    className="btn btn-outline-dark"
                    onClick={() => setShowGuestSuccess(false)}
                  >
                    J’ai déjà un compte
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
            <span className="addr-pill">
              <span>📍 {cityText || "Ville à saisir"}</span>
              <small>• {mad(deliveryFee)}</small>
            </span>

            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={() => window.dispatchEvent(new Event("city:open"))}
              title="Changer la ville"
            >
              Choisir dans la liste
            </button>

            {hasPromoInCart && (
              <span className="badge text-bg-warning">Promo active</span>
            )}
          </div>
        </div>

        {headerRight}
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      <div className="row g-4">
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
                    {loadingRefill
                      ? "Rechargement…"
                      : "Recharger nom et téléphone"}
                  </button>
                )}
              </div>

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
                        Numéro invalide. Utilisez le format international :
                        +2126…, +225…, +223…, +1…
                      </div>
                    )}
                    <div className="form-text">
                      🟢{" "}
                      <strong>
                        Idéalement, utilisez votre numéro WhatsApp.
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <div className="d-flex gap-2">
                      <input
                        className="form-control"
                        value={cityInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCityTouched(true);
                          setCityManuallyEdited(true);
                          setCityInput(v);

                          const code = cityCodeFromText(v);
                          if (code) setCity(code);
                        }}
                        placeholder="Saisissez votre ville"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() =>
                          window.dispatchEvent(new Event("city:open"))
                        }
                        title="Choisir dans la liste"
                      >
                        Liste
                      </button>
                    </div>
                    <div className="form-text">
                      La ville n’est pas remplie automatiquement. Saisissez-la
                      vous-même.
                    </div>
                  </div>

                  {fulfillment === "DELIVERY" && (
                    <div className="col-12">
                      {editingAddress ? (
                        <div className="row g-3">
                          <div className="col-12">
                            <div className="gps-box">
                              <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                                <div>
                                  <div className="fw-semibold">
                                    Localisation GPS
                                  </div>
                                  <div className="small text-muted">
                                    Le GPS ajoute seulement vos coordonnées. Il
                                    ne remplit pas la ville.
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-dark"
                                  onClick={askGps}
                                  disabled={loadingGps}
                                  aria-busy={loadingGps}
                                >
                                  {loadingGps
                                    ? "Détection…"
                                    : "Utiliser ma position"}
                                </button>
                              </div>

                              <div className="row g-2 mt-1">
                                <div className="col-12 col-md-8">
                                  <input
                                    className="form-control"
                                    value={gpsInput}
                                    onChange={(e) =>
                                      setGpsInput(e.target.value)
                                    }
                                    placeholder="Ex: 5.3600, -4.0083 ou lien Google Maps"
                                  />
                                </div>
                                <div className="col-12 col-md-4 d-grid">
                                  <button
                                    type="button"
                                    className="btn btn-outline-dark"
                                    onClick={applyPastedGps}
                                    disabled={!gpsInput.trim()}
                                  >
                                    Coller GPS
                                  </button>
                                </div>
                              </div>

                              {coords && (
                                <div className="small text-success mt-2">
                                  Coordonnées actives : {coords.lat},{" "}
                                  {coords.lng}
                                </div>
                              )}
                              {gpsErr && (
                                <div className="form-text text-danger mt-1">
                                  {gpsErr}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label">Commune</label>
                            <select
                              className="form-select"
                              value={commune || "__other__"}
                              onChange={(e) => {
                                const v = e.target.value;
                                setQuartier("");
                                setQuartierSuggestions([]);

                                if (v === "__other__") {
                                  setCommune("");
                                } else {
                                  setCommune(v);
                                  setCommuneOther("");
                                }
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
                                onChange={(e) =>
                                  setCommuneOther(e.target.value)
                                }
                              />
                            )}

                            <div className="form-text d-flex align-items-center gap-1">
                              {loadingSuggest ? (
                                <>
                                  <Spinner size="xs" />
                                  Chargement suggestions…
                                </>
                              ) : (
                                "Choisissez une commune ou saisissez-la."
                              )}
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label">
                              Quartier / repère
                            </label>
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
                              </>
                            ) : (
                              <div className="alert alert-info d-flex justify-content-between align-items-center mb-0">
                                <span>Localisation GPS activée.</span>
                                <button
                                  className="btn btn-sm btn-outline-dark"
                                  type="button"
                                  onClick={() => setUseGps(false)}
                                >
                                  Revenir à la saisie
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="col-12 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                            <label className="form-check m-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={saveAddressToProfile}
                                onChange={(e) =>
                                  setSaveAddressToProfile(e.target.checked)
                                }
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
                      ) : (
                        <div className="alert alert-light border d-flex flex-wrap justify-content-between align-items-center gap-2">
                          <div className="small">
                            <div className="fw-semibold">
                              Adresse de livraison
                            </div>
                            <div className="text-muted">
                              {cityText || "—"}
                              {communeVal ? `, ${communeVal}` : ""}
                              {quartier ? ` — ${quartier}` : ""}
                              {useGps && coords ? " (GPS activé)" : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark"
                            onClick={() => setEditingAddress(true)}
                          >
                            Changer d’adresse
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                        Numéro invalide. Utilisez le format international :
                        +2126…, +225…, +223…, +1…
                      </div>
                    )}
                    <div className="form-text">
                      🟢{" "}
                      <strong>
                        Idéalement, utilisez votre numéro WhatsApp.
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <div className="d-flex gap-2">
                      <input
                        className="form-control"
                        value={cityInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCityTouched(true);
                          setCityManuallyEdited(true);
                          setCityInput(v);

                          const code = cityCodeFromText(v);
                          if (code) setCity(code);
                        }}
                        placeholder="Saisissez votre ville"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() =>
                          window.dispatchEvent(new Event("city:open"))
                        }
                        title="Choisir dans la liste"
                      >
                        Liste
                      </button>
                    </div>
                    <div className="form-text">
                      La ville n’est pas remplie automatiquement. Saisissez-la
                      vous-même.
                    </div>
                  </div>

                  {fulfillment === "DELIVERY" && (
                    <div className="col-12">
                      <label className="form-label">
                        Adresse complète / Localisation
                      </label>

                      <div className="gps-box mb-3">
                        <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                          <div>
                            <div className="fw-semibold">
                              GPS automatique ou manuel
                            </div>
                            <div className="small text-muted">
                              Le GPS ajoute seulement les coordonnées. La ville
                              doit être saisie.
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark"
                            onClick={askGps}
                            disabled={loadingGps}
                            aria-busy={loadingGps}
                          >
                            {loadingGps ? "Détection…" : "Utiliser ma position"}
                          </button>
                        </div>

                        <div className="row g-2 mt-1">
                          <div className="col-12 col-md-8">
                            <input
                              className="form-control"
                              value={gpsInput}
                              onChange={(e) => setGpsInput(e.target.value)}
                              placeholder="Ex: 5.3600, -4.0083 ou lien Google Maps"
                            />
                          </div>
                          <div className="col-12 col-md-4 d-grid">
                            <button
                              type="button"
                              className="btn btn-outline-dark"
                              onClick={applyPastedGps}
                              disabled={!gpsInput.trim()}
                            >
                              Coller GPS
                            </button>
                          </div>
                        </div>

                        {coords && (
                          <div className="small text-success mt-2">
                            Coordonnées actives : {coords.lat}, {coords.lng}
                          </div>
                        )}
                        {gpsErr && (
                          <div className="form-text text-danger mt-1">
                            {gpsErr}
                          </div>
                        )}
                      </div>

                      {!useGps ? (
                        <>
                          <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Ex: commune, quartier, immeuble, appartement, repère..."
                            value={guestAddress}
                            onChange={(e) => setGuestAddress(e.target.value)}
                          />
                          <div className="form-text">
                            Adresse complète obligatoire.
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="alert alert-info d-flex justify-content-between align-items-center">
                            <span>Localisation GPS activée.</span>
                            <button
                              className="btn btn-sm btn-outline-dark"
                              type="button"
                              onClick={() => setUseGps(false)}
                            >
                              Revenir à la saisie
                            </button>
                          </div>
                          <div className="form-text">
                            Précisions optionnelles :
                          </div>
                          <textarea
                            className="form-control mt-2"
                            rows={2}
                            placeholder="Repère, étage, porte…"
                            value={guestAddress}
                            onChange={(e) => setGuestAddress(e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h6 mb-2">Réception</h2>

              <div className="seg mb-3">
                <button
                  type="button"
                  className={`btn ${fulfillment === "DELIVERY" ? "btn-dark" : "btn-outline-dark"}`}
                  onClick={() => setFulfillment("DELIVERY")}
                >
                  🚚 Livraison
                </button>
                <button
                  type="button"
                  className={`btn ${fulfillment === "PICKUP" ? "btn-dark" : "btn-outline-dark"}`}
                  onClick={() => setFulfillment("PICKUP")}
                >
                  🏬 Récupération sur place
                </button>
                <button
                  type="button"
                  className={`btn ${fulfillment === "EXPEDITION" ? "btn-dark" : "btn-outline-dark"}`}
                  onClick={() => setFulfillment("EXPEDITION")}
                >
                  📦 Expédition
                </button>
              </div>

              <div className="alert alert-light border mb-0">
                <div className="fw-semibold">{deliveryTitle}</div>

                {fulfillment === "DELIVERY" && (
                  <>
                    {isCasablanca(cityText) ? (
                      <>
                        <div className="small text-muted">
                          Livraison à domicile Casablanca avec frais inclus dans
                          la commande.
                        </div>
                        <div className="small mt-2">
                          Ville : <strong>{cityText || "—"}</strong> • Frais :{" "}
                          <strong>{mad(deliveryFee)}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="small text-muted mt-1">
                        ⚠️ Les frais d’expédition ne sont pas inclus dans ce
                        paiement.
                        <br />
                        Le client paiera les frais directement auprès de la
                        compagnie d’expédition pendant la récupération de son
                        colis.
                      </div>
                    )}
                  </>
                )}

                {fulfillment === "PICKUP" && (
                  <div className="small text-muted mt-1">
                    Vous venez récupérer la commande sur place.{" "}
                    <strong>Aucun frais</strong>.
                  </div>
                )}

                {fulfillment === "EXPEDITION" && (
                  <div className="small text-muted mt-1">
                    Les frais d’expédition ne sont pas inclus dans votre
                    commande.
                    <br />
                    Ils seront payés directement auprès de la compagnie
                    d’expédition pendant la récupération du colis.
                  </div>
                )}
              </div>

              {fulfillment !== "DELIVERY" && (
                <div className="mini-note mt-2">
                  Si vous choisissez Livraison plus tard, vous pourrez
                  renseigner l’adresse.
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h6 mb-2">Paiement</h2>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Mode de paiement</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as PaymentMethod)
                    }
                  >
                    <option value="BMCE">BMCE</option>
                    <option value="GAZHALA">GAZHALA</option>
                    <option value="CASH">CASH</option>
                  </select>
                </div>

                {paymentMethod !== "CASH" && (
                  <div className="col-12 col-md-6">
                    <label className="form-label">Référence de paiement</label>
                    <input
                      className="form-control"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Ex: transaction / dépôt / bordereau"
                    />
                  </div>
                )}

                <div className="col-12">
                  {paymentMethod === "CASH" ? (
                    <div className="alert alert-secondary mb-0">
                      <div className="fw-semibold mb-1">Paiement cash</div>
                      <small className="d-block text-muted">
                        Vous payez <strong>à la réception</strong> en espèces.
                      </small>
                    </div>
                  ) : paymentMethod === "BMCE" ? (
                    <div className="alert alert-warning mb-0">
                      <div className="fw-semibold mb-2">
                        Paiement BMCE en attente
                      </div>
                      <div className="rib-box">
                        <div className="small">
                          <strong>Compte:</strong> {BANK_RIB.account_name}
                        </div>
                        <div className="small">
                          <strong>RIB:</strong> {BANK_RIB.rib}
                        </div>
                        <div className="small">
                          <strong>IBAN:</strong> {BANK_RIB.iban}
                        </div>
                        <div className="small">
                          <strong>BIC:</strong> {BANK_RIB.bic}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert alert-warning mb-0">
                      <div className="fw-semibold mb-2">
                        Paiement GAZHALA en attente
                      </div>
                      <div className="rib-box">
                        <div className="small">
                          <strong>Canal:</strong> {GAZHALA_PAYMENT.note}
                        </div>
                        <div className="small">
                          <strong>Compte:</strong>{" "}
                          {GAZHALA_PAYMENT.account_name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

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
              {submitting ? "Confirmation…" : "Confirmer la commande"}
            </button>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h6 mb-3">Récapitulatif</h2>

              {hasPromoInCart && (
                <div className="badge text-bg-warning mb-3">Promo active</div>
              )}

              <ul className="list-group list-group-flush">
                {lines.map((l: any) => {
                  const vLabel = getLineVariantLabel(l);

                  return (
                    <li
                      key={lineKey(l)}
                      className="list-group-item d-flex justify-content-between align-items-start"
                    >
                      <div
                        className="me-3 text-truncate"
                        style={{ maxWidth: 280 }}
                      >
                        <div className="text-truncate">
                          {l.name} <span className="text-muted">×{l.qty}</span>
                        </div>
                        {vLabel && (
                          <div className="small text-muted text-truncate">
                            Variante : {vLabel}
                          </div>
                        )}
                      </div>
                      <span className="fw-semibold">
                        {mad((l.qty || 0) * (l.price || 0))}
                      </span>
                    </li>
                  );
                })}

                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span className="text-muted">
                    {fulfillment === "PICKUP"
                      ? "Frais"
                      : fulfillment === "EXPEDITION"
                        ? "Expédition"
                        : "Livraison"}
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
                <div className="h5 m-0">{mad(grandTotalUi)}</div>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="text-muted">Paiement</div>
                <div className="fw-semibold">
                  {paymentMethodLabel(paymentMethod)}
                </div>
              </div>
            </div>
          </div>

          {(fulfillment === "EXPEDITION" ||
            (fulfillment === "DELIVERY" && !isCasablanca(cityText))) && (
            <div className="alert alert-warning mt-3 mb-0">
              <div className="fw-semibold">📦 Frais d’expédition</div>
              <div className="small text-muted">
                Les frais d’expédition ne sont pas inclus dans le total payé sur
                Duumini.
                <br />
                Le client les paiera directement auprès de la compagnie
                d’expédition pendant la récupération de son colis.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
