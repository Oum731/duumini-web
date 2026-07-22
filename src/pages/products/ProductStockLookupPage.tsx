// src/pages/products/ProductStockLookupPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { me } from "../../services/auth";
import { getProduct, type Product, type ProductVariant } from "../../services/products";
import { moneyMAD } from "../../utils/money";
import { imgUrl } from "../../utils/media";
import { LoadingState } from "../../components/ui/Spinner";

type AnyObj = Record<string, any>;

function isProRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "VENDEUR" || r === "FOURNISSEUR" || r === "RESTAURANT";
}

export default function ProductStockLookupPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sku = searchParams.get("sku") || "";

  const [user, setUser] = useState<AnyObj | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (mounted) setUser((u as any) || null);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setUserLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const productId = Number(id || 0);
    if (!productId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await getProduct(productId, { variants: true });
        if (mounted) setProduct(p);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Produit introuvable.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const variants = useMemo(() => {
    const arr = Array.isArray((product as any)?.variants) ? ((product as any).variants as ProductVariant[]) : [];
    return [...arr].sort((a, b) => {
      const s = String(a.size || "").localeCompare(String(b.size || ""), "fr", { sensitivity: "base" });
      if (s !== 0) return s;
      return String(a.color || "").localeCompare(String(b.color || ""), "fr", { sensitivity: "base" });
    });
  }, [product]);

  const highlighted = useMemo(() => {
    if (!sku) return null;
    return variants.find((v) => String(v.sku || "").toLowerCase() === sku.toLowerCase()) || null;
  }, [variants, sku]);

  if (userLoaded && !isProRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  const productId = Number(id || 0);
  if (!productId) {
    return (
      <div className="container-xxl py-4">
        <div className="alert alert-danger">Identifiant produit invalide.</div>
      </div>
    );
  }

  const roleUp = String(user?.role || "").toUpperCase();
  const editHref = roleUp === "ADMIN" ? `/admin/products?edit=${productId}` : `/vendeur/produits?edit=${productId}`;

  const anyP = (product || {}) as AnyObj;
  const rawImg = anyP?.cover || anyP?.image || anyP?.image_url || anyP?.thumb || anyP?.images?.[0]?.url || null;
  const img = rawImg ? imgUrl(String(rawImg)) : "";

  return (
    <div className="container-xxl py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h5 m-0">Fiche de gestion produit</h1>
        <Link to="/" className="btn btn-outline-dark btn-sm">
          Accueil
        </Link>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : !product ? (
        <div className="alert alert-warning">Produit introuvable.</div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex gap-3 align-items-start flex-wrap">
              {img ? (
                <img
                  src={img}
                  alt={anyP.name}
                  className="rounded border"
                  style={{ width: 96, height: 96, objectFit: "cover" }}
                />
              ) : null}

              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h2 className="h5 m-0">{anyP.name}</h2>
                  {anyP.vertical ? <span className="badge text-bg-light border">{anyP.vertical}</span> : null}
                </div>
                <div className="small text-muted mt-1">
                  {anyP.shop_name ? <>Boutique : {anyP.shop_name} • </> : null}
                  Produit #{productId}
                </div>
                <div className="mt-2">
                  <b>{moneyMAD(Number(anyP.price ?? 0))}</b>
                  {!variants.length ? (
                    <span className="ms-3 small text-muted">Stock : {anyP.stock ?? "—"}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {highlighted ? (
              <div className="alert alert-success mt-3 mb-0">
                <div className="fw-semibold">Variante scannée</div>
                <div className="small">
                  Taille <b>{highlighted.size}</b> • Couleur <b>{highlighted.color}</b> • SKU{" "}
                  <b>{highlighted.sku}</b>
                </div>
                <div className="small mt-1">
                  Stock : <b>{highlighted.stock}</b> • Prix :{" "}
                  <b>
                    {moneyMAD(
                      highlighted.price_override != null && Number(highlighted.price_override) > 0
                        ? Number(highlighted.price_override)
                        : Number(anyP.price ?? 0)
                    )}
                  </b>{" "}
                  •{" "}
                  {(highlighted.is_active ?? 1) === 1 ? (
                    <span className="badge bg-success">Actif</span>
                  ) : (
                    <span className="badge bg-secondary">Désactivé</span>
                  )}
                </div>
              </div>
            ) : null}

            {variants.length > 0 && (
              <div className="table-responsive mt-3">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Taille</th>
                      <th>Couleur</th>
                      <th>SKU</th>
                      <th className="text-end">Stock</th>
                      <th className="text-end">Prix</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => {
                      const isHighlighted = highlighted && v.id === highlighted.id;
                      const price =
                        v.price_override != null && Number(v.price_override) > 0
                          ? Number(v.price_override)
                          : Number(anyP.price ?? 0);
                      return (
                        <tr key={v.id} className={isHighlighted ? "table-success" : ""}>
                          <td>{v.size}</td>
                          <td>{v.color}</td>
                          <td>{v.sku || "—"}</td>
                          <td className="text-end">{v.stock}</td>
                          <td className="text-end">{moneyMAD(price)}</td>
                          <td>
                            {(v.is_active ?? 1) === 1 ? (
                              <span className="badge bg-success">Actif</span>
                            ) : (
                              <span className="badge bg-secondary">Off</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="d-flex gap-2 flex-wrap mt-3">
              <Link to={editHref} className="btn btn-dark btn-sm">
                Modifier ce produit
              </Link>
              <Link to={`/products/${productId}`} className="btn btn-outline-secondary btn-sm">
                Voir la fiche publique
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
