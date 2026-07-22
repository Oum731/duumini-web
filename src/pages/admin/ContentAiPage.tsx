// src/pages/admin/ContentAiPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../services/http";
import { getAccessToken } from "../../services/auth";
import { Spinner, LoadingState } from "../../components/ui/Spinner";

/* =========================
 * Types
 * =======================*/
type ContentStatus = "draft" | "published" | "archived";
type ContentType = "page" | "city_page" | string;

type ContentListItem = {
  id: number;
  type: ContentType;
  slug: string;
  lang: string;
  status: ContentStatus;
  score?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

type ContentItem = ContentListItem & {
  data?: any;
};

type VersionRow = {
  id: number;
  content_item_id: number;
  score_before?: number | null;
  score_after?: number | null;
  reason?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

/* =========================
 * Small helpers
 * =======================*/
function dt(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString("fr-FR", { hour12: false });
}
function badgeClass(status: ContentStatus) {
  if (status === "published") return "badge bg-success";
  if (status === "draft") return "badge bg-warning text-dark";
  return "badge bg-secondary";
}
function scoreClass(score?: number | null) {
  const v = Number(score ?? 0);
  if (v >= 8) return "badge bg-success";
  if (v >= 6) return "badge bg-warning text-dark";
  return "badge bg-danger";
}
function safeJson(v: any) {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v ?? "");
  }
}

/* =========================
 * ✅ API helpers (Bearer auth)
 * =======================*/
function getAuthHeaders() {
  const token = getAccessToken?.();
  if (!token) return null;

  return {
    Authorization: `Bearer ${token}`,
    "x-access-token": token, // fallback accepté par ton middleware
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const auth = getAuthHeaders();
  if (!auth) throw new Error("No token (connecte-toi en admin)");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json", ...auth },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.details || data?.error || `GET ${path} failed`);
  return data as T;
}

async function apiPost<T>(path: string, body?: any): Promise<T> {
  const auth = getAuthHeaders();
  if (!auth) throw new Error("No token (connecte-toi en admin)");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...auth,
    },
    body: body ? JSON.stringify(body) : "{}",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.details || data?.error || `POST ${path} failed`);
  return data as T;
}

/* =========================
 * Component
 * =======================*/
export default function ContentAiPage() {
  // filters
  const [status, setStatus] = useState<ContentStatus | "">("draft");
  const [type, setType] = useState<ContentType | "">("");
  const [lang, setLang] = useState("fr");
  const [q, setQ] = useState("");

  // list
  const [items, setItems] = useState<ContentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // selection
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [selected, setSelected] = useState<ContentItem | null>(null);

  // versions
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);

  // UI
  const [tab, setTab] = useState<"preview" | "json" | "versions">("preview");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const canPublish = useMemo(() => {
    return !!selected && selected.status !== "published";
  }, [selected]);

  const canUnpublish = useMemo(() => {
    return !!selected && selected.status === "published";
  }, [selected]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (type) qs.set("type", type);
      if (lang) qs.set("lang", lang);
      if (q.trim()) qs.set("q", q.trim());
      qs.set("limit", "80");
      qs.set("offset", "0");

      const res = await apiGet<{ ok: boolean; items: ContentListItem[] }>(
        `/api/admin/content-ai?${qs.toString()}`
      );
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, type, lang, q]);

  const fetchItem = useCallback(async (id: number) => {
    setItemLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ ok: boolean; item: ContentItem }>(`/api/admin/content-ai/${id}`);
      setSelected(res.item || null);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSelected(null);
    } finally {
      setItemLoading(false);
    }
  }, []);

  const fetchVersions = useCallback(async (id: number) => {
    setVersionsLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ ok: boolean; versions: VersionRow[] }>(
        `/api/admin/content-ai/${id}/versions`
      );
      setVersions(Array.isArray(res.versions) ? res.versions : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (selectedId != null) {
      fetchItem(selectedId);
      setTab("preview");
      setVersions([]);
    } else {
      setSelected(null);
      setVersions([]);
    }
  }, [selectedId, fetchItem]);

  const onSelect = (id: number) => setSelectedId(id);

  const runAiOptimize = useCallback(async () => {
    if (!selected) return;
    setBusyAction("optimize");
    setErr(null);
    try {
      const out = await apiPost<{
        ok: boolean;
        draft: { id: number };
        preview: any;
      }>(`/api/ai/seo/optimize-page`, {
        slug: selected.slug,
        lang: selected.lang || "fr",
        type: selected.type || "page",
        current: selected.data || null,
      });

      const id = out?.draft?.id || selected.id;
      await fetchList();
      setSelectedId(id);
      await fetchItem(id);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusyAction(null);
    }
  }, [selected, fetchItem, fetchList]);

  const publish = useCallback(async () => {
    if (!selected) return;
    setBusyAction("publish");
    setErr(null);
    try {
      await apiPost(`/api/admin/content-ai/${selected.id}/publish`);
      await fetchList();
      await fetchItem(selected.id);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusyAction(null);
    }
  }, [selected, fetchItem, fetchList]);

  const unpublish = useCallback(async () => {
    if (!selected) return;
    setBusyAction("unpublish");
    setErr(null);
    try {
      await apiPost(`/api/admin/content-ai/${selected.id}/unpublish`);
      await fetchList();
      await fetchItem(selected.id);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusyAction(null);
    }
  }, [selected, fetchItem, fetchList]);

  const openVersions = useCallback(async () => {
    if (!selected) return;
    setTab("versions");
    await fetchVersions(selected.id);
  }, [selected, fetchVersions]);

  const rollback = useCallback(
    async (versionId: number) => {
      if (!selected) return;
      setBusyAction("rollback");
      setErr(null);
      try {
        await apiPost(`/api/admin/content-ai/${selected.id}/rollback`, {
          version_id: versionId,
        });
        await fetchItem(selected.id);
        await fetchVersions(selected.id);
        await fetchList();
        setTab("preview");
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setBusyAction(null);
      }
    },
    [selected, fetchItem, fetchVersions, fetchList]
  );

  const selectedPreview = useMemo(() => {
    const d = selected?.data || null;
    if (!d) return null;

    const h1 = d.h1 || "";
    const metaTitle = d.meta?.title || "";
    const metaDesc = d.meta?.description || "";
    const sections = Array.isArray(d.sections) ? d.sections : [];
    const faq = Array.isArray(d.faq) ? d.faq : [];

    return { h1, metaTitle, metaDesc, sections, faq, body: d.body || "" };
  }, [selected]);

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <div className="h5 mb-0">Contenu IA (SEO)</div>
        </div>

        <button className="btn btn-outline-dark btn-sm" onClick={fetchList} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="xs" className="me-1" />
              Chargement…
            </>
          ) : (
            "Rafraîchir"
          )}
        </button>
      </div>

      {err && (
        <div className="alert alert-danger py-2">
          <div className="fw-semibold">Erreur</div>
          <div className="small">{err}</div>
        </div>
      )}

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 16 }}>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-2">
              <label className="form-label small text-muted">Statut</label>
              <select
                className="form-select form-select-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="">Tous</option>
                <option value="draft">Draft</option>
                <option value="published">Publié</option>
                <option value="archived">Archivé</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small text-muted">Type</label>
              <select
                className="form-select form-select-sm"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="">Tous</option>
                <option value="page">Page</option>
                <option value="city_page">Page Ville</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small text-muted">Lang</label>
              <select
                className="form-select form-select-sm"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                <option value="fr">fr</option>
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small text-muted">Recherche (slug)</label>
              <input
                className="form-control form-control-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="home, about, casablanca/..."
              />
            </div>

            <div className="col-12 col-md-2">
              <button className="btn btn-dark btn-sm w-100" onClick={fetchList} disabled={loading}>
                Filtrer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="row g-3">
        {/* Left: list */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-semibold">Items ({items.length})</div>
                <div className="text-muted small">Clique pour ouvrir</div>
              </div>

              {loading ? (
                <LoadingState />
              ) : items.length === 0 ? (
                <div className="text-muted">Aucun élément.</div>
              ) : (
                <div className="list-group">
                  {items.map((it) => {
                    const active = selectedId === it.id;
                    return (
                      <button
                        key={it.id}
                        className={
                          "list-group-item list-group-item-action d-flex justify-content-between align-items-start " +
                          (active ? "active" : "")
                        }
                        onClick={() => onSelect(it.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="me-2">
                          <div className="fw-semibold">{it.slug}</div>
                          <div className="small opacity-75">
                            {it.type} • {it.lang} • {dt(it.updated_at)}
                          </div>
                        </div>

                        <div className="text-end">
                          <div className={badgeClass(it.status)}>{it.status}</div>
                          <div className="mt-1">
                            <span className={scoreClass(it.score)}>
                              score {Number(it.score ?? 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: detail */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body">
              {!selectedId ? (
                <div className="text-muted">Sélectionne un élément à gauche.</div>
              ) : itemLoading ? (
                <LoadingState />
              ) : !selected ? (
                <div className="text-muted">Introuvable.</div>
              ) : (
                <>
                  {/* Header */}
                  <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
                    <div>
                      <div className="fw-semibold">{selected.slug}</div>
                      <div className="small text-muted">
                        {selected.type} • {selected.lang} •{" "}
                        <span className={badgeClass(selected.status)}>{selected.status}</span> •{" "}
                        <span className={scoreClass(selected.score)}>
                          score {Number(selected.score ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      <button
                        className="btn btn-outline-dark btn-sm"
                        onClick={runAiOptimize}
                        disabled={busyAction != null}
                        title="Demande à l'IA de régénérer une version draft améliorée"
                      >
                        {busyAction === "optimize" ? "Optimisation..." : "Optimiser (IA)"}
                      </button>

                      <button
                        className="btn btn-dark btn-sm"
                        onClick={publish}
                        disabled={!canPublish || busyAction != null}
                      >
                        {busyAction === "publish" ? "Publication..." : "Publier"}
                      </button>

                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={unpublish}
                        disabled={!canUnpublish || busyAction != null}
                      >
                        {busyAction === "unpublish" ? "..." : "Dépublier"}
                      </button>
                    </div>
                  </div>

                  <div className="small text-muted mb-3">
                    Créé: {dt(selected.created_at)} • MAJ: {dt(selected.updated_at)} • Publié:{" "}
                    {selected.published_at ? dt(selected.published_at) : "—"}
                  </div>

                  {/* Tabs */}
                  <div className="btn-group btn-group-sm mb-3" role="group">
                    <button
                      className={"btn " + (tab === "preview" ? "btn-dark" : "btn-outline-dark")}
                      onClick={() => setTab("preview")}
                    >
                      Aperçu
                    </button>
                    <button
                      className={"btn " + (tab === "json" ? "btn-dark" : "btn-outline-dark")}
                      onClick={() => setTab("json")}
                    >
                      JSON
                    </button>
                    <button
                      className={"btn " + (tab === "versions" ? "btn-dark" : "btn-outline-dark")}
                      onClick={openVersions}
                      disabled={versionsLoading}
                    >
                      {versionsLoading ? "Versions..." : "Versions"}
                    </button>
                  </div>

                  {/* Tab content */}
                  {tab === "preview" && (
                    <div>
                      {!selectedPreview ? (
                        <div className="text-muted">Pas de contenu.</div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <div className="text-muted small mb-1">H1</div>
                            <div className="fw-semibold">{selectedPreview.h1 || "—"}</div>
                          </div>

                          <div className="mb-3">
                            <div className="text-muted small mb-1">Meta title</div>
                            <div>{selectedPreview.metaTitle || "—"}</div>
                          </div>

                          <div className="mb-3">
                            <div className="text-muted small mb-1">Meta description</div>
                            <div>{selectedPreview.metaDesc || "—"}</div>
                          </div>

                          {selectedPreview.sections?.length > 0 && (
                            <div className="mb-3">
                              <div className="text-muted small mb-2">Sections</div>
                              <div className="accordion" id="seoSectionsAcc">
                                {selectedPreview.sections.map((s: any, i: number) => (
                                  <div className="accordion-item" key={i}>
                                    <h2 className="accordion-header" id={`h${i}`}>
                                      <button
                                        className={"accordion-button " + (i === 0 ? "" : "collapsed")}
                                        type="button"
                                        data-bs-toggle="collapse"
                                        data-bs-target={`#c${i}`}
                                        aria-expanded={i === 0 ? "true" : "false"}
                                        aria-controls={`c${i}`}
                                      >
                                        {s.h2}
                                      </button>
                                    </h2>
                                    <div
                                      id={`c${i}`}
                                      className={"accordion-collapse collapse " + (i === 0 ? "show" : "")}
                                      aria-labelledby={`h${i}`}
                                      data-bs-parent="#seoSectionsAcc"
                                    >
                                      <div className="accordion-body" style={{ whiteSpace: "pre-wrap" }}>
                                        {s.body}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedPreview.faq?.length > 0 && (
                            <div className="mb-3">
                              <div className="text-muted small mb-2">FAQ</div>
                              <div className="accordion" id="seoFaqAcc">
                                {selectedPreview.faq.map((f: any, i: number) => (
                                  <div className="accordion-item" key={i}>
                                    <h2 className="accordion-header" id={`fh${i}`}>
                                      <button
                                        className={"accordion-button " + (i === 0 ? "" : "collapsed")}
                                        type="button"
                                        data-bs-toggle="collapse"
                                        data-bs-target={`#fc${i}`}
                                        aria-expanded={i === 0 ? "true" : "false"}
                                        aria-controls={`fc${i}`}
                                      >
                                        {f.q}
                                      </button>
                                    </h2>
                                    <div
                                      id={`fc${i}`}
                                      className={"accordion-collapse collapse " + (i === 0 ? "show" : "")}
                                      aria-labelledby={`fh${i}`}
                                      data-bs-parent="#seoFaqAcc"
                                    >
                                      <div className="accordion-body" style={{ whiteSpace: "pre-wrap" }}>
                                        {f.a}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedPreview.body ? (
                            <div className="mb-1">
                              <div className="text-muted small mb-1">Body (texte complet)</div>
                              <div className="p-3 border rounded" style={{ whiteSpace: "pre-wrap" }}>
                                {selectedPreview.body}
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}

                  {tab === "json" && (
                    <pre
                      className="p-3 border rounded"
                      style={{
                        fontSize: 12,
                        background: "#f8f9fa",
                        maxHeight: 520,
                        overflow: "auto",
                      }}
                    >
                      {safeJson(selected.data)}
                    </pre>
                  )}

                  {tab === "versions" && (
                    <div>
                      {versionsLoading ? (
                        <LoadingState />
                      ) : versions.length === 0 ? (
                        <div className="text-muted">Aucune version.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Raison</th>
                                <th>Score</th>
                                <th className="text-end">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {versions.map((v) => (
                                <tr key={v.id}>
                                  <td className="text-muted">{v.id}</td>
                                  <td>{dt(v.created_at)}</td>
                                  <td className="small">{v.reason || "—"}</td>
                                  <td>
                                    <span className="badge bg-light text-dark border">
                                      {(v.score_after ?? v.score_before ?? "—") as any}
                                    </span>
                                  </td>
                                  <td className="text-end">
                                    <button
                                      className="btn btn-outline-dark btn-sm"
                                      onClick={() => rollback(v.id)}
                                      disabled={busyAction != null}
                                      title="Revenir à cette version (en draft)"
                                    >
                                      {busyAction === "rollback" ? "..." : "Rollback"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="text-muted small">
                        Le rollback remet l’item en <b>draft</b> (tu peux ensuite republier).
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
