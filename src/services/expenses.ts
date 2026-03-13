import { api } from "./http";

export type ExpenseStatus = "PAID" | "PENDING";

export type Expense = {
  id: number;
  shop_id?: number | null;
  user_id?: number | null;
  category_id?: number | null;
  category_name: string;
  category_color?: string | null;
  label: string;
  description?: string | null;
  amount: number;
  expense_date: string;
  payment_method?: string | null;
  reference?: string | null;
  status: ExpenseStatus;
  receipt_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ExpensesListResponse = {
  items: Expense[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
};

export type ExpensesSummary = {
  today: number;
  week: number;
  month: number;
  year: number;
  filtered_total: number;
};

export type GroupedExpenseItem = {
  period: string;
  total: number;
  count_items: number;
};

export type GroupedExpensesResponse = {
  period: "day" | "week" | "month" | "year" | string;
  items: GroupedExpenseItem[];
};

export type ExpensesByCategoryItem = {
  category_id?: number | null;
  category_name: string;
  total: number;
  count_items: number;
  color?: string | null;
};

export type SaveExpensePayload = {
  shop_id?: number | null;
  category_id?: number | null;
  category_name?: string | null;
  label: string;
  description?: string | null;
  amount: number;
  expense_date: string;
  payment_method?: string | null;
  reference?: string | null;
  status?: ExpenseStatus;
  receipt_url?: string | null;
};

export async function listExpenses(params?: Record<string, any>) {
  return api.get<ExpensesListResponse>("/api/expenses", { params });
}

export async function createExpense(data: SaveExpensePayload) {
  return api.post<Expense>("/api/expenses", data);
}

export async function updateExpense(id: number, data: SaveExpensePayload) {
  return api.put<Expense>(`/api/expenses/${id}`, data);
}

export async function deleteExpense(id: number) {
  return api.delete<{ ok: true; id: number }>(`/api/expenses/${id}`);
}

export async function getExpensesSummary(params?: Record<string, any>) {
  return api.get<ExpensesSummary>("/api/expenses/summary", { params });
}

export async function getGroupedExpenses(
  period: "day" | "week" | "month" | "year",
  params?: Record<string, any>
) {
  return api.get<GroupedExpensesResponse>("/api/expenses/grouped", {
    params: { period, ...(params || {}) },
  });
}

export async function getExpensesByCategory(params?: Record<string, any>) {
  return api.get<{ items: ExpensesByCategoryItem[] }>("/api/expenses/by-category", {
    params,
  });
}