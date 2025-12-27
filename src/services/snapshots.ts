import { api } from "./http";

export type SalesSnapshot = {
  id: number;
  period_type: "MONTH" | "YEAR";
  period_key: string;
  start_date: string;
  end_date: string;
  orders_done: number;
  items_amount: string | number;
  delivery_amount: string | number;
  total_amount: string | number;
  duumini_commission: string | number;
  created_at: string;
};

export type ListSnapshotsResponse = { items: SalesSnapshot[] };

export async function createMonthlySnapshot(key: string): Promise<SalesSnapshot> {
  // ✅ api.post<T>() renvoie directement T
  return api.post<SalesSnapshot>(
    `/api/snapshots/month`,
    undefined,
    { query: { key } } // ✅ évite de construire l’URL à la main
  );
}

export async function listSnapshots(limit = 50): Promise<ListSnapshotsResponse> {
  // ✅ api.get<T>() renvoie directement T
  return api.get<ListSnapshotsResponse>(`/api/snapshots`, { query: { limit } });
}
