// src/pages/admin/AiCopyPage.tsx
import { useMemo, useState } from "react";
import { API_BASE } from "../../services/http";
import { getAccessToken } from "../../services/auth";

const TASKS = [
  "ads_meta",
  "ads_google",
  "campaign_meta",
  "campaign_google",
  "social_posts",
  "weekly_plan",
] as const;

type TaskType = (typeof TASKS)[number];

async function apiFetch(path: string, init: RequestInit = {}, timeoutMs = 120000) {
  const token = getAccessToken?.() || "";

  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal: ctrl.signal,
    });
  } finally {
    window.clearTimeout(t);
  }
}


export default function AiCopyPage() {
  const [taskType, setTaskType] = useState<TaskType>("ads_meta");
  const [ville, setVille] = useState<string>("Casablanca");
  const [channel, setChannel] = useState<string>("all");
  const [autoContext, setAutoContext] = useState(true);
  const [includeContext, setIncludeContext] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const pretty = useMemo(() => {
    try {
      return result ? JSON.stringify(result, null, 2) : "";
    } catch {
      return String(result || "");
    }
  }, [result]);

  async function run() {
    setErr("");
    setLoading(true);
    setResult(null);

    try {
      const r = await apiFetch("/api/ai/duumini", {
        method: "POST",
        body: JSON.stringify({
          taskType,
          payload: {
            auto_context: autoContext,
            include_context: includeContext,
            ville,
            channel,
          },
        }),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }

      const data = await r.json();
      setResult(data);
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!pretty) return;
    await navigator.clipboard.writeText(pretty);
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-bold fs-4" style={{ color: "var(--duu-black)" }}>
            Admin • Agent IA (Copy)
          </div>
          <div className="text-muted small">
            Génère du texte marketing (Meta/Google/posts/planning) au format JSON.
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-dark" onClick={run} disabled={loading}>
            {loading ? "Génération..." : "Générer"}
          </button>
          <button className="btn btn-outline-dark" onClick={copy} disabled={!pretty}>
            Copier JSON
          </button>
        </div>
      </div>

      <div className="card mt-3 border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label">Task</label>
              <select
                className="form-select"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
              >
                {TASKS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Ville</label>
              <select className="form-select" value={ville} onChange={(e) => setVille(e.target.value)}>
                <option value="Casablanca">Casablanca</option>
                <option value="Marrakech">Marrakech</option>
              </select>
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Channel</label>
              <select className="form-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="all">all</option>
                <option value="african-food">african-food</option>
                <option value="african-market">african-market</option>
              </select>
            </div>

            <div className="col-12 d-flex flex-wrap gap-3">
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={autoContext}
                  onChange={(e) => setAutoContext(e.target.checked)}
                />
                <span className="form-check-label">AUTO (lit les produits/promos)</span>
              </label>

              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                />
                <span className="form-check-label">Inclure _context dans le JSON</span>
              </label>
            </div>

            {err ? (
              <div className="col-12">
                <div className="alert alert-danger mb-0">{err}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card mt-3 border-0 shadow-sm">
        <div className="card-body">
          <label className="form-label">Résultat</label>
          <textarea
            className="form-control font-monospace"
            style={{ minHeight: 420 }}
            readOnly
            value={pretty}
            placeholder="Clique sur Générer…"
          />
        </div>
      </div>
    </>
  );
}
