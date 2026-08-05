// src/pages/admin/AdsMetaPage.tsx
import { useEffect, useState } from "react";
import { Search, ExternalLink, Megaphone } from "lucide-react";
import { Spinner, LoadingState } from "../../components/ui/Spinner";
import { imgUrl } from "../../utils/media";
import { listProducts, type Product } from "../../services/products";
import {
  buildMetaCampaign,
  publishMetaCampaign,
  getAdminEnvCheck,
  type AdminEnvCheck,
  type MetaBuildResponse,
  type MetaPublishResponse,
} from "../../services/aiAds";

const SITE_URL = "https://duumini.com";

const OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Ventes" },
  { value: "OUTCOME_TRAFFIC", label: "Trafic vers le site" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_LEADS", label: "Prospects" },
];

function productUrl(p: Product) {
  return `${SITE_URL}/products/${encodeURIComponent(p.slug || String(p.id))}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function productOfferText(p: Product) {
  const price = Number(p.price || 0);
  const priceTxt = price > 0 ? `${price} ${p.currency || "MAD"}` : "";
  const desc = String(p.description || "").trim().slice(0, 140);
  return [p.name, priceTxt && `à ${priceTxt}`, desc].filter(Boolean).join(" — ");
}

export default function AdsMetaPage() {
  // diagnostic
  const [envCheck, setEnvCheck] = useState<AdminEnvCheck | null>(null);
  const [envErr, setEnvErr] = useState<string | null>(null);

  // product picker
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  // form
  const [objective, setObjective] = useState("OUTCOME_SALES");
  const [offer, setOffer] = useState("");
  const [url, setUrl] = useState(SITE_URL);
  const [imageUrl, setImageUrl] = useState("");
  const [audience, setAudience] = useState("personnes au Maroc cherchant des produits africains");
  const [dailyBudget, setDailyBudget] = useState(80);
  const [days, setDays] = useState(7);
  const [cityFocus, setCityFocus] = useState("Casablanca");

  // build
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<MetaBuildResponse | null>(null);

  // publish
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [published, setPublished] = useState<MetaPublishResponse | null>(null);
  const [activate, setActivate] = useState(false);

  useEffect(() => {
    getAdminEnvCheck()
      .then(setEnvCheck)
      .catch((e: unknown) => setEnvErr(errMsg(e)));
  }, []);

  // ✅ Le diagnostic est informatif, pas un verrou : s'il n'a pas encore
  // répondu (ou a échoué à charger — ex. cold start Render), on n'empêche
  // pas d'utiliser la page. S'il a répondu et qu'il manque vraiment une
  // clé, on bloque avec un message clair. L'appel réel (build/publish)
  // renverra de toute façon une erreur explicite si le serveur est
  // réellement mal configuré.
  const canGenerate = envCheck ? !!envCheck.ai.OPENAI_API_KEY : true;
  const canPublish =
    !!draft && (envCheck ? Object.values(envCheck.meta).every(Boolean) : true);
  const isAutoMode = envCheck?.ai?.DUUMINI_AI_MODE === "AUTO";

  async function runSearch() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await listProducts({ q: q.trim(), onlyActive: true, pageSize: 8 });
      setResults(res.items || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickProduct(p: Product) {
    setSelected(p);
    setOffer(productOfferText(p));
    setUrl(productUrl(p));
    setImageUrl(p.cover ? imgUrl(p.cover) : "");
    setResults([]);
    setQ("");
  }

  function clearProduct() {
    setSelected(null);
    setOffer("");
    setUrl(SITE_URL);
    setImageUrl("");
  }

  async function onGenerate() {
    setBuilding(true);
    setBuildErr(null);
    setDraft(null);
    setPublished(null);
    try {
      const res = await buildMetaCampaign({
        objective,
        offer: offer.trim() || undefined,
        url: url.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        audience: audience.trim() || undefined,
        daily_budget_mad: Number(dailyBudget) || undefined,
        days: Number(days) || undefined,
        city_focus: cityFocus.trim() || undefined,
      });
      setDraft(res);
    } catch (e: unknown) {
      setBuildErr(errMsg(e));
    } finally {
      setBuilding(false);
    }
  }

  async function onPublish() {
    if (!draft) return;
    setPublishing(true);
    setPublishErr(null);
    try {
      const res = await publishMetaCampaign({
        draft_id: draft.draft_id,
        activate: isAutoMode ? activate : false,
      });
      setPublished(res);
    } catch (e: unknown) {
      setPublishErr(errMsg(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="container py-3" style={{ maxWidth: 860 }}>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Megaphone size={22} color="var(--duu-orange)" />
        <div className="h5 mb-0">Publicités Meta</div>
      </div>

      {envErr && (
        <div className="alert alert-warning py-2">
          <div className="fw-semibold">Diagnostic serveur indisponible</div>
          <div className="small">{envErr}</div>
        </div>
      )}

      {envCheck && (!canGenerate || !canPublish) && (
        <div className="alert alert-warning py-2">
          <div className="fw-semibold">Configuration serveur incomplète</div>
          <ul className="small mb-0 mt-1">
            {!envCheck.ai.OPENAI_API_KEY && <li>OPENAI_API_KEY manquant — génération IA impossible.</li>}
            {!envCheck.meta.META_AD_ACCOUNT_ID && <li>META_AD_ACCOUNT_ID manquant.</li>}
            {!envCheck.meta.META_AD_ACCESS_TOKEN && <li>META_AD_ACCESS_TOKEN manquant.</li>}
            {!envCheck.meta.META_PAGE_ID && <li>META_PAGE_ID manquant — la publication échouera.</li>}
          </ul>
        </div>
      )}

      {envCheck && (
        <div className="small text-muted mb-3">
          Mode IA : <span className="fw-semibold">{envCheck.ai.DUUMINI_AI_MODE}</span>
          {envCheck.ai.DUUMINI_AI_MODE !== "AUTO" && " — toute annonce publiée reste en PAUSED (aucune dépense réelle)."}
        </div>
      )}

      {/* Product picker */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 16 }}>
        <div className="card-body">
          <div className="fw-semibold mb-2">1. Produit à promouvoir (optionnel)</div>

          {selected ? (
            <div className="d-flex align-items-center gap-2 p-2 border rounded">
              {selected.cover ? (
                <img
                  src={imgUrl(selected.cover)}
                  alt={selected.name}
                  style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }}
                />
              ) : null}
              <div className="flex-grow-1">
                <div className="fw-semibold small">{selected.name}</div>
                <div className="text-muted small">{selected.price} {selected.currency || "MAD"}</div>
              </div>
              <button className="btn btn-outline-dark btn-sm" onClick={clearProduct}>
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="input-group input-group-sm mb-2">
                <span className="input-group-text"><Search size={14} /></span>
                <input
                  className="form-control"
                  placeholder="Rechercher un produit (nom)…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                />
                <button className="btn btn-outline-dark" onClick={runSearch} disabled={searching}>
                  {searching ? <Spinner size="xs" /> : "Chercher"}
                </button>
              </div>

              {results.length > 0 && (
                <div className="list-group">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      className="list-group-item list-group-item-action d-flex align-items-center gap-2"
                      onClick={() => pickProduct(p)}
                    >
                      {p.cover ? (
                        <img
                          src={imgUrl(p.cover)}
                          alt={p.name}
                          style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }}
                        />
                      ) : null}
                      <div className="flex-grow-1 text-start">
                        <div className="small fw-semibold">{p.name}</div>
                        <div className="small text-muted">{p.price} {p.currency || "MAD"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="small text-muted mt-1">
                Laisse vide pour une offre générique (l'IA écrira une accroche sur Duumini en général).
              </div>
            </>
          )}
        </div>
      </div>

      {/* Campaign form */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 16 }}>
        <div className="card-body">
          <div className="fw-semibold mb-2">2. Paramètres de la campagne</div>

          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Objectif</label>
              <select className="form-select form-select-sm" value={objective} onChange={(e) => setObjective(e.target.value)}>
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Ville prioritaire</label>
              <input className="form-control form-control-sm" value={cityFocus} onChange={(e) => setCityFocus(e.target.value)} />
            </div>

            <div className="col-12">
              <label className="form-label small text-muted">Offre / accroche (texte factuel, pas de promo inventée)</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Ex: Attiéké de Babi 500g à 25 MAD — semoule de manioc fermenté, livraison au Maroc"
              />
            </div>

            <div className="col-12">
              <label className="form-label small text-muted">Lien de destination</label>
              <input className="form-control form-control-sm" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Audience</label>
              <input className="form-control form-control-sm" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label small text-muted">Budget/jour (MAD)</label>
              <input
                type="number"
                min={10}
                className="form-control form-control-sm"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label small text-muted">Durée (jours)</label>
              <input
                type="number"
                min={1}
                className="form-control form-control-sm"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            className="btn btn-dark btn-sm mt-3"
            onClick={onGenerate}
            disabled={building || !canGenerate}
            title={!canGenerate ? "OPENAI_API_KEY manquant côté serveur" : undefined}
          >
            {building ? "Génération..." : draft ? "Régénérer avec l'IA" : "Générer avec l'IA"}
          </button>

          {buildErr && <div className="alert alert-danger py-2 mt-2 small mb-0">{buildErr}</div>}
        </div>
      </div>

      {/* Preview + publish */}
      {building && <LoadingState label="Génération de la campagne…" />}

      {draft && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 16 }}>
          <div className="card-body">
            <div className="fw-semibold mb-2">3. Aperçu</div>

            <div className="small text-muted mb-1">Campagne</div>
            <div className="mb-2">{draft.preview.campaign?.name} <span className="badge bg-light text-dark border">{draft.preview.campaign?.objective}</span></div>

            <div className="small text-muted mb-1">Ensemble de publicités</div>
            <div className="mb-2">
              {draft.preview.adset?.name} — {draft.preview.adset?.daily_budget_mad} MAD/jour
            </div>

            <div className="small text-muted mb-1">Publicité</div>
            <div className="p-3 border rounded mb-2">
              <div className="fw-semibold">{draft.preview.creative?.headline}</div>
              <div>{draft.preview.creative?.primary_text}</div>
              <div className="text-muted small">{draft.preview.creative?.description}</div>
              <div className="small mt-1">
                CTA : <span className="badge bg-light text-dark border">{draft.preview.creative?.call_to_action}</span>
              </div>
            </div>

            {imageUrl && (
              <div className="mb-3">
                <div className="small text-muted mb-1">Image jointe</div>
                <img src={imageUrl} alt="" style={{ maxWidth: 160, borderRadius: 8 }} />
              </div>
            )}

            {isAutoMode && (
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="activateNow"
                  checked={activate}
                  onChange={(e) => setActivate(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="activateNow">
                  Activer immédiatement (dépense réelle) — mode AUTO
                </label>
              </div>
            )}

            <button className="btn btn-duu-green btn-sm" onClick={onPublish} disabled={publishing || !canPublish}>
              {publishing ? "Publication..." : "Publier sur Meta"}
            </button>

            {publishErr && <div className="alert alert-danger py-2 mt-2 small mb-0">{publishErr}</div>}
          </div>
        </div>
      )}

      {published && (
        <div className="alert alert-success">
          <div className="fw-semibold mb-1">Campagne créée</div>
          <div className="small">
            Statut : <span className="badge bg-light text-dark border">{published.ad?.status}</span>
            {published.ad?.status === "PAUSED" && " — à activer manuellement dans Meta Ads Manager."}
          </div>
          <div className="small mt-1">
            Campagne #{published.campaign?.id} · AdSet #{published.adset?.id} · Ad #{published.ad?.id}
          </div>
          <a
            className="small d-inline-flex align-items-center gap-1 mt-2"
            href="https://business.facebook.com/adsmanager"
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir Meta Ads Manager <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}
