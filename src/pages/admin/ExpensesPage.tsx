import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Plus,
  Trash2,
  Pencil,
  RefreshCcw,
  Wallet,
  Tag,
  CalendarDays,
  CreditCard,
  FileText,
} from "lucide-react";
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
          return `"${raw.replace(/"/g, '""')}"`;
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
  status: ExpenseStatus;
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
    status: "PAID",
  };
}

const PAYMENTS = ["cash", "card", "bank", "mobile_money", "other"];
const STATUS_OPTIONS: ExpenseStatus[] = ["PAID", "PENDING"];

function SectionIcon({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="rounded-2xl bg-[rgba(255,210,74,0.14)] p-3 text-[#d39a00]">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-base-content">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-base-content/65">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function FieldLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-base-content/80">
      {icon}
      <span>{children}</span>
    </label>
  );
}

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
  const [newCategoryColor, setNewCategoryColor] = useState("#f4b400");

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
      const results = await Promise.allSettled([
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

      const [catRes, listRes, summaryRes, groupedRes, byCatRes] = results;

      if (catRes.status === "fulfilled") {
        setCategories(Array.isArray(catRes.value?.items) ? catRes.value.items : []);
      } else {
        setCategories([]);
      }

      if (listRes.status === "fulfilled") {
        setItems(Array.isArray(listRes.value?.items) ? listRes.value.items : []);
        setPageInfo(
          listRes.value?.pageInfo || {
            page,
            pageSize,
            total: 0,
            pages: 1,
          }
        );
      } else {
        setItems([]);
        setPageInfo({
          page: 1,
          pageSize,
          total: 0,
          pages: 1,
        });
        setError(
          listRes.reason?.response?.data?.error ||
            listRes.reason?.message ||
            "Erreur serveur lors du chargement des dépenses."
        );
      }

      if (summaryRes.status === "fulfilled") {
        setSummary({
          today: Number(summaryRes.value?.today || 0),
          week: Number(summaryRes.value?.week || 0),
          month: Number(summaryRes.value?.month || 0),
          year: Number(summaryRes.value?.year || 0),
          filtered_total: Number(summaryRes.value?.filtered_total || 0),
        });
      } else {
        setSummary({
          today: 0,
          week: 0,
          month: 0,
          year: 0,
          filtered_total: 0,
        });
      }

      if (groupedRes.status === "fulfilled") {
        setGrouped(
          Array.isArray(groupedRes.value?.items)
            ? groupedRes.value.items.map((x: any) => ({
                period: x.period,
                total: Number(x.total || 0),
              }))
            : []
        );
      } else {
        setGrouped([]);
      }

      if (byCatRes.status === "fulfilled") {
        setByCategory(Array.isArray(byCatRes.value?.items) ? byCatRes.value.items : []);
      } else {
        setByCategory([]);
      }
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
      setNewCategoryColor("#f4b400");
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
        status: form.status,
      };

      if (editing && form.id) {
        await updateExpense(form.id, payload as any);
      } else {
        await createExpense(payload as any);
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
      payment_method: item.payment_method || "cash",
      status: item.status || "PAID",
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
        <div
          className="overflow-hidden rounded-[28px] border border-black/5 shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, #111111 0%, #1c1c1c 58%, #252525 100%)",
          }}
        >
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-start gap-4">
              <div
                className="rounded-3xl p-3"
                style={{
                  background: "linear-gradient(135deg, #FFD24A 0%, #F4B400 100%)",
                  color: "#111",
                }}
              >
                <Wallet size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Dépenses</h1>
                <p className="mt-1 text-sm text-white/70">
                  Suivi quotidien, hebdomadaire, mensuel et annuel des dépenses.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn border-0 bg-white text-black hover:bg-white/90"
                onClick={() => {
                  setForm(emptyForm());
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Plus size={16} />
                Nouvelle dépense
              </button>

              <button
                type="button"
                className="btn btn-ghost text-white hover:bg-white/10"
                onClick={loadAll}
              >
                <RefreshCcw size={16} />
                Actualiser
              </button>

              <button
                type="button"
                className="btn border-0 text-black"
                style={{
                  background: "linear-gradient(135deg, #FFD24A 0%, #F4B400 100%)",
                }}
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
          <div className="alert border-0 bg-red-50 text-red-700 shadow-sm">
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Aujourd’hui", value: summary.today },
            { label: "Cette semaine", value: summary.week },
            { label: "Ce mois", value: summary.month },
            { label: "Cette année", value: summary.year },
            { label: "Total filtré", value: summary.filtered_total },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
            >
              <div className="text-sm font-medium text-base-content/55">{card.label}</div>
              <div className="mt-2 text-2xl font-bold text-base-content">{mad(card.value)}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
            <SectionIcon
              icon={<FileText size={22} />}
              title={editing ? "Modifier une dépense" : "Ajouter une dépense"}
              subtitle="Enregistre une charge rapidement avec une présentation plus claire et plus professionnelle."
            />

            {editing && (
              <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Modification en cours.
                <button
                  type="button"
                  className="ml-2 font-semibold underline"
                  onClick={() => setForm(emptyForm())}
                >
                  Annuler
                </button>
              </div>
            )}

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="rounded-[22px] border border-black/5 bg-[rgba(255,210,74,0.06)] p-4">
                <FieldLabel icon={<Tag size={16} />}>Catégorie principale</FieldLabel>
                <select
                  className="select select-bordered w-full bg-white"
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
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_110px_auto]">
                  <input
                    className="input input-bordered bg-white"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Créer une nouvelle catégorie"
                  />
                  <input
                    type="color"
                    className="input input-bordered h-12 w-full bg-white p-1"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn border-0 text-black"
                    style={{
                      background: "linear-gradient(135deg, #FFD24A 0%, #F4B400 100%)",
                    }}
                    onClick={handleCreateCategory}
                    disabled={creatingCategory}
                  >
                    {creatingCategory ? "Ajout..." : "Ajouter"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <FieldLabel icon={<FileText size={16} />}>Libellé</FieldLabel>
                  <input
                    className="input input-bordered w-full bg-white"
                    value={form.label}
                    onChange={(e) => setFormField("label", e.target.value)}
                    required
                    placeholder="Ex: Achat sachets d’emballage"
                  />
                </div>

                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    className="textarea textarea-bordered w-full bg-white"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setFormField("description", e.target.value)}
                    placeholder="Détail complémentaire sur la dépense..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel icon={<Wallet size={16} />}>Montant</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input input-bordered w-full bg-white"
                    value={form.amount}
                    onChange={(e) => setFormField("amount", e.target.value)}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <FieldLabel icon={<CalendarDays size={16} />}>Date</FieldLabel>
                  <input
                    type="date"
                    className="input input-bordered w-full bg-white"
                    value={form.expense_date}
                    onChange={(e) => setFormField("expense_date", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel icon={<CreditCard size={16} />}>Mode de paiement</FieldLabel>
                  <select
                    className="select select-bordered w-full bg-white"
                    value={form.payment_method}
                    onChange={(e) => setFormField("payment_method", e.target.value)}
                  >
                    {PAYMENTS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Statut</FieldLabel>
                  <select
                    className="select select-bordered w-full bg-white"
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

              <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-base-content/65">
                La référence est générée automatiquement par le système lors de l’enregistrement.
              </div>

              <button
                type="submit"
                className="btn border-0 text-black"
                style={{
                  background: "linear-gradient(135deg, #FFD24A 0%, #F4B400 100%)",
                }}
                disabled={saving}
              >
                {saving ? "Enregistrement..." : editing ? "Mettre à jour" : "Ajouter la dépense"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
              <SectionIcon
                icon={<Tag size={22} />}
                title="Filtres"
                subtitle="Affiche rapidement les dépenses par période, catégorie, statut et mode de paiement."
              />

              <div className="mb-4 flex justify-end">
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <FieldLabel>Du</FieldLabel>
                  <input
                    type="date"
                    className="input input-bordered w-full bg-white"
                    value={filters.from}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, from: e.target.value }));
                      setPage(1);
                    }}
                  />
                </div>

                <div>
                  <FieldLabel>Au</FieldLabel>
                  <input
                    type="date"
                    className="input input-bordered w-full bg-white"
                    value={filters.to}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, to: e.target.value }));
                      setPage(1);
                    }}
                  />
                </div>

                <div>
                  <FieldLabel>Catégorie</FieldLabel>
                  <select
                    className="select select-bordered w-full bg-white"
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
                  <FieldLabel>Statut</FieldLabel>
                  <select
                    className="select select-bordered w-full bg-white"
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
                  <FieldLabel>Paiement</FieldLabel>
                  <select
                    className="select select-bordered w-full bg-white"
                    value={filters.payment_method}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, payment_method: e.target.value }));
                      setPage(1);
                    }}
                  >
                    <option value="">Tous</option>
                    {PAYMENTS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Recherche</FieldLabel>
                  <input
                    className="input input-bordered w-full bg-white"
                    value={filters.q}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, q: e.target.value }));
                      setPage(1);
                    }}
                    placeholder="libellé, référence..."
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Évolution des dépenses</h2>
                  <select
                    className="select select-bordered select-sm bg-white"
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
                      <Bar dataKey="total" radius={[10, 10, 0, 0]} fill="#f4b400" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-bold">Répartition par catégorie</h2>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={95} label>
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || "#f4b400"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => mad(Number(v || 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {byCategory.map((x, idx) => (
                    <div
                      key={`${x.category_name}-${idx}`}
                      className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2 text-sm"
                    >
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

            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-bold">Liste des dépenses</h2>
                <div className="text-sm text-base-content/70">
                  Total visible: <strong>{mad(totalVisible)}</strong> — Total filtré:{" "}
                  <strong>{mad(summary.filtered_total)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-black/5">
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
                            <span
                              className={`badge ${
                                item.status === "PAID" ? "badge-success" : "badge-warning"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td>{item.reference || "—"}</td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => handleEdit(item)}
                              >
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
                    className="select select-bordered select-sm bg-white"
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