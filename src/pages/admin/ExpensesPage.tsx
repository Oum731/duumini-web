import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingState } from "../../components/ui/Spinner";
import {
  PageHeader,
  SectionCard,
  KpiSparkCard,
  DonutStat,
  type DonutSegment,
} from "../../components/admin/adminUI";
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
  Search,
  X,
  Layers3,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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
import { getOrdersSummary } from "../../services/orders";

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
  return (
    e?.payload?.error ||
    e?.payload?.message ||
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Erreur"
  );
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

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function paymentLabel(v?: string | null) {
  const x = String(v || "").toLowerCase();
  if (x === "cash") return "Espèces";
  if (x === "card") return "Carte";
  if (x === "bank") return "Banque";
  if (x === "mobile_money") return "Mobile Money";
  if (x === "other") return "Autre";
  return v || "—";
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
const DONUT_COLORS = ["var(--duu-orange)", "var(--duu-green)", "#7C5CFC", "#2F6FED", "#E53935", "#F5A623"];

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
    all_time: 0,
  });

  // ✅ CA (ventes DONE) sur les mêmes bornes de période que les dépenses
  // (CURDATE()/YEARWEEK(...,1) côté backend, voir GET /api/orders/summary)
  // pour un solde net cohérent.
  const [revenue, setRevenue] = useState({ today: 0, week: 0, month: 0, year: 0, all_time: 0 });

  const [form, setForm] = useState<FormState>(emptyForm());
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#F5821F");

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
      const [catRes, listRes, summaryRes, groupedRes, byCatRes, revenueRes] = await Promise.all([
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
        getOrdersSummary().catch(() => null),
      ]);

      setCategories(Array.isArray(catRes) ? catRes : (catRes as any)?.items || []);
      setItems(Array.isArray(listRes?.items) ? listRes.items : []);
      setPageInfo({
        page: Number(listRes?.pageInfo?.page || page),
        pageSize: Number(listRes?.pageInfo?.pageSize || pageSize),
        total: Number(listRes?.pageInfo?.total || 0),
        pages: Number(listRes?.pageInfo?.pages || 1),
      });
      setSummary({
        today: Number(summaryRes?.today || 0),
        week: Number(summaryRes?.week || 0),
        month: Number(summaryRes?.month || 0),
        year: Number(summaryRes?.year || 0),
        filtered_total: Number(summaryRes?.filtered_total || 0),
        all_time: Number(summaryRes?.all_time || 0),
      });
      setGrouped(
        Array.isArray(groupedRes?.items)
          ? groupedRes.items.map((x: any) => ({
              period: String(x?.period || "—"),
              total: Number(x?.total || 0),
            }))
          : []
      );
      setByCategory(Array.isArray(byCatRes?.items) ? byCatRes.items : []);
      setRevenue({
        today: Number(revenueRes?.today || 0),
        week: Number(revenueRes?.week || 0),
        month: Number(revenueRes?.month || 0),
        year: Number(revenueRes?.year || 0),
        all_time: Number(revenueRes?.all_time || 0),
      });
    } catch (e: any) {
      setItems([]);
      setGrouped([]);
      setByCategory([]);
      setSummary({
        today: 0,
        week: 0,
        month: 0,
        year: 0,
        filtered_total: 0,
        all_time: 0,
      });
      setRevenue({ today: 0, week: 0, month: 0, year: 0, all_time: 0 });
      setPageInfo({
        page: 1,
        pageSize,
        total: 0,
        pages: 1,
      });
      setError(safeErrorMessage(e));
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

  function resetForm() {
    setForm(emptyForm());
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

      const createdObj = (created as any)?.data || created;
      const nextCats = [...categories, createdObj].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );

      setCategories(nextCats);
      setForm((prev) => ({
        ...prev,
        category_id: createdObj.id,
        category_name: createdObj.name,
      }));
      setNewCategory("");
      setNewCategoryColor("#F5821F");
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

      if (!payload.label) throw new Error("Le libellé est obligatoire.");
      if (!payload.category_id && !payload.category_name) {
        throw new Error("La catégorie est obligatoire.");
      }

      if (editing && form.id) {
        await updateExpense(form.id, payload as any);
      } else {
        await createExpense(payload as any);
      }

      resetForm();
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
      status: (item.status || "PAID") as ExpenseStatus,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Voulez-vous vraiment annuler/supprimer cette dépense ?")) return;

    setDeletingId(id);
    setError("");
    try {
      await deleteExpense(id);
      if (form.id === id) resetForm();
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

  // ✅ Solde net = CA (ventes DONE, hors livraison) − dépenses, par période —
  // "ce qui reste vraiment dans la caisse".
  const netBalance = useMemo(
    () => ({
      today: revenue.today - summary.today,
      week: revenue.week - summary.week,
      month: revenue.month - summary.month,
      year: revenue.year - summary.year,
      all_time: revenue.all_time - summary.all_time,
    }),
    [revenue, summary]
  );

  const donutSegments = useMemo<DonutSegment[]>(
    () =>
      byCategory
        .filter((x) => Number(x.total || 0) > 0)
        .map((x, idx) => ({
          label: x.category_name || "Sans catégorie",
          value: Number(x.total || 0),
          color: x.color || DONUT_COLORS[idx % DONUT_COLORS.length],
        })),
    [byCategory]
  );

  const balanceColor = (v: number) => (v >= 0 ? "var(--duu-green)" : "var(--duu-red)");

  function resetFilters() {
    setFilters({ from: "", to: "", category_id: "", status: "", payment_method: "", q: "" });
    setPage(1);
  }

  return (
    <div className="container-xxl py-0 px-2 px-sm-3">
      <PageHeader
        title="Gestion des dépenses"
        subtitle="Suivi, consultation, modification et annulation des dépenses avec tableau, filtres et statistiques."
        right={
          <>
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() => {
                resetForm();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Plus size={16} className="me-1" />
              Nouvelle dépense
            </button>
            <button type="button" className="btn btn-outline-dark" onClick={loadAll}>
              <RefreshCcw size={16} className="me-1" />
              Actualiser
            </button>
            <button
              type="button"
              className="btn btn-duu-orange"
              onClick={() =>
                exportCsv(
                  `depenses_${new Date().toISOString().slice(0, 10)}.csv`,
                  items.map((x) => ({
                    date: x.expense_date,
                    categorie: x.category_name,
                    libelle: x.label,
                    description: x.description || "",
                    montant: x.amount,
                    paiement: paymentLabel(x.payment_method),
                    statut: x.status,
                    reference: x.reference || "",
                  }))
                )
              }
            >
              <Download size={16} className="me-1" />
              Export CSV
            </button>
          </>
        }
      />

      {!!error && <div className="alert alert-danger">{error}</div>}

      <div className="mb-3">
        <div className="text-muted small mb-2">
          Vue globale (depuis le début) — indépendant des filtres
        </div>
        <div className="row g-2 g-sm-3">
          <div className="col-6 col-md-3">
            <KpiSparkCard
              icon={Wallet}
              accent="orange"
              label="Total dépenses (global)"
              value={mad(summary.all_time)}
            />
          </div>
          <div className="col-6 col-md-3">
            <KpiSparkCard
              icon={BadgePercent}
              accent={netBalance.all_time >= 0 ? "green" : "orange"}
              label="Solde net (global)"
              value={mad(netBalance.all_time)}
              valueColor={balanceColor(netBalance.all_time)}
            />
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-muted small mb-2">Dépenses par période</div>
        <div className="row g-2 g-sm-3">
          <div className="col-6 col-md-4 col-xl">
            <KpiSparkCard icon={Wallet} accent="orange" label="Aujourd'hui" value={mad(summary.today)} />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <KpiSparkCard icon={Wallet} accent="orange" label="Cette semaine" value={mad(summary.week)} />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <KpiSparkCard icon={Wallet} accent="orange" label="Ce mois" value={mad(summary.month)} />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <KpiSparkCard icon={Wallet} accent="orange" label="Cette année" value={mad(summary.year)} />
          </div>
          <div className="col-6 col-md-4 col-xl">
            <KpiSparkCard
              icon={Wallet}
              accent="neutral"
              label="Total filtré"
              value={mad(summary.filtered_total)}
            />
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-muted small mb-2">
          Solde net (chiffre d’affaires − dépenses) — ce qui reste dans la caisse
        </div>
        <div className="row g-2 g-sm-3">
          <div className="col-6 col-md-3">
            <KpiSparkCard
              icon={BadgePercent}
              accent={netBalance.today >= 0 ? "green" : "orange"}
              label="Aujourd'hui"
              value={mad(netBalance.today)}
              valueColor={balanceColor(netBalance.today)}
            />
          </div>
          <div className="col-6 col-md-3">
            <KpiSparkCard
              icon={BadgePercent}
              accent={netBalance.week >= 0 ? "green" : "orange"}
              label="Cette semaine"
              value={mad(netBalance.week)}
              valueColor={balanceColor(netBalance.week)}
            />
          </div>
          <div className="col-6 col-md-3">
            <KpiSparkCard
              icon={BadgePercent}
              accent={netBalance.month >= 0 ? "green" : "orange"}
              label="Ce mois"
              value={mad(netBalance.month)}
              valueColor={balanceColor(netBalance.month)}
            />
          </div>
          <div className="col-6 col-md-3">
            <KpiSparkCard
              icon={BadgePercent}
              accent={netBalance.year >= 0 ? "green" : "orange"}
              label="Cette année"
              value={mad(netBalance.year)}
              valueColor={balanceColor(netBalance.year)}
            />
          </div>
        </div>
      </div>

      <div className="row g-2 g-sm-3">
        <div className="col-12 col-xl-5">
          <SectionCard
            icon={FileText}
            title={editing ? "Modifier une dépense" : "Ajouter une dépense"}
            subtitle="Formulaire propre et rapide pour créer ou mettre à jour une dépense."
            className="mb-3"
          >
            {editing && (
              <div className="alert alert-warning d-flex align-items-center justify-content-between py-2 mb-3">
                <span>Modification en cours.</span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-underline p-0"
                  onClick={resetForm}
                >
                  <X size={14} className="me-1" />
                  Annuler
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3 p-3" style={{ borderRadius: "var(--duu-radius-md)", background: "rgba(var(--duu-yellow-rgb), .08)" }}>
                <label className="form-label fw-semibold d-flex align-items-center gap-2">
                  <Tag size={16} />
                  Catégorie principale
                </label>
                <select
                  className="form-select"
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

                <div className="row g-2 mt-1">
                  <div className="col-7">
                    <input
                      className="form-control"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Créer une nouvelle catégorie"
                    />
                  </div>
                  <div className="col-3">
                    <input
                      type="color"
                      className="form-control form-control-color w-100"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                    />
                  </div>
                  <div className="col-2 d-grid">
                    <button
                      type="button"
                      className="btn btn-duu-orange"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory}
                    >
                      {creatingCategory ? "…" : "OK"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold d-flex align-items-center gap-2">
                  <FileText size={16} />
                  Libellé
                </label>
                <input
                  className="form-control"
                  value={form.label}
                  onChange={(e) => setFormField("label", e.target.value)}
                  required
                  placeholder="Ex: Achat emballages"
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setFormField("description", e.target.value)}
                  placeholder="Détail complémentaire sur la dépense..."
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-semibold d-flex align-items-center gap-2">
                    <Wallet size={16} />
                    Montant
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={form.amount}
                    onChange={(e) => setFormField("amount", e.target.value)}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="col-6">
                  <label className="form-label fw-semibold d-flex align-items-center gap-2">
                    <CalendarDays size={16} />
                    Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.expense_date}
                    onChange={(e) => setFormField("expense_date", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-semibold d-flex align-items-center gap-2">
                    <CreditCard size={16} />
                    Mode de paiement
                  </label>
                  <select
                    className="form-select"
                    value={form.payment_method}
                    onChange={(e) => setFormField("payment_method", e.target.value)}
                  >
                    {PAYMENTS.map((x) => (
                      <option key={x} value={x}>
                        {paymentLabel(x)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label fw-semibold">Statut</label>
                  <select
                    className="form-select"
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

              <div className="text-muted small mb-3">
                La référence est générée automatiquement par le système.
              </div>

              <div className="d-flex flex-column flex-sm-row gap-2">
                <button type="submit" className="btn btn-duu-orange flex-fill" disabled={saving}>
                  {saving ? "Enregistrement…" : editing ? "Mettre à jour la dépense" : "Ajouter la dépense"}
                </button>
                {editing && (
                  <button type="button" className="btn btn-outline-dark" onClick={resetForm}>
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </SectionCard>

          <SectionCard
            icon={Layers3}
            title="Répartition par catégorie"
            subtitle="Vue rapide des catégories qui consomment le plus."
          >
            {donutSegments.length === 0 ? (
              <div className="text-muted small">Aucune donnée disponible.</div>
            ) : (
              <>
                <DonutStat
                  centerLabel="Total dépenses"
                  centerValue={mad(donutSegments.reduce((s, x) => s + x.value, 0))}
                  segments={donutSegments}
                />
                <div className="d-flex flex-column gap-2 mt-3">
                  {byCategory.map((x, idx) => (
                    <div
                      key={`${x.category_name}-${idx}`}
                      className="d-flex align-items-center justify-content-between px-3 py-2"
                      style={{ borderRadius: "var(--duu-radius-md)", background: "rgba(17,17,17,.04)" }}
                    >
                      <div className="d-flex align-items-center gap-2 small">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: x.color || DONUT_COLORS[idx % DONUT_COLORS.length],
                            display: "inline-block",
                          }}
                        />
                        <span>{x.category_name || "Sans catégorie"}</span>
                      </div>
                      <strong className="small">{mad(x.total)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <div className="col-12 col-xl-7">
          <SectionCard
            icon={Tag}
            title="Filtres"
            subtitle="Recherche rapide par période, catégorie, statut et mode de paiement."
            right={
              <button type="button" className="btn btn-sm btn-outline-dark" onClick={resetFilters}>
                Réinitialiser
              </button>
            }
            className="mb-3"
          >
            <div className="row g-3">
              <div className="col-6 col-md-4">
                <label className="form-label small">Du</label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.from}
                  onChange={(e) => {
                    setFilters((p) => ({ ...p, from: e.target.value }));
                    setPage(1);
                  }}
                />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small">Au</label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.to}
                  onChange={(e) => {
                    setFilters((p) => ({ ...p, to: e.target.value }));
                    setPage(1);
                  }}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small">Catégorie</label>
                <select
                  className="form-select"
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
              <div className="col-6 col-md-4">
                <label className="form-label small">Statut</label>
                <select
                  className="form-select"
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
              <div className="col-6 col-md-4">
                <label className="form-label small">Paiement</label>
                <select
                  className="form-select"
                  value={filters.payment_method}
                  onChange={(e) => {
                    setFilters((p) => ({ ...p, payment_method: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Tous</option>
                  {PAYMENTS.map((x) => (
                    <option key={x} value={x}>
                      {paymentLabel(x)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small d-flex align-items-center gap-1">
                  <Search size={14} />
                  Recherche
                </label>
                <input
                  className="form-control"
                  value={filters.q}
                  onChange={(e) => {
                    setFilters((p) => ({ ...p, q: e.target.value }));
                    setPage(1);
                  }}
                  placeholder="Libellé, référence, description..."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Évolution des dépenses"
            subtitle="Suivi graphique selon la période choisie."
            right={
              <select
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as any)}
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            }
            className="mb-3"
          >
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grouped}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => mad(Number(v || 0))} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="var(--duu-orange)" maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="Tableau des dépenses"
            subtitle={`Total visible : ${mad(totalVisible)} — Total filtré : ${mad(summary.filtered_total)}`}
          >
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Libellé</th>
                    <th className="d-none d-lg-table-cell">Description</th>
                    <th className="text-end">Montant</th>
                    <th className="d-none d-md-table-cell">Paiement</th>
                    <th>Statut</th>
                    <th className="d-none d-lg-table-cell">Référence</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={9} className="text-center py-4">
                        <LoadingState label="Chargement des dépenses…" size="sm" />
                      </td>
                    </tr>
                  )}

                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        Aucune dépense trouvée.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(item.expense_date)}</td>

                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: item.category_color || "#94a3b8",
                                display: "inline-block",
                                flexShrink: 0,
                              }}
                            />
                            <span className="text-truncate">{item.category_name || "—"}</span>
                          </div>
                        </td>

                        <td className="text-truncate" style={{ maxWidth: 180 }}>
                          <span className="fw-semibold">{item.label || "—"}</span>
                        </td>

                        <td className="d-none d-lg-table-cell text-truncate text-muted small" style={{ maxWidth: 240 }}>
                          {item.description || "—"}
                        </td>

                        <td className="text-end fw-semibold" style={{ whiteSpace: "nowrap" }}>
                          {mad(item.amount)}
                        </td>

                        <td className="d-none d-md-table-cell" style={{ whiteSpace: "nowrap" }}>
                          {paymentLabel(item.payment_method)}
                        </td>

                        <td>
                          <span className={`badge ${item.status === "PAID" ? "bg-success" : "bg-warning text-dark"}`}>
                            {item.status}
                          </span>
                        </td>

                        <td className="d-none d-lg-table-cell text-muted small" style={{ whiteSpace: "nowrap" }}>
                          {item.reference || "—"}
                        </td>

                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark"
                              onClick={() => handleEdit(item)}
                              title="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={deletingId === item.id}
                              onClick={() => handleDelete(item.id)}
                              title="Annuler / supprimer"
                            >
                              {deletingId === item.id ? "…" : <Trash2 size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mt-3">
              <div className="text-muted small">
                Page {pageInfo.page} / {Math.max(1, pageInfo.pages)} — {pageInfo.total} élément(s)
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
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
                  className="btn btn-sm btn-outline-dark"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ArrowLeft size={14} className="me-1" />
                  Précédent
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark"
                  disabled={page >= pageInfo.pages}
                  onClick={() => setPage((p) => Math.min(pageInfo.pages, p + 1))}
                >
                  Suivant
                  <ArrowRight size={14} className="ms-1" />
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
