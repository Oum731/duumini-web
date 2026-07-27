// src/pages/products/productForm/types.ts
import type { Product, PromoDiscountType as SvcPromoDiscountType } from "../../../services/products";

export type ProductImage = { id: number; url: string; sort_order: number };

export type FullProduct = Product &
  { images?: ProductImage[] } & {
    shop_name?: string | null;
    sub_category_name?: string | null;
  };

export type Shop = {
  id: number;
  name: string;
  logo?: string | null;
  cover?: string | null;
};

export type Vertical = "FOOD" | "MARKET" | "FASHION";

export type SubCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  category_name?: string | null;
  category_slug?: string | null;
  vertical?: Vertical | null;
};

export type ProductStyle = "food" | "market" | "fashion";
export type PromoDiscountType = SvcPromoDiscountType;

export type Draft = {
  style?: ProductStyle | "";
  vertical?: Vertical | null;

  name: string;
  brand?: string | null;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  conditionnement?: string | null;
  stock?: number | null;

  is_featured?: 0 | 1 | null;
  promo_eligible?: 0 | 1 | null;

  category_id?: number | null;
  sub_category_id?: number | null;

  shop_id?: number | null;

  promo_discount_type?: PromoDiscountType | null;
  promo_discount_value?: number | null;
  promo_free_delivery?: 0 | 1 | null;

  is_active?: 0 | 1 | null;
};

export type VariantDraft = {
  id?: number;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  stock?: number;
  price_override?: number | null;
  is_active?: 0 | 1 | null;
};
