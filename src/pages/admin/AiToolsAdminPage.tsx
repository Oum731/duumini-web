import { useMemo, useState } from "react";
import {
  buildMetaCampaign,
  publishMetaCampaign,
  buildGoogleCampaign,
  exportGoogleCsvUrl,
} from "../../services/aiAds";

function safeJson(v: any) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default function AiToolsAdminPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [metaDraftId, setMetaDraftId] = useState<string>("");
  const [metaPreview, setMetaPreview] = useState<any>(null);

  const [googleDraftId, setGoogleDraftId] = useState<string>("");
  const [googlePreview, setGooglePreview] = useState<any>(null);

  const metaPretty = useMemo(() => (metaPreview ? safeJson(metaPreview) : ""), [metaPreview]);
  const googlePretty = useMemo(() => (googlePreview ? safeJson(googlePreview) : ""), [googlePreview]);

  async function onAiBuildAll() {
    setLoading(true);
    setErr(null);
    try {
      const [m, g] = await Promise.all([
        buildMetaCampaign({}),
        buildGoogleCampaign({}),
      ]);

      setMetaDraftId(m.draft_id);
      setMetaPreview(m.preview);

      setGoogleDraftId(g.draft_id);
      setGooglePreview(g.preview);
    } catch (e: any) {
      setErr(e?.message || "Erreur IA");
    } finally {
      setLoading(false);
    }
  }

  async function onPublishMeta() {
    if (!metaDraftId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await publishMetaCampaign({ draft_id: metaDraftId, activate: true });
      alert(`Meta OK: Ad ${res.ad?.id || "—"} (${res.ad?.status || (res.activated ? "ACTIVE" : "PAUSED")})`);
      setMetaDraftId("");
    } catch (e: any) {
      setErr(e?.message || "Erreur publication Meta");
    } finally {
      setLoading(false);
    }
  }

  function onExportGoogle() {
    if (!googleDraftId) return;
    const url = exportGoogleCsvUrl(googleDraftId);
    window.open(url, "_blank"); // téléchargement CSV
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <div className="fw-bold fs-4" style={{ color: "var(--duu-black)" }}>
            Admin • IA Marketing (Campagnes)
          </div>
          <div className="text-muted small">
            1 clic pour générer, puis publier Meta / exporter Google.
          </div>
        </div>

        <button className="btn btn-duu" onClick={onAiBuildAll} disabled={loading}>
          {loading ? "Génération..." : "Générer la campagne IA"}
        </button>
      </div>

      {err ? <div className="alert alert-danger py-2">{err}</div> : null}

      <div className="row g-3">
        {/* META */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="fw-bold">Meta (Facebook/Instagram)</div>
              <div className="text-muted small">Aperçu campagne + bouton Publier.</div>

              <div className="mt-3 d-flex gap-2">
                <button className="btn btn-duu" onClick={onPublishMeta} disabled={loading || !metaDraftId}>
                  Publier sur Meta
                </button>
              </div>

              <pre className="mt-3 small mb-0" style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,.04)", padding: 12, borderRadius: 10 }}>
                {metaPretty || "Aucun aperçu. Clique sur “Générer la campagne IA”."}
              </pre>
            </div>
          </div>
        </div>

        {/* GOOGLE */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="fw-bold">Google Ads (Search)</div>
              <div className="text-muted small">Export CSV (Google Ads Editor).</div>

              <div className="mt-3 d-flex gap-2">
                <button className="btn btn-outline-dark" onClick={onExportGoogle} disabled={!googleDraftId}>
                  Exporter Google Ads (CSV)
                </button>
              </div>

              <pre className="mt-3 small mb-0" style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,.04)", padding: 12, borderRadius: 10 }}>
                {googlePretty || "Aucun aperçu. Clique sur “Générer la campagne IA”."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
