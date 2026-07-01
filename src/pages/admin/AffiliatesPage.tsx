import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createAffiliate,
  getAffiliate,
  getAffiliateDashboard,
  getAffiliateProductPublicUrlByCode,
  getAffiliateProductTrackingUrlByCode,
  getAffiliatePublicUrlByCode,
  getAffiliatePublicUrlBySlug,
  getAffiliateRevenueHistory,
  getAffiliatesRevenueHistory,
  getAffiliatesRevenueSummary,
  listAffiliateClicks,
  listAffiliateCommissions,
  listAffiliates,
  rebuildAffiliateReports,
  updateAffiliate,
  updateAffiliateCommissionStatus,
  updateAffiliateStatus,
  type RevenuePeriod,
  type AffiliateRevenueHistoryRow,
  type AffiliateDashboardResponse,
  type AffiliateRevenueSummaryResponse,
  getAffiliateTrackingUrlByCode,
} from "../../services/affiliates";
import { api } from "../../services/http";
import type {
  AffiliateStatus,
  CommissionStatus,
  UserOption,
  Affiliate,
  AffiliateCommission,
  AffiliateClick,
  AffiliateFormData,
} from "./affiliates/types";
import {
  DUU,
  type PageInfo,
  defaultPageInfo,
  type ProductOption,
  buildPublicProductPath,
} from "./affiliates/shared";
import {
  slugify,
  normalizeAffiliateCodeLocal,
  buildAffiliateCodeFromName,
  buildAffiliateSlugFromName,
  safeUserLabel,
  snapshotValue,
  searchUsersCandidates,
} from "./affiliates/helpers";
import { HelpBlock } from "./affiliates/sections/HelpBlock";
import { HeroHeader } from "./affiliates/sections/HeroHeader";
import { GlobalHistorySection } from "./affiliates/sections/GlobalHistorySection";
import { FiltersBar } from "./affiliates/sections/FiltersBar";
import { TopAffiliatesList } from "./affiliates/sections/TopAffiliatesList";
import { AffiliatesListTable } from "./affiliates/sections/AffiliatesListTable";
import { AffiliateDetailDrawer } from "./affiliates/sections/AffiliateDetailDrawer";
import { AffiliateFormModal } from "./affiliates/sections/AffiliateFormModal";

const defaultForm: AffiliateFormData = {
  user_id: "",
  affiliate_code: "",
  referral_slug: "",
  name: "",
  phone: "",
  commission_rate: "10",
  status: "ACTIVE",
  notes: "",
};

export default function AffiliatesPage() {
  const [items, setItems] = useState<Affiliate[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Affiliate | null>(null);
  const [form, setForm] = useState<AffiliateFormData>(defaultForm);

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [detailTab, setDetailTab] = useState<
    "overview" | "commissions" | "clicks" | "history"
  >("overview");

  const [commissionItems, setCommissionItems] = useState<AffiliateCommission[]>([]);
  const [commissionPageInfo, setCommissionPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("");

  const [clickItems, setClickItems] = useState<AffiliateClick[]>([]);
  const [clickPageInfo, setClickPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [clickPage, setClickPage] = useState(1);

  const [historyItems, setHistoryItems] = useState<AffiliateRevenueHistoryRow[]>([]);
  const [historyPageInfo, setHistoryPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPeriod, setHistoryPeriod] = useState<RevenuePeriod>("MONTH");

  const [globalPeriod, setGlobalPeriod] = useState<RevenuePeriod>("MONTH");
  const [globalSummary, setGlobalSummary] =
    useState<AffiliateRevenueSummaryResponse | null>(null);

  const [globalHistoryItems, setGlobalHistoryItems] = useState<AffiliateRevenueHistoryRow[]>([]);
  const [globalHistoryPageInfo, setGlobalHistoryPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [globalHistoryPage, setGlobalHistoryPage] = useState(1);
  const [globalHistoryPeriod, setGlobalHistoryPeriod] = useState<RevenuePeriod>("MONTH");

  const [affiliateDashboard, setAffiliateDashboard] =
    useState<AffiliateDashboardResponse | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.affiliates += 1;
        acc.active += item.status === "ACTIVE" ? 1 : 0;
        acc.clicks += Number(item.total_clicks || 0);
        acc.orders += Number(item.total_orders || 0);
        acc.earnings += Number(item.total_earnings || 0);
        return acc;
      },
      { affiliates: 0, active: 0, clicks: 0, orders: 0, earnings: 0 },
    );
  }, [items]);

  const globalMetrics = useMemo(() => {
    const g = globalSummary?.global || {};
    return {
      clicks_count: snapshotValue(g, "clicks_count"),
      orders_count: snapshotValue(g, "orders_count"),
      sales_amount: snapshotValue(g, "sales_amount"),
      commission_pending: snapshotValue(g, "commission_pending"),
      commission_approved: snapshotValue(g, "commission_approved"),
      commission_paid: snapshotValue(g, "commission_paid"),
      commission_cancelled: snapshotValue(g, "commission_cancelled"),
      commission_total: snapshotValue(g, "commission_total"),
    };
  }, [globalSummary]);

  const maxClicks = useMemo(
    () => Math.max(1, ...items.map((x) => Number(x.total_clicks || 0))),
    [items],
  );

  const topAffiliates = useMemo(() => {
    return [...items]
      .sort((a, b) => Number(b.total_earnings || 0) - Number(a.total_earnings || 0))
      .slice(0, 5);
  }, [items]);

  const filteredProducts = useMemo(() => {
    const keyword = String(productSearch || "").trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((p) => {
      const hay = [p.name, p.slug, p.shop_name, String(p.id)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(keyword);
    });
  }, [products, productSearch]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === Number(selectedProductId)) || null;
  }, [products, selectedProductId]);

  const selectedProductPath = useMemo(() => buildPublicProductPath(selectedProduct), [selectedProduct]);

  const todayGain = snapshotValue(affiliateDashboard?.today, "commission_total");
  const weekGain = snapshotValue(affiliateDashboard?.week, "commission_total");
  const monthGain = snapshotValue(affiliateDashboard?.month, "commission_total");
  const yearGain = snapshotValue(affiliateDashboard?.year, "commission_total");

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetUserSelection() {
    setSelectedUser(null);
    setUserSearch("");
    setUserResults([]);
    setShowUserDropdown(false);
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingItem(null);
    setShowForm(false);
    resetUserSelection();
  }

  function patchForm<K extends keyof AffiliateFormData>(
    key: K,
    value: AffiliateFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autoFillFromName(nameOverride?: string) {
    const sourceName = String(nameOverride || form.name || "").trim();
    if (!sourceName) return;

    setForm((prev) => ({
      ...prev,
      referral_slug: prev.referral_slug?.trim()
        ? prev.referral_slug
        : buildAffiliateSlugFromName(sourceName),
      affiliate_code: prev.affiliate_code?.trim()
        ? normalizeAffiliateCodeLocal(prev.affiliate_code)
        : buildAffiliateCodeFromName(sourceName),
    }));
  }

  function applyUserToForm(user: UserOption) {
    const label = safeUserLabel(user);

    setSelectedUser(user);
    setUserSearch(label);
    setUserResults([]);
    setShowUserDropdown(false);

    setForm((prev) => ({
      ...prev,
      user_id: String(user.id),
      name: label,
      phone: user.phone || "",
      referral_slug: prev.referral_slug?.trim()
        ? prev.referral_slug
        : buildAffiliateSlugFromName(label, user.id),
      affiliate_code: prev.affiliate_code?.trim()
        ? normalizeAffiliateCodeLocal(prev.affiliate_code)
        : buildAffiliateCodeFromName(label, user.id),
    }));
  }

  function openCreate() {
    clearMessages();
    setEditingItem(null);
    setForm(defaultForm);
    resetUserSelection();
    setShowForm(true);
  }

  function openEdit(item: Affiliate) {
    clearMessages();
    setEditingItem(item);
    setForm({
      user_id: item.user_id ? String(item.user_id) : "",
      affiliate_code: item.affiliate_code || "",
      referral_slug: item.referral_slug || "",
      name: item.name || "",
      phone: item.phone || "",
      commission_rate: String(item.commission_rate ?? 10),
      status: item.status || "ACTIVE",
      notes: item.notes || "",
    });

    if (item.user) {
      const preparedUser = {
        id: item.user.id,
        first_name: item.user.first_name || null,
        last_name: item.user.last_name || null,
        phone: item.user.phone || null,
        role: item.user.role || null,
        full_name: [item.user.first_name, item.user.last_name]
          .filter(Boolean)
          .join(" ")
          .trim(),
      };

      setSelectedUser(preparedUser);
      setUserSearch(
        [item.user.first_name, item.user.last_name].filter(Boolean).join(" ").trim() ||
          item.name ||
          "",
      );
    } else {
      resetUserSelection();
    }

    setShowForm(true);
  }

  async function loadProducts() {
    setProductsLoading(true);
    try {
      let data: any = null;

      try {
        data = await api.get("/api/products/manage", {
          query: { page: 1, pageSize: 250, onlyActive: 1 },
        });
      } catch {
        data = await api.get("/api/products", {
          query: { page: 1, pageSize: 250, onlyActive: 1 },
        });
      }

      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      const mapped: ProductOption[] = rawItems.map((item: any) => ({
        id: Number(item.id),
        name: item.name || item.title || `Produit #${item.id}`,
        slug: item.slug || null,
        price: item.price ?? null,
        promo_price: item.promo_price ?? item.min_promo_price ?? null,
        stock: item.stock ?? null,
        is_active: item.is_active ?? item.active ?? null,
        shop_name: item.shop_name || item.shop?.name || null,
        cover:
          item.cover ||
          item.first_image ||
          item.first_product_cover ||
          item.image ||
          item.thumbnail ||
          null,
      }));

      setProducts(mapped.filter((p) => Number.isFinite(p.id) && p.id > 0));
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les produits.");
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadAffiliates(nextPage = page) {
    setLoading(true);
    setError("");

    try {
      const data: any = await listAffiliates({
        q,
        status: (statusFilter as any) || "",
        page: nextPage,
        pageSize,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
      setPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les affiliés.");
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalSummary(period: RevenuePeriod = globalPeriod) {
    try {
      const data = await getAffiliatesRevenueSummary(period);
      setGlobalSummary(data || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le résumé global.");
    }
  }

  async function loadGlobalHistory(
    period: RevenuePeriod = globalHistoryPeriod,
    nextPage = globalHistoryPage,
  ) {
    try {
      const data = await getAffiliatesRevenueHistory({
        period,
        page: nextPage,
        pageSize: 12,
      });

      setGlobalHistoryItems(Array.isArray(data?.items) ? data.items : []);
      setGlobalHistoryPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger l'historique global.");
    }
  }

  async function loadAffiliateDetails(id: number) {
    setDetailLoading(true);
    setError("");

    try {
      const data: any = await getAffiliate(id);
      setSelectedAffiliate(data || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le détail de l'affilié.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadAffiliateDashboardData(id: number) {
    try {
      const data = await getAffiliateDashboard(id);
      setAffiliateDashboard(data || null);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le dashboard affilié.");
    }
  }

  async function loadCommissions(id: number, nextPage = commissionPage) {
    try {
      const data: any = await listAffiliateCommissions(id, {
        page: nextPage,
        pageSize: 10,
        status: (commissionStatusFilter as any) || "",
      });
      setCommissionItems(Array.isArray(data?.items) ? data.items : []);
      setCommissionPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les commissions.");
    }
  }

  async function loadClicks(id: number, nextPage = clickPage) {
    try {
      const data: any = await listAffiliateClicks(id, {
        page: nextPage,
        pageSize: 10,
      });
      setClickItems(Array.isArray(data?.items) ? data.items : []);
      setClickPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les clics.");
    }
  }

  async function loadAffiliateHistoryData(
    id: number,
    period: RevenuePeriod = historyPeriod,
    nextPage = historyPage,
  ) {
    try {
      const data = await getAffiliateRevenueHistory(id, {
        period,
        page: nextPage,
        pageSize: 12,
      });
      setHistoryItems(Array.isArray(data?.items) ? data.items : []);
      setHistoryPageInfo(data?.pageInfo || defaultPageInfo);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger l'historique affilié.");
    }
  }

  useEffect(() => {
    loadAffiliates(1);
  }, [q, statusFilter, pageSize]);

  useEffect(() => {
    loadAffiliates(page);
  }, [page]);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadGlobalSummary(globalPeriod);
  }, [globalPeriod]);

  useEffect(() => {
    loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);
  }, [globalHistoryPeriod, globalHistoryPage]);

  useEffect(() => {
    if (!showForm) return;

    const keyword = userSearch.trim();
    if (keyword.length < 2) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setUsersLoading(true);
      try {
        const users = await searchUsersCandidates(keyword);
        setUserResults(users);
        setShowUserDropdown(users.length > 0);
      } catch {
        setUserResults([]);
        setShowUserDropdown(false);
      } finally {
        setUsersLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [userSearch, showForm]);

  useEffect(() => {
    if (!selectedId) return;

    loadAffiliateDetails(selectedId);
    loadAffiliateDashboardData(selectedId);

    if (detailTab === "commissions") {
      loadCommissions(selectedId, commissionPage);
    }

    if (detailTab === "clicks") {
      loadClicks(selectedId, clickPage);
    }

    if (detailTab === "history") {
      loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "commissions") {
      loadCommissions(selectedId, commissionPage);
    }
  }, [detailTab, commissionPage, commissionStatusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "clicks") {
      loadClicks(selectedId, clickPage);
    }
  }, [detailTab, clickPage]);

  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "history") {
      loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
    }
  }, [detailTab, historyPeriod, historyPage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!userDropdownRef.current) return;
      if (!userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        user_id: form.user_id.trim() ? Number(form.user_id) : null,
        affiliate_code: normalizeAffiliateCodeLocal(
          form.affiliate_code || buildAffiliateCodeFromName(form.name),
        ),
        referral_slug: form.referral_slug.trim()
          ? slugify(form.referral_slug)
          : buildAffiliateSlugFromName(form.name),
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        commission_rate: Number(form.commission_rate || 10),
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (!payload.name) {
        throw new Error("Le nom est obligatoire.");
      }

      if (editingItem) {
        await updateAffiliate(editingItem.id, payload as any);
        setSuccess("Affilié mis à jour avec succès.");
      } else {
        await createAffiliate(payload as any);
        setSuccess("Affilié créé avec succès.");
      }

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);
      resetForm();
    } catch (e: any) {
      setError(e?.message || "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAffiliateStatus(item: Affiliate) {
    clearMessages();

    try {
      const nextStatus: AffiliateStatus =
        item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

      await updateAffiliateStatus(item.id, { status: nextStatus } as any);

      setSuccess(
        nextStatus === "ACTIVE"
          ? "Affilié réactivé avec succès."
          : "Affilié désactivé avec succès.",
      );

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);

      if (selectedId === item.id) {
        await loadAffiliateDetails(item.id);
        await loadAffiliateDashboardData(item.id);
      }
    } catch (e: any) {
      setError(e?.message || "Impossible de changer le statut.");
    }
  }

  async function handleChangeCommissionStatus(
    row: AffiliateCommission,
    status: CommissionStatus,
  ) {
    clearMessages();

    try {
      await updateAffiliateCommissionStatus(row.id, { status } as any);
      setSuccess("Statut de commission mis à jour.");

      if (selectedId) {
        await loadCommissions(selectedId, commissionPage);
        await loadAffiliateDetails(selectedId);
        await loadAffiliateDashboardData(selectedId);
        await loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
      }

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);
    } catch (e: any) {
      setError(e?.message || "Impossible de mettre à jour la commission.");
    }
  }

  async function handleRebuildReports() {
    clearMessages();

    try {
      await rebuildAffiliateReports(selectedId ? { affiliate_id: selectedId } : {});
      setSuccess("Rapports affiliés recalculés avec succès.");

      await loadAffiliates(page);
      await loadGlobalSummary(globalPeriod);
      await loadGlobalHistory(globalHistoryPeriod, globalHistoryPage);

      if (selectedId) {
        await loadAffiliateDetails(selectedId);
        await loadAffiliateDashboardData(selectedId);
        await loadAffiliateHistoryData(selectedId, historyPeriod, historyPage);
        await loadCommissions(selectedId, commissionPage);
      }
    } catch (e: any) {
      setError(e?.message || "Impossible de recalculer les rapports.");
    }
  }

  async function handleCopy(text: string | null | undefined, label: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${label} copié.`);
      window.setTimeout(() => setSuccess(""), 1600);
    } catch {
      setError(`Impossible de copier ${label.toLowerCase()}.`);
    }
  }

  const selectedPublicByCode = selectedAffiliate?.affiliate_code
    ? getAffiliatePublicUrlByCode(selectedAffiliate.affiliate_code)
    : "";

  const selectedPublicBySlug = selectedAffiliate?.referral_slug
    ? getAffiliatePublicUrlBySlug(selectedAffiliate.referral_slug)
    : "";

  const selectedTrackingUrl = selectedAffiliate?.affiliate_code
    ? getAffiliateTrackingUrlByCode(selectedAffiliate.affiliate_code, "/")
    : "";

  const selectedProductPublicUrl =
    selectedAffiliate?.affiliate_code && selectedProduct
      ? getAffiliateProductPublicUrlByCode(
          selectedAffiliate.affiliate_code,
          selectedProduct.id,
          selectedProductPath,
        )
      : "";

  const selectedProductTrackingUrl =
    selectedAffiliate?.affiliate_code && selectedProduct
      ? getAffiliateProductTrackingUrlByCode(
          selectedAffiliate.affiliate_code,
          selectedProduct.id,
          "dashboard",
          selectedProductPath,
        )
      : "";

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: `linear-gradient(180deg, ${DUU.bg} 0%, #fff 220px)`,
        minHeight: "100%",
      }}
    >
      <HeroHeader
        error={error}
        success={success}
        globalPeriod={globalPeriod}
        globalMetrics={globalMetrics}
        totals={totals}
      />

      <GlobalHistorySection
        globalHistoryPeriod={globalHistoryPeriod}
        globalHistoryItems={globalHistoryItems}
        globalHistoryPageInfo={globalHistoryPageInfo}
        onPeriodChange={(period) => {
          setGlobalHistoryPage(1);
          setGlobalHistoryPeriod(period);
        }}
        onPageChange={(nextPage) => setGlobalHistoryPage(nextPage)}
      />

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-8">
          <FiltersBar
            loading={loading}
            qInput={qInput}
            statusFilter={statusFilter}
            globalPeriod={globalPeriod}
            pageSize={pageSize}
            onQInputChange={setQInput}
            onStatusFilterChange={(value) => {
              setPage(1);
              setStatusFilter(value);
            }}
            onGlobalPeriodChange={setGlobalPeriod}
            onPageSizeChange={(value) => {
              setPage(1);
              setPageSize(value);
            }}
            onSubmitSearch={() => {
              setPage(1);
              setQ(qInput.trim());
            }}
            onReset={() => {
              setQInput("");
              setQ("");
              setStatusFilter("");
              setPage(1);
              setPageSize(10);
              setGlobalPeriod("MONTH");
            }}
            onRefresh={() => loadAffiliates(page)}
            onRebuildReports={handleRebuildReports}
            onCreateClick={openCreate}
          />
        </div>

        <div className="col-12 col-xl-4">
          <TopAffiliatesList topAffiliates={topAffiliates} />
        </div>
      </div>

      {showForm ? (
        <AffiliateFormModal
          editingItem={editingItem}
          form={form}
          submitting={submitting}
          userSearch={userSearch}
          userResults={userResults}
          usersLoading={usersLoading}
          selectedUser={selectedUser}
          showUserDropdown={showUserDropdown}
          userDropdownRef={userDropdownRef}
          onClose={resetForm}
          onSubmit={handleSubmit}
          onUserSearchChange={(value) => {
            setUserSearch(value);
            setShowUserDropdown(true);
          }}
          onUserSearchFocus={() => {
            if (userResults.length > 0) setShowUserDropdown(true);
          }}
          onSelectUser={applyUserToForm}
          onClearUser={() => {
            resetUserSelection();
            patchForm("user_id", "");
          }}
          onPatchForm={patchForm}
          onNameBlur={autoFillFromName}
        />
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-xxl-8">
          <AffiliatesListTable
            loading={loading}
            items={items}
            pageInfo={pageInfo}
            maxClicks={maxClicks}
            onSelectAffiliate={(item) => {
              setSelectedId(item.id);
              setDetailTab("overview");
              setSelectedProductId("");
              setProductSearch("");
              setHistoryPage(1);
              setHistoryPeriod("MONTH");
            }}
            onEdit={openEdit}
            onToggleStatus={handleToggleAffiliateStatus}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        </div>

        <div className="col-12 col-xxl-4">
          <AffiliateDetailDrawer
            selectedId={selectedId}
            detailLoading={detailLoading}
            selectedAffiliate={selectedAffiliate}
            affiliateDashboard={affiliateDashboard}
            todayGain={todayGain}
            weekGain={weekGain}
            monthGain={monthGain}
            yearGain={yearGain}
            selectedPublicByCode={selectedPublicByCode}
            selectedPublicBySlug={selectedPublicBySlug}
            selectedTrackingUrl={selectedTrackingUrl}
            productSearch={productSearch}
            selectedProductId={selectedProductId}
            productsLoading={productsLoading}
            filteredProducts={filteredProducts}
            selectedProduct={selectedProduct}
            selectedProductPath={selectedProductPath}
            selectedProductPublicUrl={selectedProductPublicUrl}
            selectedProductTrackingUrl={selectedProductTrackingUrl}
            onProductSearchChange={setProductSearch}
            onProductSelect={setSelectedProductId}
            detailTab={detailTab}
            onTabChange={(tab) => {
              if (tab === "commissions") setCommissionPage(1);
              if (tab === "clicks") setClickPage(1);
              if (tab === "history") setHistoryPage(1);
              setDetailTab(tab);
            }}
            commissionStatusFilter={commissionStatusFilter}
            commissionItems={commissionItems}
            commissionPageInfo={commissionPageInfo}
            onCommissionStatusFilterChange={(value) => {
              setCommissionPage(1);
              setCommissionStatusFilter(value);
            }}
            onChangeCommissionStatus={handleChangeCommissionStatus}
            onCommissionPageChange={(nextPage) => setCommissionPage(nextPage)}
            clickItems={clickItems}
            clickPageInfo={clickPageInfo}
            onClickPageChange={(nextPage) => setClickPage(nextPage)}
            historyPeriod={historyPeriod}
            historyItems={historyItems}
            historyPageInfo={historyPageInfo}
            onHistoryPeriodChange={(period) => {
              setHistoryPage(1);
              setHistoryPeriod(period);
            }}
            onHistoryPageChange={(nextPage) => setHistoryPage(nextPage)}
            onCopy={handleCopy}
          />
        </div>
      </div>

      <HelpBlock />
    </div>
  );
}