// src/services/productRatings.ts
import { api } from "./http";

export type ProductRatingSummary = {
  average: number;
  count: number;
};

export type ProductRateResponse = {
  ok: boolean;
  average: number;
  count: number;
  user_rating: number;
  comment?: string;
};

export type ProductRatingItem = {
  id: number;
  rating: number;
  comment?: string | null;
  created_at: string;
  user_id: number;
  user_name: string;
};

export type DeleteProductRatingResponse = {
  ok: boolean;
  deleted: boolean;
  average: number;
  count: number;
};

// 👇 Produit à noter après commande (pending-rating)
export type PendingProductRating = {
  product_id: number;
  product_name: string;
  product_image?: string | null;
  order_id: number;
  delivered_at: string;
};

export async function getProductRatingSummary(productId: number) {
  return api.get<ProductRatingSummary>(`/api/products/${productId}/ratings`);
}

export async function listProductRatings(productId: number) {
  return api.get<ProductRatingItem[]>(
    `/api/products/${productId}/ratings/list`
  );
}

export async function rateProduct(
  productId: number,
  rating: number,
  comment?: string
) {
  return api.post<ProductRateResponse>(`/api/products/${productId}/rate`, {
    rating,
    comment,
  });
}

export async function deleteProductRating(productId: number) {
  // selon ton wrapper api : api.delete ou api.del
  return api.delete<DeleteProductRatingResponse>(
    `/api/products/${productId}/rate`
  );
}

// 👇 Appelé au démarrage de l'app pour savoir si un produit doit être noté
export async function getPendingProductRating() {
  return api.get<PendingProductRating | null>(
    "/api/products/pending-rating"
  );
}
