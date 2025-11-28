// src/pages/AfricanFood.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "../components/ProductCard";
import { listProducts, type Product } from "../services/products";
import { useLocationCity } from "../context/LocationContext";

function GridSkeleton() {
  return (
    <div className="row g-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={i}>
          <div className="card h-100 border-0">
            <div
              className="placeholder w-100"
              style={{ aspectRatio: "1 / 1", borderRadius: ".5rem .5rem 0 0" }}
            />
            <div className="card-body">
              <div className="placeholder col-8 mb-2" />
              <div className="placeholder col-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Normalise la ville utilisateur pour l'API:
 *  - accepte "CASABLANCA", "casa", "Casablanca", ...
 *  - accepte "MARRAKECH", "marrakech", "mar", ...
 *  - renvoie "Casablanca" | "Marrakech" | undefined
 */
function normalizeCityForApi(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const t = String(raw).trim().toLowerCase();
  if (t.startsWith("cas")) return "Casablanca";
  if (t.startsWith("mar")) return "Marrakech";
  return undefined;
}

export default function AfricanFood() {
  const { city } = useLocationCity(); // 🔥 ville choisie par l'utilisateur ("CASABLANCA" | "MARRAKECH" | null)

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);

  // Recherche (debounce)
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // Clamp page si nécessaire
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);

  // Chargement avec annulation
  const abortRef = useRef<AbortController | null>(null);
  async function refresh() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const cityApi = normalizeCityForApi(city); // ✅ string | undefined

      const res = await listProducts({
        page,
        pageSize,
        channel: "african-food",
        onlyActive: true,
        city: cityApi, // ✅ filtrage par ville de la boutique côté API
      });

      if (ac.signal.aborted) return;
      setItems(res.items);
      setTotal(res.pageInfo.total);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh();
    // 🔥 on recharge quand la ville change
  }, [page, pageSize, city]);

  const filtered = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  const filteredCount = filtered.length;
  const showCount = qDebounced
    ? `${filteredCount} / ${total} éléments`
    : `${total} éléments`;

  return (
    <section className="container-xxl py-4">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1" style={{ color: "var(--duu-black)" }}>
            Duumini Food
          </h1>
        </div>

        <div className="input-group" style={{ maxWidth: 420 }}>
          <input
            className="form-control"
            placeholder="Rechercher un produit…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <button
            className="btn btn-duu"
            onClick={() => {
              setQ("");
              setPage(1);
            }}
            disabled={!q}
          >
            Effacer
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button className="btn btn-duu btn-sm" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted py-5">Aucun produit trouvé.</div>
      ) : (
        <div className="row g-3">
          {filtered.map((p) => (
            <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={p.id}>
              {/* ProductCard gère déjà le filtrage par ville + le panier */}
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="text-muted small">{showCount}</div>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Page précédente"
              title="Page précédente"
            >
              ◀
            </button>
            <span className="btn btn-sm btn-outline-dark disabled">
              {page} / {pages}
            </span>
            <button
              className="btn btn-sm btn-duu"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              aria-label="Page suivante"
              title="Page suivante"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
