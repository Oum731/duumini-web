// src/components/ProductCard.tsx
import { useMemo, useState } from "react";
import type { Product } from "../services/products";
import { API_BASE } from "../services/http";
import { useCart } from "../store/cart";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  const v = Number(n || 0);
  return `${v.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} MAD`;
}

function shortText(s?: string | null, max = 200) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function buildProductUrl(p: Product) {
  const base =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://duumini.com";

  const sub = (p.sub_category || "").toString().toLowerCase();
  const path = sub === "food" ? "/african-food" : "/african-market";

  // ✅ Le lien partagé envoie directement vers la rubrique (pas la fiche produit)
  return `${base}${path}`;
}

/* ===== Component ===== */
type Props = { product: Product; onAdd?: (p: Product) => void };

export default function ProductCard({ product, onAdd }: Props) {
  const cover = product.cover || product.images?.[0]?.url || null;
  const coverUrl = imgUrl(cover);
  const tag =
    product.sub_category === "food"
      ? {
          
          cls: "bg-success-subtle text-success-emphasis border-success-subtle",
        }
      : {
          
          cls: "bg-primary-subtle text-primary-emphasis border-primary-subtle",
        };

  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => buildProductUrl(product), [product]);
  const shareText = useMemo(
    () => `${product.name} — ${moneyMAD(product.price)} sur Duumini`,
    [product.name, product.price]
  );

  const handleAdd = () => (onAdd ? onAdd(product) : add(product, 1));

  async function shareProductWithImage() {
    try {
      if (coverUrl && typeof navigator !== "undefined" && "share" in navigator) {
        const resp = await fetch(coverUrl, { mode: "cors" });
        const blob = await resp.blob();
        const ext = blob.type.split("/")[1] || "jpg";
        const file = new File(
          [blob],
          `${product.slug || `product-${product.id}`}.${ext}`,
          {
            type: blob.type || "image/jpeg",
            lastModified: Date.now(),
          }
        );
        // @ts-ignore
        if (
          typeof navigator.canShare === "function" &&
          // @ts-ignore
          navigator.canShare({ files: [file] })
        ) {
          // @ts-ignore
          await navigator.share({
            title: product.name,
            text: shareText,
            url: shareUrl,
            files: [file],
          });
          return;
        }
      }
    } catch {
      // ignore
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="card h-100 border-0 shadow-sm">
        <div className="position-relative">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={product.name}
              className="w-100"
              style={{
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderTopLeftRadius: ".5rem",
                borderTopRightRadius: ".5rem",
              }}
              loading="lazy"
            />
          ) : (
            <div
              className="w-100 bg-light"
              style={{
                aspectRatio: "1 / 1",
                borderTopLeftRadius: ".5rem",
                borderTopRightRadius: ".5rem",
              }}
            />
          )}
          <span
            className={`badge position-absolute top-0 start-0 m-2 border ${tag.cls}`}
            style={{ backdropFilter: "blur(4px)" }}
          >
           
          </span>
        </div>

        <div className="card-body d-flex flex-column">
          {/* ✅ Titre avec retour à la ligne (plus de text-truncate) */}
          <h3
            className="h6 mb-1"
            title={product.name}
            style={{ wordWrap: "break-word", whiteSpace: "normal" }}
          >
            {product.name}
          </h3>

          {/* ✅ Prix sans décimales */}
          <div className="fw-semibold mb-2">{moneyMAD(product.price)}</div>

          <div className="mt-auto d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm flex-fill"
              onClick={() => setOpen(true)}
            >
              Voir
            </button>
            <button
              className="btn btn-dark btn-sm flex-fill"
              onClick={handleAdd}
              title="Ajouter au panier"
            >
              + Panier
            </button>
          </div>
        </div>
      </div>

      {/* ===== Modal Voir ===== */}
      {open && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ background: "rgba(0,0,0,.35)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg modal-fullscreen-sm-down"
            role="document"
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{product.name}</h5>
                <button
                  className="btn-close"
                  aria-label="Fermer"
                  onClick={() => setOpen(false)}
                />
              </div>

              <div className="modal-body">
                <div className="row g-3 align-items-start">
                  <div className="col-12 col-md-6">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={product.name}
                        className="img-fluid rounded"
                        style={{ width: "100%", height: "auto" }}
                      />
                    ) : (
                      <div
                        className="bg-light rounded"
                        style={{ width: "100%", paddingTop: "100%" }}
                      />
                    )}
                  </div>

                  <div className="col-12 col-md-6 d-flex flex-column">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="h5 m-0">{moneyMAD(product.price)}</span>
                      <span className={`badge border ${tag.cls}`}></span>
                    </div>

                    {product.description ? (
                      <p className="text-muted">
                        {shortText(product.description, 320)}
                      </p>
                    ) : (
                      <p className="text-muted">Aucune description fournie.</p>
                    )}

                    <div className="mt-auto d-grid gap-2">
                      <button className="btn btn-dark" onClick={handleAdd}>
                        + Ajouter au panier
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={shareProductWithImage}
                      >
                        {copied ? "Lien copié" : "Partager"}
                      </button>
                    </div>
                  </div>
                </div>

                {Array.isArray(product.images) && product.images.length > 1 && (
                  <div className="mt-3">
                    <div className="d-flex gap-2 flex-wrap">
                      {product.images.slice(0, 6).map((im, i) => (
                        <img
                          key={i}
                          src={imgUrl(im.url)}
                          alt={`${product.name} ${i + 1}`}
                          className="rounded"
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer d-flex flex-wrap gap-2">
                <button
                  className="btn btn-outline-dark ms-auto"
                  onClick={() => setOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
