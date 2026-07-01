// src/components/FloatingCartButton.tsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../store/cart";

export default function FloatingCartButton() {
  const { totalItems } = useCart();
  const prev = useRef<number>(totalItems);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (totalItems > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 400);
      return () => clearTimeout(t);
    }
    prev.current = totalItems;
  }, [totalItems]);

  // ✅ Tant que panier non vide => commande non finalisée => bouton visible
  if (totalItems <= 0) return null;

  return (
    <Link
      to="/cart"
      aria-label="Aller au panier"
      className={`d-lg-none rounded-pill shadow ${bump ? "cart-bump" : ""}`}
      style={{
        position: "fixed", // ✅ ne dépend plus de Bootstrap
        right: 16,
        bottom: "calc(16px + var(--duu-cart-fab-offset, 0px))",
        background: "var(--duu-black)",
        color: "#fff",
        padding: "12px 16px",
        zIndex: 2000,
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <ShoppingCart size={18} />
        <span>Panier</span>
        <span
          className="badge rounded-pill"
          style={{ background: "var(--duu-red)" }}
        >
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      </div>
    </Link>
  );
}
