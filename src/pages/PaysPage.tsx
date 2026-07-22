// src/pages/PaysPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCountries, type CountryConfig } from "../services/countries";
import { LoadingState } from "../components/ui/Spinner";

export default function PaysPage() {
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listCountries();
        if (mounted) setCountries(items);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Impossible de charger la liste des pays.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="container-xxl py-5">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Pays
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      <p className="text-muted mb-5" style={{ maxWidth: 640 }}>
        DUUMINI construit un réseau d'interconnexion entre pays africains :
        le corridor Maroc ↔ Côte d'Ivoire est le premier maillon d'une
        chaîne appelée à s'étendre à d'autres pays du continent. Nous
        ouvrons ces corridors progressivement, en priorisant la proximité
        logistique et culturelle plutôt que la seule taille du marché.
      </p>

      {loading && <LoadingState />}
      {error && <div className="alert alert-warning">{error}</div>}

      {!loading && !error && (
        <div className="d-flex flex-column gap-3">
          {countries.map((c) => {
            const isActive = !!c.is_active;
            return (
              <div
                key={c.code}
                className="row align-items-center g-3 p-3 p-md-4 mx-0"
                style={{
                  borderRadius: "var(--duu-radius-lg)",
                  background: isActive ? "rgba(var(--duu-green-rgb), .08)" : "#fff",
                  boxShadow: "var(--duu-shadow-sm)",
                }}
              >
                <div className="col-auto" style={{ fontSize: "1.6rem" }}>
                  {c.flag_emoji}
                </div>
                <div className="col">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-bold">{c.label}</span>
                    <span
                      className="badge rounded-pill"
                      style={{
                        background: isActive
                          ? "var(--duu-green)"
                          : "rgba(17,17,17,.08)",
                        color: isActive ? "#fff" : "var(--duu-black)",
                        fontWeight: 700,
                      }}
                    >
                      {isActive ? "Actif" : "À venir"}
                    </span>
                  </div>
                  <div className="text-muted small">{c.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted small mt-4">
        L'ordre d'ouverture des corridors est susceptible d'évoluer selon les
        opportunités locales.
      </p>
    </section>
  );
}
