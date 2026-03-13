import { api } from "./http";

export type ExpenseCategory = {
  id: number;
  shop_id?: number | null;
  name: string;
  color?: string | null;
  is_active?: number | boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function listExpenseCategories(params?: Record<string, any>) {
  return api.get<{ items: ExpenseCategory[] }>("/api/expense-categories", { params });
}

export async function createExpenseCategory(data: {
  shop_id?: number | null;
  name: string;
  color?: string | null;
}) {
  return api.post<ExpenseCategory>("/api/expense-categories", data);
}