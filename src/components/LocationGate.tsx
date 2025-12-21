// src/components/LocationGate.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocationCity, type CityCode } from "../context/LocationContext";
import { http } from "../services/http";

/**
 * ✅ Objectif
 * - Charger la liste des villes disponibles depuis la base (API)
 * - Laisser l'utilisateur saisir une ville si elle n'est pas disponible
 * - Stocker le choix dans LocationContext via setCity()
 *
 * ⚠️ Important
 * - Comme ton LocationContext utilise un type CityCode (souvent "CASABLANCA"/"MARRAKECH"...),
 *   on "encode" les villes venant de la DB en CityCode sous la forme: "CITY:<slug>"
 *   (cast TypeScript -> CityCode) pour ne pas casser le contexte.
 *
 * ✅ Côté backend attendu (au choix)
 * - GET /api/locations/cities -> { items: [{ name: "Casablanca" }, ...] }
 *   ou { cities: ["Casablanca", ...] }
 *
 * Si tu as déjà une route différente, change seulement CITY_ENDPOINT + parseCities().
 */

const CITY_ENDPOINT = "/api/locations/cities";
const CITY_CUSTOM_PREFIX = "CITY:";

/* ===== Helpers ===== */
function stripDiacritics(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function norm(s: string) {
  return stripDiacritics(String(s || ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function titleCase(s: string) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function uniqSorted(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const v = titleCase(x);
    if (!v) continue;
    const k = norm(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  return out;
}

function toCityCode(name: string): CityCode {
  const slug = norm(name).replace(/\s+/g, "-");
  return (CITY_CUSTOM_PREFIX + slug) as unknown as CityCode;
}

function labelFromCityCode(code: CityCode | null | undefined) {
  if (!code) return "";
  const s = String(code);
  if (s.startsWith(CITY_CUSTOM_PREFIX)) {
    const slug = s.slice(CITY_CUSTOM_PREFIX.length);
    const label = slug.replace(/-/g, " ");
    return titleCase(label);
  }
  // fallback: si ton context a encore des codes historiques
  return titleCase(s);
}

/** Parse flexible suivant réponse API */
function parseCities(payload: any): string[] {
  if (!payload) return [];

  // { cities: ["Casablanca", ...] }
  if (Array.isArray(payload.cities)) return payload.cities.map(String);

  // { items: [{name:"..."}, ...] }
  if (Array.isArray(payload.items))
    return payload.items
      .map((x: any) => x?.name ?? x?.label ?? x?.city ?? x)
      .map(String);

  // direct array
  if (Array.isArray(payload)) return payload.map(String);

  return [];
}

export default function LocationGate({ children }: { children: React.ReactNode }) {
  const { city, setCity, isReady } = useLocationCity();

  const [showModal, setShowModal] = useState(false);

  // ✅ villes DB
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citiesErr, setCitiesErr] = useState<string | null>(null);

  // ✅ recherche + saisie libre
  const [q, setQ] = useState("");
  const [customCity, setCustomCity] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const currentLabel = useMemo(() => labelFromCityCode(city), [city]);

async function loadCities() {
  abortRef.current?.abort();
  const ac = new AbortController();
  abortRef.current = ac;

  setLoadingCities(true);
  setCitiesErr(null);

  try {
    const res = await http<any>(CITY_ENDPOINT, { signal: ac.signal } as any);
    if (ac.signal.aborted) return;

    const list = uniqSorted(parseCities(res));
    setCities(list);
  } catch (e: any) {
    if (ac.signal.aborted) return;
    setCitiesErr(e?.message || "Impossible de charger la liste des villes.");
    setCities([]);
  } finally {
    if (!ac.signal.aborted) setLoadingCities(false);
  }
}


  // 👉 Au premier chargement : si pas de ville, on force l'ouverture
  useEffect(() => {
    if (!isReady) return;
    if (!city) setShowModal(true);
  }, [isReady, city]);

  // 👉 Écoute un évènement global "city:open"
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener("city:open", handler);
    return () => window.removeEventListener("city:open", handler);
  }, []);

  // ✅ Lock scroll
  useEffect(() => {
    if (!showModal) return;
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [showModal]);

  // ✅ Charger villes quand modal s'ouvre (et au besoin une seule fois)
  useEffect(() => {
    if (!showModal) return;
    if (cities.length) return;
    loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const filteredCities = useMemo(() => {
    const needle = norm(q);
    if (!needle) return cities;
    return cities.filter((c) => norm(c).includes(needle));
  }, [cities, q]);

  function handleSelectName(cityName: string) {
    const code = toCityCode(cityName);
    setCity(code);
    setShowModal(false);
    setQ("");
    setCustomCity("");
  }

  function handleSelectCustom() {
    const v = titleCase(customCity);
    if (!v) return;

    // ✅ option: on peut l'ajouter tout de suite visuellement (sans attendre backend),
    // mais le vrai "source of truth" reste la DB.
    setCities((prev) => uniqSorted([...prev, v]));

    // ✅ setCity avec code "CITY:<slug>"
    setCity(toCityCode(v));
    setShowModal(false);
    setQ("");
    setCustomCity("");
  }

  if (!isReady) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center text-muted small">
          Chargement de votre zone de livraison…
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* 📍 Bouton flottant */}
      {!showModal && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="d-inline-flex align-items-center gap-2 shadow-sm"
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            zIndex: 2000,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.06)",
            background: "#FFD54F",
            padding: "8px 14px",
            fontSize: ".85rem",
            color: "var(--duu-black, #111)",
          }}
          aria-label="Changer ma ville de livraison"
          title={currentLabel ? `Ville actuelle : ${currentLabel}` : undefined}
        >
          <span style={{ fontSize: "1rem" }}>📍</span>
          <span className="fw-semibold">
            {currentLabel ? `Ville : ${currentLabel}` : "Choisir ma ville"}
          </span>
        </button>
      )}

      {/* 🟡 Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div
                  className="modal-header"
                  style={{
                    borderBottomColor: "rgba(0,0,0,.06)",
                    background: "rgba(255,213,79,0.15)",
                  }}
                >
                  <h5 className="modal-title d-flex align-items-center gap-2">
                    <span>📍</span>
                    <span>Choisissez votre ville</span>
                  </h5>

                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fermer"
                    onClick={() => setShowModal(false)}
                  />
                </div>

                <div className="modal-body">
                  <p className="small text-muted mb-2">
                    Sélectionnez une ville disponible, ou saisissez la vôtre si elle n’apparaît pas.
                  </p>

                  {/* Recherche */}
                  <div className="input-group mb-3">
                    <input
                      className="form-control"
                      placeholder="Rechercher une ville…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => loadCities()}
                      disabled={loadingCities}
                      title="Rafraîchir"
                    >
                      {loadingCities ? "…" : "↻"}
                    </button>
                  </div>

                  {/* Liste DB */}
                  <div className="d-flex flex-column gap-2">
                    {loadingCities ? (
                      <div className="text-muted small">Chargement des villes…</div>
                    ) : citiesErr ? (
                      <div className="alert alert-warning py-2 mb-0">
                        <div className="small">{citiesErr}</div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark mt-2"
                          onClick={() => loadCities()}
                        >
                          Réessayer
                        </button>
                      </div>
                    ) : filteredCities.length ? (
                      filteredCities.slice(0, 24).map((name) => {
                        const active = norm(name) === norm(currentLabel);
                        return (
                          <button
                            key={name}
                            type="button"
                            className="btn w-100"
                            onClick={() => handleSelectName(name)}
                            style={{
                              borderRadius: 999,
                              border: "1px solid rgba(0,0,0,.08)",
                              background: active ? "var(--duu-yellow, #FFD54F)" : "#fff",
                              color: "var(--duu-black, #111)",
                              fontWeight: 700,
                              textAlign: "left",
                            }}
                          >
                            {name}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-muted small">Aucune ville trouvée.</div>
                    )}
                  </div>

                  {/* Saisie libre */}
                  <div className="mt-3 p-3 rounded" style={{ background: "rgba(0,0,0,.03)" }}>
                    <div className="fw-semibold mb-2">Ma ville n’est pas dans la liste</div>

                    <div className="input-group">
                      <input
                        className="form-control"
                        placeholder="Saisir ma ville (ex : Mohammedia)"
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={handleSelectCustom}
                        disabled={!titleCase(customCity)}
                        style={{
                          border: "1px solid rgba(0,0,0,.08)",
                          background: "var(--duu-yellow, #FFD54F)",
                          fontWeight: 800,
                          color: "var(--duu-black, #111)",
                        }}
                      >
                        Valider
                      </button>
                    </div>

                    <div className="small text-muted mt-2">
                      Si vous saisissez une nouvelle ville, elle sera utilisée pour filtrer l’affichage.
                    </div>
                  </div>

                  <p className="small text-muted mt-3 mb-0">
                    La ville sélectionnée reste active même si vous êtes connecté(e).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
