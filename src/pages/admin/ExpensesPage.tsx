import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Pencil, RefreshCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  createExpense,
  deleteExpense,
  getExpensesByCategory,
  getExpensesSummary,
  getGroupedExpenses,
  listExpenses,
  updateExpense,
  type Expense,
  type ExpenseStatus,
  type ExpensesByCategoryItem,
} from "../../services/expenses";
import {
  createExpenseCategory,
  listExpenseCategories,
  type ExpenseCategory,
} from "../../services/expenseCategories";

function mad(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  if (String(v).length <= 10) return d.toLocaleDateString("fr-FR");
  return d.toLocaleString("fr-FR");
}

function toInputDate(v?: string | null) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeErrorMessage(e: any) {
  return e?.response?.data?.error || e?.message || "Erreur";
}

function exportCsv(filename: string, rows: Array<Record<string, any>>) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const raw = row[h] == null ? "" : String(row[h]);
          return `"${raw.replace(/"/g, '""')}"`
        })
        .join(";")
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

type FormState = {
  id?: number | null;
  category_id?: number | null;
  category_name: string;
  label: string;
  description: string;
  amount: string;
  expense_date: string;
  payment_method: string;
  reference: string;
  status: ExpenseStatus;
  receipt_url: string;
};

function emptyForm(): FormState {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return {
    id: null,
    category_id: null,
    category_name: "",
    label: "",
    description: "",
    amount: "",
    expense_date: `${yyyy}-${mm}-${dd}`,
    payment_method: "cash",
    reference: "",
    status: "PAID",
    receipt_url: "",
  };
}

const PAYMENTS = ["", "cash", "card", "bank", "mobile_money", "other"];
const STATUS_OPTIONS: ExpenseStatus[] = ["PAID", "PENDING"];

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [byCategory, setByCategory] = useState<ExpensesByCategoryItem[]>([]);
  const [grouped, setGrouped] = useState<Array<{ period: string; total: number }>>([]);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month" | "year">("month");

  const [summary, setSummary] = useState({
    today: 0,
    week: 0,
    month: 0,
    year: 0,
    filtered_total: 0,
  });

  const [form, setForm] = useState<FormState>(emptyForm());
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#2563eb");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    pages: 1,
  });

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    category_id: "",
    status: "",
    payment_method: "",
    q: "",
  });

  const editing = !!form.id;

  const params = useMemo(
    () => ({
      page,
      pageSize,
      from: filters.from || undefined,
      to: filters.to || undefined,
      category_id: filters.category_id || undefined,
      status: filters.status || undefined,
      payment_method: filters.payment_method || undefined,
      q: filters.q || undefined,
    }),
    [page, pageSize, filters]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [catRes, listRes, summaryRes, groupedRes, byCatRes] = await Promise.all([
        listExpenseCategories(),
        listExpenses(params),
        getExpensesSummary({
          from: filters.from || undefined,
          to: filters.to || undefined,
          category_id: filters.category_id || undefined,
          status: filters.status || undefined,
          payment_method: filters.payment_method || undefined,
          q: filters.q || undefined,
        }),
        getGroupedExpenses(chartPeriod, {
          from: filters.from || undefined,
          to: filters.to || undefined,
          category_id: filters.category_id || undefined,
          status: filters.status || undefined,
          payment_method: filters.payment_method || undefined,
          q: filters.q || undefined,
        }),
        getExpensesByCategory({
          from: filters.from || undefined,
          to: filters.to || undefined,
          category_id: filters.category_id || undefined,
          status: filters.status || undefined,
          payment_method: filters.payment_method || undefined,
          q: filters.q || undefined,
        }),
      ]);

      setCategories(Array.isArray(catRes?.items) ? catRes.items : []);
      setItems(Array.isArray(listRes?.items) ? listRes.items : []);
      setPageInfo(
        listRes?.pageInfo || {
          page,
          pageSize,
          total: 0,
          pages: 1,
        }
      );
      setSummary({
        today: Number(summaryRes?.today || 0),
        week: Number(summaryRes?.week || 0),
        month: Number(summaryRes?.month || 0),
        year: Number(summaryRes?.year || 0),
        filtered_total: Number(summaryRes?.filtered_total || 0),
      });
      setGrouped(
        Array.isArray(groupedRes?.items)
          ? groupedRes.items.map((x) => ({
              period: x.period,
              total: Number(x.total || 0),
            }))
          : []
      );
      setByCategory(Array.isArray(byCatRes?.items) ? byCatRes.items : []);
    } catch (e: any) {
      setError(safeErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [params, filters, chartPeriod, page, pageSize]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function setFormField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateCategory() {
    if (!newCategory.trim()) return;

    setCreatingCategory(true);
    setError("");
    try {
      const created = await createExpenseCategory({
        name: newCategory.trim(),
        color: newCategoryColor || null,
      });

      const nextCats = [...categories, created].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(nextCats);
      setForm((prev) => ({
        ...prev,
        category_id: created.id,
        category_name: created.name,
      }));
      setNewCategory("");
      setNewCategoryColor("#2563eb");
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        category_id: form.category_id || null,
        category_name: form.category_name.trim() || null,
        label: form.label.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount || 0),
        expense_date: form.expense_date,
        payment_method: form.payment_method || null,
        reference: form.reference.trim() || null,
        status: form.status,
        receipt_url: form.receipt_url.trim() || null,
      };

      if (editing && form.id) {
        await updateExpense(form.id, payload);
      } else {
        await createExpense(payload);
      }

      setForm(emptyForm());
      setPage(1);
      await loadAll();
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item: Expense) {
    setForm({
      id: item.id,
      category_id: item.category_id ?? null,
      category_name: item.category_name || "",
      label: item.label || "",
      description: item.description || "",
      amount: String(Number(item.amount || 0)),
      expense_date: toInputDate(item.expense_date),
      payment_method: item.payment_method || "",
      reference: item.reference || "",
      status: item.status || "PAID",
      receipt_url: item.receipt_url || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer cette dépense ?")) return;

    setDeletingId(id);
    setError("");
    try {
      await deleteExpense(id);
      if (form.id === id) setForm(emptyForm());
      await loadAll();
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }

  const totalVisible = useMemo(
    () => items.reduce((acc, x) => acc + Number(x.amount || 0), 0),
    [items]
  );

  const pieData = useMemo(
    () =>
      byCategory.map((x) => ({
        name: x.category_name,
        value: Number(x.total || 0),
        color: x.color || undefined,
      })),
    [byCategory]
  );

  return (
    <div className="min-h-screen bg-base-100 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-base-content">Dépenses</h1>
              <p className="mt-1 text-sm text-base-content/70">
                Suivi quotidien, hebdomadaire, mensuel et annuel des dépenses.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setForm(emptyForm());
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Plus size={16} />
                Nouvelle dépense
              </button>

              <button type="button" className="btn btn-ghost" onClick={loadAll}>
                <RefreshCcw size={16} />
                Actualiser
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  exportCsv(
                    `depenses_${new Date().toISOString().slice(0, 10)}.csv`,
                    items.map((x) => ({
                      date: x.expense_date,
                      categorie: x.category_name,
                      libelle: x.label,
                      description: x.description || "",
                      montant: x.amount,
                      paiement: x.payment_method || "",
                      statut: x.status,
                      reference: x.reference || "",
                    }))
                  )
                }
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {!!error && (
          <div className="alert alert-error shadow-sm">
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm text-base-content/60">Aujourd’hui</div>
            <div className="mt-2 text-2xl font-bold">{mad(summary.today)}</div>
          </div>
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm text-base-content/60">Cette semaine</div>
            <div className="mt-2 text-2xl font-bold">{mad(summary.week)}</div>
          </div>
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm text-base-content/60">Ce mois</div>
            <div className="mt-2 text-2xl font-bold">{mad(summary.month)}</div>
          </div>
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm text-base-content/60">Cette année</div>
            <div className="mt-2 text-2xl font-bold">{mad(summary.year)}</div>
          </div>
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm text-base-content/60">Total filtré</div>
            <div className="mt-2 text-2xl font-bold">{mad(summary.filtered_total)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editing ? "Modifier la dépense" : "Ajouter une dépense"}
              </h2>
              {editing && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm(emptyForm())}>
                  Annuler
                </button>
              )}
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium">Catégorie</label>
                <select
                  className="select select-bordered w-full"
                  value={form.category_id || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value || 0);
                    const cat = categories.find((c) => c.id === id);
                    setForm((prev) => ({
                      ...prev,
                      category_id: id || null,
                      category_name: cat?.name || "",
                    }));
                  }}
                >
                  <option value="">Sélectionner</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-dashed border-base-300 p-3">
                <div className="mb-2 text-sm font-medium">Créer une nouvelle catégorie</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_100px_auto]">
                  <input
                    className="input input-bordered"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ex: Fournitures"
                  />
                  <input
                    type="color"
                    className="input input-bordered h-12 w-full p-1"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                  />
                  <button
                    type="button"
                    className={`btn btn-outline ${creatingCategory ? "btn-disabled" : ""}`}
                    onClick={handleCreateCategory}
                    disabled={creatingCategory}
                  >
                    {creatingCategory ? "..." : "Ajouter"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Libellé</label>
                <input
                  className="input input-bordered w-full"
                  value={form.label}
                  onChange={(e) => setFormField("label", e.target.value)}
                  required
                  placeholder="Ex: Achat sachets"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setFormField("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Montant</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input input-bordered w-full"
                    value={form.amount}
                    onChange={(e) => setFormField("amount", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Date</label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={form.expense_date}
                    onChange={(e) => setFormField("expense_date", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Paiement</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.payment_method}
                    onChange={(e) => setFormField("payment_method", e.target.value)}
                  >
                    {PAYMENTS.map((x) => (
                      <option key={x} value={x}>
                        {x || "—"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Statut</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.status}
                    onChange={(e) => setFormField("status", e.target.value as ExpenseStatus)}
                  >
                    {STATUS_OPTIONS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Référence</label>
                <input
                  className="input input-bordered w-full"
                  value={form.reference}
                  onChange={(e) => setFormField("reference", e.target.value)}
                  placeholder="Ex: DEP-001"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Justificatif URL</label>
                <input
                  className="input input-bordered w-full"
                  value={form.receipt_url}
                  onChange={(e) => setFormField("receipt_url", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Enregistrement..." : editing ? "Mettre à jour" : "Ajouter la dépense"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Filtres</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setFilters({
                        from: "",
                        to: "",
                        category_id: "",
                        status: "",
                        payment_method: "",
                        q: "",
                      });
                      setPage(1);
                    }}
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Du</label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={filters.from}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, from: e.target.value }));
                      setPage(1);
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Au</label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={filters.to}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, to: e.target.value }));
                      setPage(1);
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Catégorie</label>
                  <select
                    className="select select-bordered w-full"
                    value={filters.category_id}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, category_id: e.target.value }));
                      setPage(1);
                    }}
                  >
                    <option value="">Toutes</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Statut</label>
                  <select
                    className="select select-bordered w-full"
                    value={filters.status}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, status: e.target.value }));
                      setPage(1);
                    }}
                  >
                    <option value="">Tous</option>
                    {STATUS_OPTIONS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Paiement</label>
                  <select
                    className="select select-bordered w-full"
                    value={filters.payment_method}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, payment_method: e.target.value }));
                      setPage(1);
                    }}
                  >
                    {PAYMENTS.map((x) => (
                      <option key={x} value={x}>
                        {x || "Tous"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Recherche</label>
                  <input
                    className="input input-bordered w-full"
                    value={filters.q}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, q: e.target.value }));
                      setPage(1);
                    }}
                    placeholder="libellé, réf..."
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Évolution des dépenses</h2>
                  <select
                    className="select select-bordered select-sm"
                    value={chartPeriod}
                    onChange={(e) => setChartPeriod(e.target.value as any)}
                  >
                    <option value="day">Jour</option>
                    <option value="week">Semaine</option>
                    <option value="month">Mois</option>
                    <option value="year">Année</option>
                  </select>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grouped}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(v: any) => mad(Number(v || 0))} />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-bold">Répartition par catégorie</h2>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={95} label>
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || undefined} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => mad(Number(v || 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {byCategory.map((x, idx) => (
                    <div key={`${x.category_name}-${idx}`} className="flex items-center justify-between rounded-2xl bg-base-200 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: x.color || "#94a3b8" }}
                        />
                        <span>{x.category_name}</span>
                      </div>
                      <strong>{mad(x.total)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-bold">Liste des dépenses</h2>
                <div className="text-sm text-base-content/70">
                  Total visible: <strong>{mad(totalVisible)}</strong> — Total filtré:{" "}
                  <strong>{mad(summary.filtered_total)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-base-300">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Catégorie</th>
                      <th>Libellé</th>
                      <th>Montant</th>
                      <th>Paiement</th>
                      <th>Statut</th>
                      <th>Référence</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={8} className="text-center">
                          Chargement...
                        </td>
                      </tr>
                    )}

                    {!loading && items.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-base-content/60">
                          Aucune dépense trouvée.
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      items.map((item) => (
                        <tr key={item.id}>
                          <td>{fmtDate(item.expense_date)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-3 w-3 rounded-full"
                                style={{ backgroundColor: item.category_color || "#94a3b8" }}
                              />
                              <span>{item.category_name || "—"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="font-medium">{item.label}</div>
                            {item.description ? (
                              <div className="max-w-xs truncate text-xs text-base-content/60">
                                {item.description}
                              </div>
                            ) : null}
                          </td>
                          <td className="font-semibold">{mad(item.amount)}</td>
                          <td>{item.payment_method || "—"}</td>
                          <td>
                            <span className={`badge ${item.status === "PAID" ? "badge-success" : "badge-warning"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.reference || "—"}</td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <button type="button" className="btn btn-sm btn-outline" onClick={() => handleEdit(item)}>
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-error btn-outline"
                                disabled={deletingId === item.id}
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-base-content/70">
                  Page {pageInfo.page} / {Math.max(1, pageInfo.pages)} — {pageInfo.total} élément(s)
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="select select-bordered select-sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value || 20));
                      setPage(1);
                    }}
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page >= pageInfo.pages}
                    onClick={() => setPage((p) => Math.min(pageInfo.pages, p + 1))}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}