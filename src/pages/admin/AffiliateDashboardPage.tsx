import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  BarChart3,
  Copy,
  History,
  Link2,
  MousePointerClick,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  getAffiliateProductPublicUrlByCode,
  getAffiliateProductTrackingUrlByCode,
  getAffiliatePublicUrlByCode,
  getAffiliatePublicUrlBySlug,
  getAffiliateTrackingUrlByCode,
  getMyAffiliate,
  getMyAffiliateClicks,
  getMyAffiliateCommissions,
  getMyAffiliateDashboard,
  getMyAffiliateHistory,
  type Affiliate,
  type AffiliateClick,
  type AffiliateCommission,
  type AffiliateRevenueHistoryRow,
  type AffiliateCommissionStatus,
  type RevenuePeriod,
} from "../../services/affiliates";
import { api } from "../../services/http";
import {
  DUU,
  type PageInfo,
  defaultPageInfo,
  type ProductOption,
  formatMoney,
  formatNumber,
  formatDate,
  formatDateOnly,
  buildPublicProductPath,
  cardStyle,
  statusBadgeClass,
} from "./affiliates/shared";
import { SectionTitle, KpiCard, PaginationBar, HistoryStat } from "./affiliates/components";

type MyAffiliateDashboardData = {
  affiliate: Affiliate;
  global?: {
    clicks_count?: number;
    orders_count?: number;
    sales_amount?: number;
    commission_pending?: number;
    commission_approved?: number;
    commission_paid?: number;
    commission_cancelled?: number;
    commission_total?: number;
  };
  today?: {
    commission_total?: number;
  };
  week?: {
    commission_total?: number;
  };
  month?: {
    commission_total?: number;
  };
  year?: {
    commission_total?: number;
  };
};

async function loadProductsPublic(): Promise<ProductOption[]> {
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

  return rawItems
    .map((item: any) => ({
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
    }))
    .filter((p: ProductOption) => Number.isFinite(p.id) && p.id > 0);
}

export default function AffiliateDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [dashboard, setDashboard] = useState<MyAffiliateDashboardData | null>(null);

  const [detailTab, setDetailTab] = useState<"overview" | "commissions" | "clicks" | "history">(
    "overview",
  );

  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [commissionsPageInfo, setCommissionsPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<
    AffiliateCommissionStatus | "" | "ALL"
  >("");

  const [clicks, setClicks] = useState<AffiliateClick[]>([]);
  const [clicksPageInfo, setClicksPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [clicksPage, setClicksPage] = useState(1);

  const [historyItems, setHistoryItems] = useState<AffiliateRevenueHistoryRow[]>([]);
  const [historyPageInfo, setHistoryPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPeriod, setHistoryPeriod] = useState<RevenuePeriod>("MONTH");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");

  const global = dashboard?.global || {};
  const today = dashboard?.today || {};
  const week = dashboard?.week || {};
  const month = dashboard?.month || {};
  const year = dashboard?.year || {};

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

  const selectedProductPath = useMemo(
    () => buildPublicProductPath(selectedProduct),
    [selectedProduct],
  );

  const siteUrlByCode = affiliate?.affiliate_code
    ? getAffiliatePublicUrlByCode(affiliate.affiliate_code)
    : "";

  const siteUrlBySlug = affiliate?.referral_slug
    ? getAffiliatePublicUrlBySlug(affiliate.referral_slug)
    : "";

  const trackingSiteUrl = affiliate?.affiliate_code
    ? getAffiliateTrackingUrlByCode(affiliate.affiliate_code, "/")
    : "";

  const productUrl = affiliate?.affiliate_code && selectedProduct
    ? getAffiliateProductPublicUrlByCode(
        affiliate.affiliate_code,
        selectedProduct.id,
        selectedProductPath,
      )
    : "";

  const productTrackingUrl = affiliate?.affiliate_code && selectedProduct
    ? getAffiliateProductTrackingUrlByCode(
        affiliate.affiliate_code,
        selectedProduct.id,
        "affiliate-space",
        selectedProductPath,
      )
    : "";

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

  async function loadBase() {
    setError("");

    const me = await getMyAffiliate();
    if (!me?.is_affiliate || !me?.affiliate) {
      setAffiliate(null);
      setDashboard(null);
      return;
    }

    setAffiliate(me.affiliate);

    const dash = await getMyAffiliateDashboard();
    setDashboard(dash as MyAffiliateDashboardData);
    setAffiliate(dash.affiliate);
  }

  async function loadCommissionsData(nextPage = commissionsPage) {
    const data = await getMyAffiliateCommissions({
      page: nextPage,
      pageSize: 10,
      status: commissionStatusFilter,
    });

    setCommissions(Array.isArray(data?.items) ? data.items : []);
    setCommissionsPageInfo((data?.pageInfo as PageInfo) || defaultPageInfo);
  }

  async function loadClicksData(nextPage = clicksPage) {
    const data = await getMyAffiliateClicks({
      page: nextPage,
      pageSize: 10,
    });

    setClicks(Array.isArray(data?.items) ? data.items : []);
    setClicksPageInfo((data?.pageInfo as PageInfo) || defaultPageInfo);
  }

  async function loadHistoryData(
    period: RevenuePeriod = historyPeriod,
    nextPage = historyPage,
  ) {
    const data = await getMyAffiliateHistory({
      period,
      page: nextPage,
      pageSize: 12,
    });

    setHistoryItems(Array.isArray(data?.items) ? data.items : []);
    setHistoryPageInfo((data?.pageInfo as PageInfo) || defaultPageInfo);
  }

  async function refreshAll() {
    setRefreshing(true);
    setError("");
    try {
      await loadBase();
      if (detailTab === "commissions") {
        await loadCommissionsData(1);
        setCommissionsPage(1);
      }
      if (detailTab === "clicks") {
        await loadClicksData(1);
        setClicksPage(1);
      }
      if (detailTab === "history") {
        await loadHistoryData(historyPeriod, 1);
        setHistoryPage(1);
      }
      setSuccess("Dashboard actualisé.");
      window.setTimeout(() => setSuccess(""), 1500);
    } catch (e: any) {
      setError(e?.message || "Impossible d'actualiser le dashboard affilié.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      try {
        await loadBase();
        setProductsLoading(true);
        const items = await loadProductsPublic();
        setProducts(items);
      } catch (e: any) {
        setError(e?.message || "Impossible de charger l'espace affilié.");
      } finally {
        setProductsLoading(false);
        setLoading(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!affiliate) return;

    if (detailTab === "commissions") {
      loadCommissionsData(commissionsPage).catch((e: any) => {
        setError(e?.message || "Impossible de charger les commissions.");
      });
    }
  }, [affiliate, detailTab, commissionsPage, commissionStatusFilter]);

  useEffect(() => {
    if (!affiliate) return;

    if (detailTab === "clicks") {
      loadClicksData(clicksPage).catch((e: any) => {
        setError(e?.message || "Impossible de charger les clics.");
      });
    }
  }, [affiliate, detailTab, clicksPage]);

  useEffect(() => {
    if (!affiliate) return;

    if (detailTab === "history") {
      loadHistoryData(historyPeriod, historyPage).catch((e: any) => {
        setError(e?.message || "Impossible de charger l'historique.");
      });
    }
  }, [affiliate, detailTab, historyPeriod, historyPage]);

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-light border">Chargement de l’espace affilié...</div>
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div
        className="container-fluid py-4"
        style={{
          background: `linear-gradient(180deg, ${DUU.bg} 0%, #fff 220px)`,
          minHeight: "100%",
        }}
      >
        <div className="p-4 p-lg-5" style={cardStyle()}>
          <h2 className="fw-bold mb-2" style={{ color: DUU.black }}>
            Espace affilié
          </h2>
          <p className="mb-0" style={{ color: DUU.gray }}>
            Votre compte n’est pas encore lié à un profil affilié.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: `linear-gradient(180deg, ${DUU.bg} 0%, #fff 220px)`,
        minHeight: "100%",
      }}
    >
      <div
        className="mb-4 p-4 p-lg-5"
        style={cardStyle({
          background:
            "radial-gradient(circle at top right, rgba(245,130,31,0.28), transparent 35%), linear-gradient(135deg, #111111 0%, #1B1B1B 100%)",
          border: "1px solid rgba(245,130,31,0.16)",
        })}
      >
        <div className="row g-4 align-items-center">
          <div className="col-12 col-xl-8">
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-2 mb-3"
              style={{
                borderRadius: 999,
                background: "rgba(245,130,31,0.14)",
                color: DUU.yellow,
                border: "1px solid rgba(245,130,31,0.24)",
                fontWeight: 700,
                fontSize: ".9rem",
              }}
            >
              <BadgePercent size={16} />
              Mon espace affilié
            </div>

            <h2 className="fw-bold mb-2" style={{ color: DUU.white, fontSize: "2rem" }}>
              {affiliate.name || "Affilié Duumini"}
            </h2>

            <p
              className="mb-0"
              style={{ color: "rgba(255,255,255,0.72)", maxWidth: 760 }}
            >
              Suis tes clics, commandes, ventes, commissions et liens de partage
              depuis ton dashboard personnel.
            </p>
          </div>

          <div className="col-12 col-xl-4">
            <div
              className="p-3 p-lg-4"
              style={{
                borderRadius: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div className="small mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                Aperçu rapide
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Code affilié</span>
                <strong style={{ color: DUU.yellow }}>
                  {affiliate.affiliate_code || "-"}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Statut</span>
                <strong style={{ color: DUU.yellow }}>
                  {affiliate.status || "-"}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Commission</span>
                <strong style={{ color: DUU.yellow }}>
                  {Number(affiliate.commission_rate || 0)}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {success ? <div className="alert alert-success py-2">{success}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Clics"
            value={formatNumber(global.clicks_count || 0)}
            hint="Trafic généré"
            icon={<MousePointerClick size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Commandes"
            value={formatNumber(global.orders_count || 0)}
            hint="Conversions"
            icon={<BarChart3 size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Ventes"
            value={formatMoney(global.sales_amount || 0)}
            hint="Montant des ventes"
            icon={<TrendingUp size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Gains"
            value={formatMoney(global.commission_total || 0)}
            hint={`En attente ${formatMoney(global.commission_pending || 0)}`}
            icon={<Wallet size={20} />}
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Gain du jour"
            value={formatMoney(today.commission_total || 0)}
            icon={<Wallet size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Gain semaine"
            value={formatMoney(week.commission_total || 0)}
            icon={<TrendingUp size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Gain mois"
            value={formatMoney(month.commission_total || 0)}
            icon={<BarChart3 size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Gain année"
            value={formatMoney(year.commission_total || 0)}
            icon={<History size={20} />}
          />
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-8">
          <div className="p-3 p-lg-4" style={cardStyle()}>
            <SectionTitle
              icon={<Link2 size={20} />}
              title="Mes liens de partage"
              sub="Copie tes liens site et produit pour suivre tes performances"
              right={
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: DUU.white,
                    color: DUU.black,
                    border: `1px solid ${DUU.line}`,
                    borderRadius: 14,
                    fontWeight: 700,
                  }}
                  onClick={refreshAll}
                  disabled={refreshing}
                >
                  <RefreshCw size={16} className="me-2" />
                  {refreshing ? "Actualisation..." : "Actualiser"}
                </button>
              }
            />

            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <div
                  className="p-3 h-100"
                  style={{
                    borderRadius: 18,
                    background: DUU.white,
                    border: `1px solid ${DUU.line}`,
                  }}
                >
                  <div className="small fw-semibold mb-2" style={{ color: DUU.gray }}>
                    Lien site avec code
                  </div>
                  <div className="small text-break mb-3" style={{ color: DUU.black }}>
                    {siteUrlByCode || "-"}
                  </div>
                  <button
                    type="button"
                    className="btn w-100"
                    style={{
                      background: DUU.black,
                      color: DUU.yellow,
                      borderRadius: 14,
                      fontWeight: 800,
                    }}
                    onClick={() => handleCopy(siteUrlByCode, "Lien site")}
                    disabled={!siteUrlByCode}
                  >
                    <Copy size={15} className="me-2" />
                    Copier
                  </button>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div
                  className="p-3 h-100"
                  style={{
                    borderRadius: 18,
                    background: DUU.white,
                    border: `1px solid ${DUU.line}`,
                  }}
                >
                  <div className="small fw-semibold mb-2" style={{ color: DUU.gray }}>
                    Lien site avec slug
                  </div>
                  <div className="small text-break mb-3" style={{ color: DUU.black }}>
                    {siteUrlBySlug || "-"}
                  </div>
                  <button
                    type="button"
                    className="btn w-100"
                    style={{
                      background: DUU.white,
                      color: DUU.black,
                      border: `1px solid ${DUU.line}`,
                      borderRadius: 14,
                      fontWeight: 700,
                    }}
                    onClick={() => handleCopy(siteUrlBySlug, "Lien site slug")}
                    disabled={!siteUrlBySlug}
                  >
                    <Copy size={15} className="me-2" />
                    Copier
                  </button>
                </div>
              </div>

              <div className="col-12">
                <div
                  className="p-3"
                  style={{
                    borderRadius: 18,
                    background: DUU.yellowSoft,
                    border: `1px solid ${DUU.yellowBorder}`,
                  }}
                >
                  <div className="small fw-semibold mb-2" style={{ color: "#8A6200" }}>
                    Lien tracking site
                  </div>
                  <div className="small text-break mb-3" style={{ color: DUU.black }}>
                    {trackingSiteUrl || "-"}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: DUU.black,
                      color: DUU.yellow,
                      borderRadius: 14,
                      fontWeight: 800,
                    }}
                    onClick={() => handleCopy(trackingSiteUrl, "Lien tracking")}
                    disabled={!trackingSiteUrl}
                  >
                    <Copy size={15} className="me-2" />
                    Copier le lien tracking
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="p-3 p-lg-4 h-100" style={cardStyle()}>
            <SectionTitle
              icon={<BadgePercent size={20} />}
              title="Mon profil affilié"
              sub="Informations liées à ton compte"
            />

            <div className="d-flex flex-column gap-3">
              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Nom
                </div>
                <div style={{ color: DUU.black }}>{affiliate.name || "-"}</div>
              </div>

              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Téléphone
                </div>
                <div style={{ color: DUU.black }}>{affiliate.phone || "-"}</div>
              </div>

              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Code affilié
                </div>
                <div style={{ color: DUU.black }}>{affiliate.affiliate_code || "-"}</div>
              </div>

              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Slug
                </div>
                <div style={{ color: DUU.black }}>{affiliate.referral_slug || "-"}</div>
              </div>

              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Commission
                </div>
                <div style={{ color: DUU.black }}>{Number(affiliate.commission_rate || 0)}%</div>
              </div>

              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Statut
                </div>
                <span
                  className="px-3 py-2 d-inline-flex"
                  style={{
                    borderRadius: 999,
                    fontSize: ".82rem",
                    fontWeight: 800,
                    ...statusBadgeClass(affiliate.status),
                  }}
                >
                  {affiliate.status || "-"}
                </span>
              </div>

              <div>
                <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                  Créé le
                </div>
                <div style={{ color: DUU.black }}>{formatDate(affiliate.created_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 p-lg-4" style={cardStyle()}>
        <SectionTitle
          icon={<Package size={20} />}
          title="Générer un lien produit affilié"
          sub="Choisis un produit et copie ton lien client ou tracking"
        />

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Recherche produit</label>
            <div className="position-relative">
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: DUU.gray,
                }}
              />
              <input
                type="text"
                className="form-control"
                style={{
                  paddingLeft: 36,
                  borderRadius: 14,
                  borderColor: DUU.line,
                  background: DUU.white,
                  minHeight: 46,
                }}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Nom, boutique, slug, ID..."
              />
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <label className="form-label fw-semibold">Produit</label>
            <select
              className="form-select"
              style={{
                borderRadius: 14,
                borderColor: DUU.line,
                background: DUU.white,
                minHeight: 46,
              }}
              value={selectedProductId}
              onChange={(e) =>
                setSelectedProductId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={productsLoading}
            >
              <option value="">
                {productsLoading ? "Chargement des produits..." : "Sélectionner un produit"}
              </option>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  #{product.id} — {product.name}
                  {product.shop_name ? ` — ${product.shop_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-lg-3 d-flex align-items-end">
            <div
              className="w-100 p-3"
              style={{
                borderRadius: 16,
                background: DUU.yellowSoft,
                border: `1px solid ${DUU.yellowBorder}`,
              }}
            >
              <div className="small" style={{ color: "#8A6200" }}>
                Produits disponibles
              </div>
              <div className="fw-bold" style={{ color: DUU.black }}>
                {formatNumber(filteredProducts.length)}
              </div>
            </div>
          </div>
        </div>

        {selectedProduct ? (
          <div
            className="mt-3 p-3"
            style={{
              borderRadius: 18,
              background: DUU.white,
              border: `1px solid ${DUU.line}`,
            }}
          >
            <div className="row g-3 align-items-center">
              <div className="col-12 col-lg-6">
                <div className="fw-semibold" style={{ color: DUU.black }}>
                  {selectedProduct.name}
                </div>
                <div className="small" style={{ color: DUU.gray }}>
                  ID: {selectedProduct.id}
                  {selectedProduct.shop_name ? ` • ${selectedProduct.shop_name}` : ""}
                </div>
                <div className="small mt-1" style={{ color: DUU.gray }}>
                  Prix: {formatMoney(selectedProduct.promo_price || selectedProduct.price || 0)}
                  {selectedProduct.stock != null ? ` • Stock: ${selectedProduct.stock}` : ""}
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="d-grid gap-2">
                  <button
                    type="button"
                    className="btn text-start"
                    style={{
                      background: DUU.black,
                      color: DUU.yellow,
                      borderRadius: 14,
                      fontWeight: 800,
                    }}
                    onClick={() => handleCopy(productUrl, "Lien produit")}
                    disabled={!productUrl}
                  >
                    <Copy size={15} className="me-2" />
                    Copier lien produit
                  </button>

                  <button
                    type="button"
                    className="btn text-start"
                    style={{
                      background: DUU.white,
                      color: DUU.black,
                      border: `1px solid ${DUU.line}`,
                      borderRadius: 14,
                      fontWeight: 700,
                    }}
                    onClick={() => handleCopy(productTrackingUrl, "Lien tracking produit")}
                    disabled={!productTrackingUrl}
                  >
                    <Copy size={15} className="me-2" />
                    Copier lien tracking produit
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={cardStyle()}>
        <div className="p-3 p-lg-4 border-bottom" style={{ borderColor: DUU.line }}>
          <SectionTitle
            icon={<History size={20} />}
            title="Suivi détaillé"
            sub="Consulte tes commissions, clics et ton historique"
          />
          <div className="d-flex gap-2 flex-wrap">
            {[
              { key: "overview", label: "Vue" },
              { key: "commissions", label: "Commissions" },
              { key: "clicks", label: "Clics" },
              { key: "history", label: "Historique" },
            ].map((tab) => {
              const active = detailTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className="btn"
                  style={{
                    borderRadius: 14,
                    background: active ? DUU.black : DUU.white,
                    color: active ? DUU.yellow : DUU.black,
                    border: `1px solid ${active ? DUU.black : DUU.line}`,
                    fontWeight: 800,
                  }}
                  onClick={() => {
                    if (tab.key === "commissions") setCommissionsPage(1);
                    if (tab.key === "clicks") setClicksPage(1);
                    if (tab.key === "history") setHistoryPage(1);
                    setDetailTab(tab.key as "overview" | "commissions" | "clicks" | "history");
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 p-lg-4">
          {detailTab === "overview" ? (
            <div className="row g-3">
              <div className="col-12 col-md-6 col-xl-3">
                <HistoryStat
                  label="Commission en attente"
                  value={formatMoney(global.commission_pending || 0)}
                  tone="warning"
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <HistoryStat
                  label="Commission approuvée"
                  value={formatMoney(global.commission_approved || 0)}
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <HistoryStat
                  label="Commission payée"
                  value={formatMoney(global.commission_paid || 0)}
                  tone="success"
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <HistoryStat
                  label="Commission annulée"
                  value={formatMoney(global.commission_cancelled || 0)}
                />
              </div>

              <div className="col-12">
                <div
                  className="p-3"
                  style={{
                    borderRadius: 18,
                    background: DUU.white,
                    border: `1px solid ${DUU.line}`,
                  }}
                >
                  <div className="small fw-semibold mb-2" style={{ color: DUU.gray }}>
                    Résumé
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="small" style={{ color: DUU.gray }}>Clics</div>
                      <div className="fw-bold" style={{ color: DUU.black }}>
                        {formatNumber(global.clicks_count || 0)}
                      </div>
                    </div>
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="small" style={{ color: DUU.gray }}>Commandes</div>
                      <div className="fw-bold" style={{ color: DUU.black }}>
                        {formatNumber(global.orders_count || 0)}
                      </div>
                    </div>
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="small" style={{ color: DUU.gray }}>Ventes</div>
                      <div className="fw-bold" style={{ color: DUU.black }}>
                        {formatMoney(global.sales_amount || 0)}
                      </div>
                    </div>
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="small" style={{ color: DUU.gray }}>Gains</div>
                      <div className="fw-bold" style={{ color: DUU.black }}>
                        {formatMoney(global.commission_total || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {detailTab === "commissions" ? (
            <>
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold">Filtrer les commissions</label>
                  <select
                    className="form-select"
                    style={{ borderRadius: 14, borderColor: DUU.line, minHeight: 46 }}
                    value={commissionStatusFilter}
                    onChange={(e) => {
                      setCommissionsPage(1);
                      setCommissionStatusFilter(e.target.value as AffiliateCommissionStatus | "" | "ALL");
                    }}
                  >
                    <option value="">Tous</option>
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="d-flex flex-column gap-2">
                {commissions.length === 0 ? (
                  <div className="small" style={{ color: DUU.gray }}>
                    Aucune commission.
                  </div>
                ) : (
                  commissions.map((row) => (
                    <div
                      key={row.id}
                      className="p-3"
                      style={{
                        borderRadius: 18,
                        border: `1px solid ${DUU.line}`,
                        background: DUU.white,
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div>
                          <div className="fw-semibold" style={{ color: DUU.black }}>
                            Commission #{row.id}
                          </div>
                          <div className="small" style={{ color: DUU.gray }}>
                            Commande: {row.order_id ?? "-"}
                          </div>
                        </div>

                        <span
                          className="px-3 py-2 d-inline-flex"
                          style={{
                            borderRadius: 999,
                            fontSize: ".78rem",
                            fontWeight: 800,
                            ...statusBadgeClass(row.status),
                          }}
                        >
                          {row.status}
                        </span>
                      </div>

                      <div className="row g-2 small" style={{ color: DUU.black }}>
                        <div className="col-12 col-md-4">
                          Base: {formatMoney(row.base_amount ?? row.total_sales ?? 0)}
                        </div>
                        <div className="col-12 col-md-4">
                          Montant: {formatMoney(row.amount ?? row.total_earnings ?? 0)}
                        </div>
                        <div className="col-12 col-md-4">
                          Taux: {Number(row.commission_rate || 0)}%
                        </div>
                        <div className="col-12 col-md-4">
                          Produit: {row.product_id ?? "-"}
                        </div>
                        <div className="col-12 col-md-4">
                          Mois: {row.period_month || "-"}
                        </div>
                        <div className="col-12 col-md-4">
                          Créé le: {formatDate(row.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <PaginationBar
                pageInfo={commissionsPageInfo}
                onChange={(nextPage) => setCommissionsPage(nextPage)}
              />
            </>
          ) : null}

          {detailTab === "clicks" ? (
            <>
              <div className="d-flex flex-column gap-2">
                {clicks.length === 0 ? (
                  <div className="small" style={{ color: DUU.gray }}>
                    Aucun clic.
                  </div>
                ) : (
                  clicks.map((row) => (
                    <div
                      key={row.id}
                      className="p-3"
                      style={{
                        borderRadius: 18,
                        border: `1px solid ${DUU.line}`,
                        background: DUU.white,
                      }}
                    >
                      <div className="fw-semibold mb-1" style={{ color: DUU.black }}>
                        Clic #{row.id}
                      </div>
                      <div className="row g-2 small" style={{ color: DUU.gray }}>
                        <div className="col-12 col-md-4">Code: {row.affiliate_code || "-"}</div>
                        <div className="col-12 col-md-4">Produit: {row.product_id ?? "-"}</div>
                        <div className="col-12 col-md-4">Source: {row.source || "-"}</div>
                        <div className="col-12 col-md-4">Device: {row.device || "-"}</div>
                        <div className="col-12 col-md-4">IP: {row.ip_address || "-"}</div>
                        <div className="col-12 col-md-8">
                          Landing: {row.landing_url || "-"}
                        </div>
                        <div className="col-12 col-md-8">
                          Référent: {row.referer_url || "-"}
                        </div>
                        <div className="col-12 col-md-4">
                          Date: {formatDate(row.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <PaginationBar
                pageInfo={clicksPageInfo}
                onChange={(nextPage) => setClicksPage(nextPage)}
              />
            </>
          ) : null}

          {detailTab === "history" ? (
            <>
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold">Période historique</label>
                  <select
                    className="form-select"
                    style={{ borderRadius: 14, borderColor: DUU.line, minHeight: 46 }}
                    value={historyPeriod}
                    onChange={(e) => {
                      setHistoryPage(1);
                      setHistoryPeriod(e.target.value as RevenuePeriod);
                    }}
                  >
                    <option value="DAY">Jour</option>
                    <option value="WEEK">Semaine</option>
                    <option value="MONTH">Mois</option>
                    <option value="YEAR">Année</option>
                  </select>
                </div>
              </div>

              <div className="d-flex flex-column gap-2">
                {historyItems.length === 0 ? (
                  <div className="small" style={{ color: DUU.gray }}>
                    Aucun historique disponible.
                  </div>
                ) : (
                  historyItems.map((row, idx) => (
                    <div
                      key={`${row.period_key}-${idx}`}
                      className="p-3"
                      style={{
                        borderRadius: 20,
                        border: `1px solid ${DUU.line}`,
                        background: DUU.white,
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                        <div>
                          <div className="fw-bold" style={{ color: DUU.black }}>
                            {row.period_key || "-"}
                          </div>
                          <div className="small" style={{ color: DUU.gray }}>
                            {formatDateOnly(row.period_start)} → {formatDateOnly(row.period_end)}
                          </div>
                        </div>
                        <div
                          className="fw-bold"
                          style={{ color: DUU.black, fontSize: "1.05rem" }}
                        >
                          {formatMoney(row.commission_total || 0)}
                        </div>
                      </div>

                      <div className="row g-2">
                        <div className="col-6 col-xl-3">
                          <HistoryStat
                            label="Clics"
                            value={formatNumber(row.clicks_count || 0)}
                          />
                        </div>
                        <div className="col-6 col-xl-3">
                          <HistoryStat
                            label="Commandes"
                            value={formatNumber(row.orders_count || 0)}
                          />
                        </div>
                        <div className="col-6 col-xl-3">
                          <HistoryStat
                            label="Ventes"
                            value={formatMoney(row.sales_amount || 0)}
                          />
                        </div>
                        <div className="col-6 col-xl-3">
                          <HistoryStat
                            label="En attente"
                            value={formatMoney(row.commission_pending || 0)}
                            tone="warning"
                          />
                        </div>
                        <div className="col-6 col-xl-3">
                          <HistoryStat
                            label="Payé"
                            value={formatMoney(row.commission_paid || 0)}
                            tone="success"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <PaginationBar
                pageInfo={historyPageInfo}
                onChange={(nextPage) => setHistoryPage(nextPage)}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}