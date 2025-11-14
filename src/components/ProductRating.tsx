// src/components/ProductRating.tsx
import { useEffect, useState } from "react";
import {
  getProductRatingSummary,
  listProductRatings,
  rateProduct,
  deleteProductRating,
  type ProductRatingItem,
} from "../services/productRatings";
import { useAuth } from "../context/AuthContext";

type Props = {
  productId: number;
};

export default function ProductRating({ productId }: Props) {
  const { user } = useAuth();

  const [average, setAverage] = useState<number>(0);
  const [count, setCount] = useState<number>(0);

  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [ratings, setRatings] = useState<ProductRatingItem[]>([]);
  const [listLoading, setListLoading] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoaded, setListLoaded] = useState<boolean>(false);

  // Modal
  const [showModal, setShowModal] = useState<boolean>(false);

  /* ===== Chargement résumé (moyenne + count) ===== */
  useEffect(() => {
    let mounted = true;

    async function fetchSummary() {
      setLoading(true);
      setError(null);
      try {
        const res = await getProductRatingSummary(productId);
        const data = (res as any).data ?? res;

        if (mounted) {
          setAverage(data.average ?? 0);
          setCount(data.count ?? 0);
        }
      } catch (e) {
        console.error("Erreur chargement notes produit:", e);
        if (mounted) setError("Impossible de charger les notes.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchSummary();
    return () => {
      mounted = false;
    };
  }, [productId]);

  /* ===== Chargement liste des avis ===== */
  async function fetchListIfNeeded() {
    if (listLoaded || listLoading) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await listProductRatings(productId);
      const data = (res as any).data ?? res;
      const items: ProductRatingItem[] = Array.isArray(data) ? data : [];
      setRatings(items);
      setListLoaded(true);

      // Pré-remplir le formulaire si le user a déjà noté
      if (user) {
        const mine = items.find((r) => r.user_id === user.id);
        if (mine) {
          setUserRating(mine.rating);
          setComment(mine.comment || "");
        }
      }
    } catch (e) {
      console.error("Erreur chargement liste avis:", e);
      setListError("Impossible de charger la liste des avis.");
    } finally {
      setListLoading(false);
    }
  }

  function openModal() {
    setShowModal(true);
    setSuccess(null);
    setError(null);
    fetchListIfNeeded();
    if (typeof document !== "undefined") {
      document.body.classList.add("modal-open");
    }
  }

  function closeModal() {
    setShowModal(false);
    if (typeof document !== "undefined") {
      document.body.classList.remove("modal-open");
    }
  }

  /* ===== Envoi (création / modification) d’un avis ===== */
  async function handleSubmit() {
    if (!user) {
      alert("Vous devez être connecté pour noter ce produit.");
      return;
    }
    if (!userRating) {
      alert("Choisissez d'abord le nombre d'étoiles.");
      return;
    }
    if (saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await rateProduct(
        productId,
        userRating,
        comment.trim() || undefined
      );
      const data = (res as any).data ?? res;

      setAverage(data.average ?? userRating);
      setCount(data.count ?? 1);
      setSuccess("Votre avis a été enregistré.");

      // Met à jour la liste en local
      if (user && (showModal || listLoaded)) {
        setRatings((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((r) => r.user_id === user.id);

          const newItem: ProductRatingItem = {
            id: idx >= 0 ? updated[idx].id : Date.now(),
            user_id: user.id,
            user_name:
              (user.first_name && user.first_name.trim()) ||
              (user.last_name && user.last_name.trim()) ||
              user.phone ||
              "Client Duumini",
            rating: userRating,
            comment: comment.trim() || "",
            created_at: idx >= 0 ? updated[idx].created_at : new Date().toISOString(),
          };

          if (idx >= 0) {
            updated[idx] = newItem;
          } else {
            updated.unshift(newItem);
          }
          return updated;
        });
      }
    } catch (e) {
      console.error("Erreur enregistrement avis:", e);
      setError("Impossible d'enregistrer votre avis.");
    } finally {
      setSaving(false);
    }
  }

  /* ===== Suppression de l’avis du user ===== */
  async function handleDeleteMyRating() {
    if (!user) {
      alert("Vous devez être connecté.");
      return;
    }
    if (!confirm("Supprimer votre avis pour ce produit ?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteProductRating(productId);
      const data = (res as any).data ?? res;

      setAverage(data.average ?? 0);
      setCount(data.count ?? 0);
      setSuccess("Votre avis a été supprimé.");

      // Retire l'avis du user de la liste
      setRatings((prev) => prev.filter((r) => r.user_id !== user.id));

      // Reset du formulaire
      setUserRating(null);
      setComment("");
    } catch (e) {
      console.error("Erreur suppression avis:", e);
      setError("Impossible de supprimer votre avis.");
    } finally {
      setSaving(false);
    }
  }

  /* ===== Rendu étoiles interactives (formulaire) ===== */
  function renderStar(idx: number) {
    const activeValue = hoverRating ?? userRating ?? Math.round(average);
    const isActive = idx <= activeValue;

    return (
      <button
        key={idx}
        type="button"
        className="btn btn-link p-0 border-0 text-decoration-none"
        onClick={() => setUserRating(idx)}
        onMouseEnter={() => setHoverRating(idx)}
        onMouseLeave={() => setHoverRating(null)}
        aria-label={`${idx} étoile${idx > 1 ? "s" : ""}`}
        disabled={saving}
        style={{ padding: 0, margin: 0 }}
      >
        <span
          style={{
            fontSize: "1.15rem",
            lineHeight: 1,
            cursor: "pointer",
            transition: "transform 0.15s ease, color 0.15s ease",
            color: isActive ? "var(--duu-yellow)" : "#E0E0E0",
          }}
        >
          ★
        </span>
      </button>
    );
  }

  /* ===== Rendu étoiles statiques (liste avis + résumé) ===== */
  function renderStaticStars(value: number) {
    return (
      <span aria-label={`${value} étoiles`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            style={{
              fontSize: "0.95rem",
              lineHeight: 1,
              color: i <= value ? "var(--duu-yellow)" : "#E0E0E0",
            }}
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  const labelAvis = count <= 0 ? "Aucun avis" : `${count} avis`;

  return (
    <>
      {/* Résumé sous le produit */}
      <div
        className="d-flex flex-column gap-1 mt-1"
        style={{ fontSize: "0.8rem", color: "var(--duu-black)" }}
      >
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center">
            {renderStaticStars(Math.round(average))}
          </div>

          {!loading && !error && (
            <div className="small d-flex align-items-center gap-1 flex-wrap">
              <span>{average.toFixed(1)} / 5</span>
              <span>·</span>
              <span>{labelAvis}</span>

              {count > 0 ? (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 border-0 text-decoration-none"
                    onClick={openModal}
                  >
                    Voir les avis
                  </button>
                </>
              ) : (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 border-0 text-decoration-none"
                    onClick={openModal}
                  >
                    Donner une note
                  </button>
                </>
              )}
            </div>
          )}

          {loading && <span className="small">Chargement…</span>}
          {error && (
            <span className="small" style={{ color: "var(--duu-red)" }}>
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Modal avis & notes */}
      {showModal && (
        <>
          {/* Backdrop Bootstrap */}
          <div className="modal-backdrop fade show" />

          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Notes & avis ({count} {count <= 1 ? "avis" : "avis"})
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fermer"
                    onClick={closeModal}
                  />
                </div>

                <div className="modal-body">
                  {/* Petit résumé en haut du modal */}
                  <div className="mb-3 d-flex align-items-center gap-2 flex-wrap">
                    <div className="d-flex align-items-center gap-2">
                      {renderStaticStars(Math.round(average))}
                      <span className="fw-semibold">
                        {average.toFixed(1)} / 5
                      </span>
                    </div>
                    <span className="text-muted small">
                      Basé sur {count} {count <= 1 ? "avis" : "avis"}
                    </span>
                  </div>

                  {/* Liste des avis */}
                  {listLoading && (
                    <div className="small text-muted mb-2">
                      Chargement des avis…
                    </div>
                  )}
                  {listError && (
                    <div className="small text-danger mb-2">{listError}</div>
                  )}

                  {!listLoading && !listError && ratings.length === 0 && (
                    <div className="alert alert-light small" role="alert">
                      Aucun avis pour l’instant. Soyez le premier à donner le
                      vôtre !
                    </div>
                  )}

                  {!listLoading && !listError && ratings.length > 0 && (
                    <div className="d-flex flex-column gap-2 mb-3">
                      {ratings.map((r) => {
                        const isMine = user && r.user_id === user.id;
                        return (
                          <div
                            key={r.id}
                            className="pb-2 border-bottom"
                            style={{ borderColor: "#eee" }}
                          >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <strong className="small">
                                {r.user_name || "Client Duumini"}
                              </strong>
                              <div className="d-flex align-items-center gap-2">
                                {renderStaticStars(r.rating)}
                                {isMine && (
                                  <div className="d-flex gap-1">
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary btn-xs btn-sm"
                                      onClick={() => {
                                        setUserRating(r.rating);
                                        setComment(r.comment || "");
                                        setSuccess(
                                          "Vous modifiez votre avis pour ce produit."
                                        );
                                      }}
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger btn-xs btn-sm"
                                      onClick={handleDeleteMyRating}
                                      disabled={saving}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {r.comment && (
                              <p className="small mb-0 text-muted">
                                {r.comment}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Formulaire dans le modal */}
                  <div className="mt-2 pt-2 border-top" style={{ borderColor: "#ddd" }}>
                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                      <span className="small fw-semibold">Votre note :</span>
                      {[1, 2, 3, 4, 5].map((i) => renderStar(i))}
                    </div>

                    <textarea
                      className="form-control form-control-sm mb-2"
                      rows={3}
                      placeholder="Partagez votre avis (optionnel)…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      disabled={saving}
                    />

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-duu"
                        onClick={handleSubmit}
                        disabled={saving || loading}
                      >
                        {saving ? "Envoi…" : "Envoyer mon avis"}
                      </button>

                      {success && (
                        <span
                          className="small"
                          style={{ color: "var(--duu-black)" }}
                        >
                          {success}
                        </span>
                      )}
                      {error && (
                        <span
                          className="small"
                          style={{ color: "var(--duu-red)" }}
                        >
                          {error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={closeModal}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
