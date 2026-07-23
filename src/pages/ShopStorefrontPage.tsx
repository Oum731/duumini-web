// src/pages/ShopStorefrontPage.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Globe2, ArrowLeft } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { getShopBySlug, type Shop } from "../services/shops";
import { listProducts, type Product } from "../services/products";
import { imgUrl } from "../utils/media";
import { PageLoader } from "../components/ui/Spinner";
import { Seo } from "../components/Seo";

async function fetchAllShopProducts(shopId: number): Promise<Product[]> {
  const maxPages = 20;
  const pageSize = 100;
  const all: Product[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await listProducts({ page, pageSize, shop_id: shopId, onlyActive: true });
    const items = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

export default function ShopStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const s = await getShopBySlug(slug);
        if (!mounted) return;
        setShop(s);

        const items = await fetchAllShopProducts(s.id);
        if (!mounted) return;
        setProducts(items);
      } catch (e: any) {
        if (!mounted) return;
        if (e?.status === 404) setNotFound(true);
        else setError(e?.message || "Impossible de charger cette boutique.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="container-xxl py-4">
        <PageLoader label="Chargement de la boutique…" />
      </div>
    );
  }

  if (notFound || !shop) {
    return (
      <div className="container-xxl py-5 text-center">
        <h1 className="h4">Boutique introuvable</h1>
        <p className="text-muted">Cette boutique n'existe pas ou n'est plus active.</p>
        <Link to="/" className="btn btn-outline-dark mt-2">
          <ArrowLeft size={16} className="me-1" />
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="container-xxl py-0 px-0">
      <Seo
        title={shop.name}
        description={
          shop.description
            ? String(shop.description).slice(0, 155)
            : `Découvrez la boutique ${shop.name} sur DUUMINI et ses produits disponibles à travers l'Afrique.`
        }
        image={shop.cover ? imgUrl(shop.cover) : shop.logo ? imgUrl(shop.logo) : undefined}
      />
      <div
        style={{
          background: shop.cover
            ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url(${imgUrl(shop.cover)}) center/cover no-repeat`
            : "linear-gradient(135deg, #111111 0%, #2a2a2a 100%)",
          color: "#fff",
        }}
      >
        <div className="container-xxl py-4">
          <div className="d-flex align-items-center gap-3">
            {shop.logo ? (
              <img
                src={imgUrl(shop.logo)}
                alt={shop.name}
                width={72}
                height={72}
                className="rounded-circle border border-2 border-white"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div
                className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center fw-bold"
                style={{ width: 72, height: 72, background: "rgba(255,255,255,.15)", fontSize: "1.5rem" }}
              >
                {shop.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <h1 className="h4 fw-bold mb-1">{shop.name}</h1>
              <div className="d-flex flex-wrap gap-3 small">
                {shop.city && (
                  <span className="d-flex align-items-center gap-1">
                    <MapPin size={14} /> {shop.city}
                  </span>
                )}
                {shop.country && (
                  <span className="d-flex align-items-center gap-1">
                    <Globe2 size={14} /> {shop.country}
                  </span>
                )}
              </div>
            </div>
          </div>

          {shop.description && (
            <p className="mt-3 mb-0" style={{ maxWidth: 680, opacity: 0.9 }}>
              {shop.description}
            </p>
          )}
        </div>
      </div>

      <div className="container-xxl py-4">
        {!!error && <div className="alert alert-danger">{error}</div>}

        <h2 className="h6 mb-3">Produits ({products.length})</h2>

        {products.length === 0 ? (
          <div className="text-muted">Cette boutique n'a pas encore de produit en vente.</div>
        ) : (
          <div className="row g-3">
            {products.map((p) => (
              <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={(p as any).id}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
