// src/pages/CatalogueB2BPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { LoadingState } from "../components/ui/Spinner";
import { imgUrl } from "../utils/media";
import { moneyMAD } from "../utils/money";
import { listActiveCountries, type CountryConfig } from "../services/countries";
import {
  getB2BCatalogue,
  isB2BAccessError,
  type B2BCatalogueItem,
} from "../services/catalogB2B";

const STORAGE_KEY = "duumini:b2bCatalogCode";

// ✅ Page pensée comme un "book" de présentation pour fournisseurs et
// partenaires — pas le site e-commerce grand public (/catalogue). Pas de
// panier, pas de bouton d'achat : juste le catalogue + un moyen de
// contacter Duumini. Accès protégé par un code partagé (pas un vrai
// compte), voir services/catalogB2B.ts et le backend b2bCatalogueHandler.
export default function CatalogueB2BPage() {
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState<string>(
    () => searchParams.get("code") || sessionStorage.getItem(STORAGE_KEY) || ""
  );
  const [codeInput, setCodeInput] = useState("");
  const [items, setItems] = useState<B2BCatalogueItem[] | null>(null);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listActiveCountries()
      .then(setCountries)
      .catch(() => setCountries([]));
  }, []);

  const load = useCallback(async (activeCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getB2BCatalogue(activeCode);
      setItems(res.items || []);
      sessionStorage.setItem(STORAGE_KEY, activeCode);
    } catch (e) {
      setItems(null);
      sessionStorage.removeItem(STORAGE_KEY);
      if (isB2BAccessError(e)) {
        setError(
          e.status === 503
            ? "Catalogue B2B non configuré pour le moment. Contactez-nous directement."
            : "Code d'accès invalide."
        );
      } else {
        setError("Impossible de charger le catalogue. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (code) load(code);
  }, [code, load]);

  const flagFor = useMemo(() => {
    const byCode = new Map(countries.map((c) => [c.code, c]));
    return (countryCode?: string | null) => {
      if (!countryCode) return null;
      const c = byCode.get(String(countryCode).toUpperCase());
      return c ? `${c.flag_emoji || ""} ${c.label}`.trim() : countryCode;
    };
  }, [countries]);

  function handleSubmitCode(ev: React.FormEvent) {
    ev.preventDefault();
    const clean = codeInput.trim();
    if (!clean) return;
    setCode(clean);
  }

  const unlocked = !!items;

  return (
    <div className="container-xxl py-4">
      <Seo
        title="Catalogue partenaires"
        description="Catalogue Duumini pour fournisseurs et partenaires."
        noindex
      />

      <div className="mb-4">
        <h1 className="h3 mb-1" style={{ color: "var(--duu-green)" }}>
          Catalogue Duumini — Fournisseurs &amp; Partenaires
        </h1>
        <p className="text-muted mb-0">
          Présentation de notre catalogue à destination de nos fournisseurs et
          partenaires. Réservé sur invitation.
        </p>
      </div>

      {!unlocked ? (
        <div className="row justify-content-center">
          <div className="col-12 col-sm-8 col-md-5">
            <form
              onSubmit={handleSubmitCode}
              className="p-4 rounded-4 border"
              style={{ boxShadow: "var(--duu-shadow-sm)" }}
            >
              <label className="form-label fw-bold">Code d'accès</label>
              <input
                type="text"
                className="form-control duu-focus mb-2"
                placeholder="Votre code d'accès"
                value={codeInput}
                onChange={(ev) => setCodeInput(ev.target.value)}
                autoFocus
              />
              {error ? (
                <div className="alert alert-warning py-2 small mb-2">{error}</div>
              ) : null}
              <button
                type="submit"
                className="btn btn-dark w-100"
                disabled={loading || !codeInput.trim()}
              >
                {loading ? "Vérification..." : "Accéder au catalogue"}
              </button>
              <p className="small text-muted mt-3 mb-0">
                Vous n'avez pas de code ? Contactez-nous sur{" "}
                <a href="https://wa.me/212623677884" target="_blank" rel="noreferrer">
                  WhatsApp
                </a>{" "}
                ou par{" "}
                <a href="mailto:duuminima@gmail.com">e-mail</a>.
              </p>
            </form>
          </div>
        </div>
      ) : loading ? (
        <LoadingState label="Chargement du catalogue..." />
      ) : (
        <>
          <div className="row g-3">
            {(items || []).map((p) => (
              <div className="col-6 col-sm-4 col-lg-3" key={p.id}>
                <div
                  className="h-100 rounded-4 overflow-hidden border"
                  style={{ boxShadow: "var(--duu-shadow-sm)", background: "#fff" }}
                >
                  <div
                    style={{
                      aspectRatio: "1 / 1",
                      background: "#f4f4f4",
                      backgroundImage: p.cover ? `url(${imgUrl(p.cover)})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="p-3">
                    {p.category_name ? (
                      <div className="text-uppercase small text-muted mb-1">
                        {p.category_name}
                      </div>
                    ) : null}
                    <div className="fw-bold">{p.name}</div>
                    {p.brand ? (
                      <div className="small text-muted">Marque : {p.brand}</div>
                    ) : null}
                    {p.conditionnement ? (
                      <div className="small text-muted">
                        Conditionnement : {p.conditionnement}
                      </div>
                    ) : null}
                    {p.country_code ? (
                      <div className="small text-muted">
                        Origine : {flagFor(p.country_code)}
                      </div>
                    ) : null}
                    <div className="fw-bold mt-2" style={{ color: "var(--duu-green)" }}>
                      {p.partner_price_ht != null
                        ? moneyMAD(p.partner_price_ht)
                        : "Nous contacter"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(items || []).length === 0 ? (
            <div className="text-muted py-5 text-center">
              Aucun produit disponible pour le moment.
            </div>
          ) : null}

          <div
            className="mt-5 p-4 p-md-5 text-center rounded-4"
            style={{ boxShadow: "var(--duu-shadow-sm)", background: "#fff" }}
          >
            <div className="fw-bold fs-5 mb-2">Intéressé par notre catalogue ?</div>
            <p className="text-muted mb-3">
              Contactez notre équipe pour discuter des volumes, tarifs et
              modalités de partenariat.
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <a
                href="https://wa.me/212623677884"
                target="_blank"
                rel="noreferrer"
                className="btn btn-success"
              >
                WhatsApp
              </a>
              <a href="mailto:duuminima@gmail.com" className="btn btn-outline-dark">
                duuminima@gmail.com
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
