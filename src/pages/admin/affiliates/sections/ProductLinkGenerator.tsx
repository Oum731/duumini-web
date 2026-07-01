import { Copy, Package, Search } from "lucide-react";
import { DUU, formatMoney, type ProductOption } from "../shared";

export function ProductLinkGenerator({
  productSearch,
  selectedProductId,
  productsLoading,
  filteredProducts,
  selectedProduct,
  selectedProductPath,
  selectedProductPublicUrl,
  selectedProductTrackingUrl,
  onSearchChange,
  onProductSelect,
  onCopy,
}: {
  productSearch: string;
  selectedProductId: number | "";
  productsLoading: boolean;
  filteredProducts: ProductOption[];
  selectedProduct: ProductOption | null;
  selectedProductPath: string;
  selectedProductPublicUrl: string;
  selectedProductTrackingUrl: string;
  onSearchChange: (value: string) => void;
  onProductSelect: (id: number | "") => void;
  onCopy: (text: string | null | undefined, label: string) => void;
}) {
  return (
    <div
      className="mb-4 p-3"
      style={{
        borderRadius: 18,
        background: DUU.yellowSoft,
        border: `1px solid ${DUU.yellowBorder}`,
      }}
    >
      <div className="d-flex align-items-center gap-2 mb-2">
        <Package size={16} />
        <div className="fw-bold" style={{ color: DUU.black }}>
          Lien produit affilié
        </div>
      </div>

      <div className="small mb-3" style={{ color: "#6B5B22" }}>
        Choisis un produit dans la liste pour générer un lien produit
        ou un lien tracking produit.
      </div>

      <div className="mb-2">
        <label className="form-label small fw-semibold">Recherche produit</label>
        <div className="position-relative">
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: DUU.gray,
            }}
          />
          <input
            type="text"
            className="form-control"
            style={{
              paddingLeft: 36,
              borderRadius: 14,
              borderColor: DUU.yellowBorder,
              background: DUU.white,
            }}
            value={productSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nom, boutique, slug, ID..."
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold">Produit</label>
        <select
          className="form-select"
          style={{
            borderRadius: 14,
            borderColor: DUU.yellowBorder,
            background: DUU.white,
          }}
          value={selectedProductId}
          onChange={(e) => onProductSelect(e.target.value ? Number(e.target.value) : "")}
          disabled={productsLoading}
        >
          <option value="">
            {productsLoading
              ? "Chargement des produits..."
              : "Sélectionner un produit"}
          </option>
          {filteredProducts.map((product) => (
            <option key={product.id} value={product.id}>
              #{product.id} — {product.name}
              {product.shop_name ? ` — ${product.shop_name}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct ? (
        <div
          className="mb-3 p-2"
          style={{
            borderRadius: 14,
            background: "rgba(255,255,255,0.7)",
            border: `1px solid ${DUU.yellowBorder}`,
          }}
        >
          <div className="fw-semibold" style={{ color: DUU.black }}>
            {selectedProduct.name}
          </div>
          <div className="small" style={{ color: DUU.gray }}>
            ID: {selectedProduct.id}
            {selectedProduct.shop_name ? ` • ${selectedProduct.shop_name}` : ""}
          </div>
          <div className="small" style={{ color: DUU.gray }}>
            Prix:{" "}
            {formatMoney(
              selectedProduct.promo_price || selectedProduct.price || 0,
            )}
            {selectedProduct.stock != null
              ? ` • Stock: ${selectedProduct.stock}`
              : ""}
          </div>
          <div className="small mt-1" style={{ color: DUU.gray }}>
            Chemin public: {selectedProductPath || "-"}
          </div>
        </div>
      ) : null}

      <div className="d-grid gap-2">
        <button
          type="button"
          className="btn text-start"
          style={{
            background: DUU.black,
            color: DUU.yellow,
            borderRadius: 14,
            fontWeight: 800,
          }}
          onClick={() => onCopy(selectedProductPublicUrl, "Lien produit affilié")}
          disabled={!selectedProductPublicUrl}
        >
          <Copy size={15} className="me-2" />
          Copier lien produit (CLIENT)
        </button>

        <button
          type="button"
          className="btn text-start"
          style={{
            background: DUU.white,
            color: DUU.black,
            border: `1px solid ${DUU.yellowBorder}`,
            borderRadius: 14,
            fontWeight: 700,
          }}
          onClick={() =>
            onCopy(selectedProductTrackingUrl, "Lien tracking produit affilié")
          }
          disabled={!selectedProductTrackingUrl}
        >
          <Copy size={15} className="me-2" />
          Copier lien tracking (technique)
        </button>
      </div>

      {selectedProductPublicUrl ? (
        <div
          className="small mt-3 text-break"
          style={{ color: DUU.black, lineHeight: 1.5 }}
        >
          {selectedProductPublicUrl}
        </div>
      ) : null}
    </div>
  );
}
