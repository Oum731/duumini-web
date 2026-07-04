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
  all_time: number;
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
  status?: ExpenseStatus;
  receipt_url?: string | null;
};

function normalizeExpense(item: any): Expense {
  return {
    id: Number(item?.id || 0),
    shop_id: item?.shop_id ?? null,
    user_id: item?.user_id ?? null,
    category_id: item?.category_id ?? null,
    category_name: item?.category_name || "",
    category_color: item?.category_color ?? null,
    label: item?.label || "",
    description: item?.description ?? null,
    amount: Number(item?.amount || 0),
    expense_date: item?.expense_date || "",
    payment_method: item?.payment_method ?? null,
    reference: item?.reference ?? null,
    status: (item?.status || "PAID") as ExpenseStatus,
    receipt_url: item?.receipt_url ?? null,
    created_at: item?.created_at ?? null,
    updated_at: item?.updated_at ?? null,
  };
}

export async function listExpenses(params?: Record<string, any>): Promise<ExpensesListResponse> {
  const data = await api.get<ExpensesListResponse>("/api/expenses", { params });

  return {
    items: Array.isArray(data?.items) ? data.items.map(normalizeExpense) : [],
    pageInfo: {
      page: Number(data?.pageInfo?.page || 1),
      pageSize: Number(data?.pageInfo?.pageSize || params?.pageSize || 20),
      total: Number(data?.pageInfo?.total || 0),
      pages: Number(data?.pageInfo?.pages || 1),
    },
  };
}

export async function createExpense(data: SaveExpensePayload): Promise<Expense> {
  const res = await api.post<Expense>("/api/expenses", data);
  return normalizeExpense(res);
}

export async function updateExpense(id: number, data: SaveExpensePayload): Promise<Expense> {
  const res = await api.put<Expense>(`/api/expenses/${id}`, data);
  return normalizeExpense(res);
}

export async function deleteExpense(id: number): Promise<{ ok: true; id: number }> {
  return api.delete<{ ok: true; id: number }>(`/api/expenses/${id}`);
}

export async function getExpensesSummary(
  params?: Record<string, any>
): Promise<ExpensesSummary> {
  const data = await api.get<ExpensesSummary>("/api/expenses/summary", { params });

  return {
    today: Number(data?.today || 0),
    week: Number(data?.week || 0),
    month: Number(data?.month || 0),
    year: Number(data?.year || 0),
    filtered_total: Number(data?.filtered_total || 0),
    all_time: Number(data?.all_time || 0),
  };
}

export async function getGroupedExpenses(
  period: "day" | "week" | "month" | "year",
  params?: Record<string, any>
): Promise<GroupedExpensesResponse> {
  const data = await api.get<GroupedExpensesResponse>("/api/expenses/grouped", {
    params: { period, ...(params || {}) },
  });

  return {
    period: data?.period || period,
    items: Array.isArray(data?.items)
      ? data.items.map((item) => ({
          period: String(item?.period || ""),
          total: Number(item?.total || 0),
          count_items: Number(item?.count_items || 0),
        }))
      : [],
  };
}

export async function getExpensesByCategory(
  params?: Record<string, any>
): Promise<{ items: ExpensesByCategoryItem[] }> {
  const data = await api.get<{ items: ExpensesByCategoryItem[] }>("/api/expenses/by-category", {
    params,
  });

  return {
    items: Array.isArray(data?.items)
      ? data.items.map((item) => ({
          category_id: item?.category_id ?? null,
          category_name: item?.category_name || "",
          total: Number(item?.total || 0),
          count_items: Number(item?.count_items || 0),
          color: item?.color ?? null,
        }))
      : [],
  };
}