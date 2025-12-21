// src/components/LocationGate.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocationCity, CITY_OPTIONS, type CityCode } from "../context/LocationContext";
import { api } from "../services/http";

/**
 * ✅ API attendue
 * GET /api/locations/cities?q=
 * -> { items: ["Casablanca", ...] }
 *    ou { items: [{name:"Casablanca"} ...] }
 */
const CITY_ENDPOINT = "/api/locations/cities";

/* ===== Helpers ===== */
function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
function parseCities(payload: any): string[] {
  if (!payload) return [];
  if (Array.isArray(payload.items)) {
    return payload.items.map((x: any) => {
      if (typeof x === "string") return x;
      return x?.name ?? x?.label ?? x?.city ?? String(x ?? "");
    });
  }
  if (Array.isArray(payload.cities)) return payload.cities.map(String);
  if (Array.isArray(payload)) return payload.map(String);
  return [];
}
function eqCity(a?: string | null, b?: string | null) {
  return norm(String(a || "")) === norm(String(b || ""));
}

export default function LocationGate({ children }: { children: React.ReactNode }) {
  const { city, setCity, isReady } = useLocationCity();

  const [showModal, setShowModal] = useState(false);

  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citiesErr, setCitiesErr] = useState<string | null>(null);

  const [q, setQ] = useState(""); // recherche
  const [selected, setSelected] = useState<string>(""); // ✅ valeur sélectionnée dans la dropdown
  const [customCity, setCustomCity] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const currentLabel = useMemo(() => titleCase(city || ""), [city]);

  const defaultFallbackCities = useMemo(() => CITY_OPTIONS.map((c) => c.label), []);

  async function loadCities(search?: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoadingCities(true);
    setCitiesErr(null);

    try {
      const res = await api.get<any>(CITY_ENDPOINT, {
        query: { q: (search || "").trim() || undefined },
        signal: ac.signal,
        timeout: 12000,
      });

      if (ac.signal.aborted) return;

      const list = uniqSorted(parseCities(res));
      const finalList = list.length ? list : uniqSorted(defaultFallbackCities);
      setCities(finalList);

      // ✅ sync selected
      const current = titleCase(city || "");
      if (current && finalList.some((x) => eqCity(x, current))) setSelected(current);
      else if (!selected && finalList.length) setSelected(finalList[0]);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setCitiesErr(e?.message || "Impossible de charger la liste des villes.");
      const fallback = uniqSorted(defaultFallbackCities);
      setCities(fallback);

      const current = titleCase(city || "");
      if (current && fallback.some((x) => eqCity(x, current))) setSelected(current);
      else if (!selected && fallback.length) setSelected(fallback[0]);
    } finally {
      if (!ac.signal.aborted) setLoadingCities(false);
    }
  }

  // 👉 au premier chargement : si pas de ville, on force l'ouverture
  useEffect(() => {
    if (!isReady) return;
    if (!city) setShowModal(true);
  }, [isReady, city]);

  // 👉 event global "city:open"
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener("city:open", handler);
    return () => window.removeEventListener("city:open", handler);
  }, []);

  // ✅ lock scroll
  useEffect(() => {
    if (!showModal) return;
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [showModal]);

  // ✅ charger villes quand modal s'ouvre
  useEffect(() => {
    if (!showModal) return;
    loadCities("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  // ✅ recherche (debounce + abort)
  useEffect(() => {
    if (!showModal) return;

    const t = window.setTimeout(() => {
      const needle = q.trim();
      if (needle.length >= 2) loadCities(needle);
      else if (!needle) loadCities("");
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, showModal]);

  async function handleSelectName(cityName: string) {
    const label = titleCase(cityName);
    if (!label) return;

    // ✅ best-effort: enrich backend
    try {
      await api.post("/api/locations/cities", { city: label }, { timeout: 8000 });
    } catch {
      // ignore
    }

    setCity(label as CityCode);
    setShowModal(false);
    setQ("");
    setCustomCity("");
  }

  async function handleSelectCustom() {
    const label = titleCase(customCity);
    if (!label) return;

    try {
      await api.post("/api/locations/cities", { city: label }, { timeout: 8000 });
    } catch {
      // ignore
    }

    setCities((prev) => uniqSorted([...prev, label]));
    setSelected(label);
    setCity(label as CityCode);

    setShowModal(false);
    setQ("");
    setCustomCity("");
  }

  const dropdownOptions = useMemo(() => {
    const needle = norm(q);
    const list = !needle ? cities : cities.filter((c) => norm(c).includes(needle));
    return list.slice(0, 200); // sécurité UI
  }, [cities, q]);

  if (!isReady) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center text-muted small">Chargement de votre zone de livraison…</div>
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
          <span className="fw-semibold">{currentLabel ? `Ville : ${currentLabel}` : "Choisir ma ville"}</span>
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
                    Choisis une ville dans la liste déroulante (tu peux aussi rechercher).
                  </p>

                  {/* Recherche */}
                  <div className="input-group mb-2">
                    <input
                      className="form-control"
                      placeholder="Rechercher une ville…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => loadCities(q)}
                      disabled={loadingCities}
                      title="Rafraîchir"
                    >
                      {loadingCities ? "…" : "↻"}
                    </button>
                  </div>

                  {citiesErr && (
                    <div className="alert alert-warning py-2 mb-2">
                      <div className="small">{citiesErr}</div>
                    </div>
                  )}

                  {/* ✅ Dropdown */}
                  <label className="form-label fw-semibold mb-1">Ville</label>
                  <select
                    className="form-select mb-2"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={loadingCities || !dropdownOptions.length}
                  >
                    {dropdownOptions.map((name) => (
                      <option key={name} value={name}>
                        {titleCase(name)}
                      </option>
                    ))}
                  </select>

                  <div className="d-grid">
                    <button
                      type="button"
                      className="btn"
                      style={{
                        border: "1px solid rgba(0,0,0,.08)",
                        background: "var(--duu-yellow, #FFD54F)",
                        fontWeight: 900,
                        color: "var(--duu-black, #111)",
                        borderRadius: 999,
                      }}
                      onClick={() => handleSelectName(selected)}
                      disabled={!titleCase(selected)}
                    >
                      Confirmer la ville
                    </button>
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
                      La ville est enregistrée pour vos prochaines visites.
                    </div>
                  </div>

                  <p className="small text-muted mt-3 mb-0">
                    La ville sélectionnée est conservée sur cet appareil.
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
