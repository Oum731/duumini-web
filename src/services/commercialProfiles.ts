// src/services/commercialProfiles.ts
import { api } from "./http";

export type MyCommercialProfile = {
  user_id: number;
  commission_rate: number;
  created_at: string;
  revenue_month: number;
  orders_month: number;
  clients_month: number;
  pending_commission: number;
};

export type AdminCommercialProfile = {
  user_id: number;
  commission_rate: number;
  created_at: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  revenue_month: number;
  orders_month: number;
  clients_month: number;
  pending_commission: number;
};

/** Entrée légère (pas de CA/commission) pour un sélecteur "à qui créditer
 * cette vente" — utilisable par un commercial lui-même (voir GET
 * /directory, contrairement à GET / qui est réservé à l'ADMIN). */
export type CommercialDirectoryEntry = {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
};

export type CommercialPortfolioClient = {
  client_user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  orders_count: number;
  revenue_total: number;
  last_order_at: string;
};

function extractApiErrorData(err: any): any | null {
  return err?.payload ?? err?.data ?? err?.response?.data ?? err?.body ?? err?.error ?? null;
}

export function commercialProfileErrorMessage(err: any, fallback = "Une erreur est survenue."): string {
  const d = extractApiErrorData(err);
  return (typeof d?.error === "string" && d.error) || err?.message || fallback;
}

/** Le commercial connecté consulte son propre CA/portefeuille/solde. */
export async function getMyCommercialProfile() {
  return api.get<MyCommercialProfile>("/api/commercial-profiles/me");
}

/** Accessible à tout commercial connecté — liste id+nom de tous les
 * commerciaux (lui inclus), pour attribuer une déclaration à un
 * collègue plutôt qu'à lui-même. Aucune donnée financière exposée. */
export async function listCommercialDirectory() {
  return api.get<{ items: CommercialDirectoryEntry[] }>(
    "/api/commercial-profiles/directory"
  );
}

/** ===== Admin ===== */

export async function listCommercialProfiles() {
  return api.get<{ items: AdminCommercialProfile[] }>("/api/commercial-profiles");
}

export async function getCommercialPortfolio(userId: number) {
  return api.get<{ items: CommercialPortfolioClient[] }>(
    `/api/commercial-profiles/${userId}/portfolio`
  );
}

export async function updateCommercialRate(userId: number, commissionRate: number) {
  return api.patch<{ ok: true; commission_rate: number }>(
    `/api/commercial-profiles/${userId}/rate`,
    { commission_rate: commissionRate }
  );
}

export async function settleCommercialBalance(userId: number) {
  return api.patch<{ ok: true; settled_orders: number }>(
    `/api/commercial-profiles/${userId}/settle`
  );
}
