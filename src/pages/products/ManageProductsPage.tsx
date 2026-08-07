import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { me } from "../../services/auth";
import { api, API_BASE } from "../../services/http";
import { LoadingState, PageLoader } from "../../components/ui/Spinner";

import {
  listManageProducts,
  removeProduct,
  updateProduct,
  type Product,
} from "../../services/products";

import {
  listCategories,
  createCategory,
  type Category,
  type Vertical as CategoryVertical,
} from "../../services/categories";

import {
  listSubCategories,
  createSubCategory,
  type SubCategory as SvcSubCategory,
  type Vertical as SubVertical,
} from "../../services/subCategories";

import { moneyMAD } from "../../utils/money";
import { PageHeader } from "../../components/admin/adminUI";
import ProductForm, {
  type Draft,
  type FullProduct,
  type ProductImage,
  type Shop,
  type SubCategory,
  type VariantDraft,
  cleanVariantsForApi,
  isActive,
  basePriceForAdmin,
} from "./ProductForm";
import QrLabelsModal from "./QrLabelsModal";

type Scope = "admin" | "vendor";
type Vertical = "FOOD" | "MARKET" | "FASHION";

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

function unwrap<T = any>(r: any): T {
  return (r?.data ?? r) as T;
}

function asArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.rows)) return x.rows;
  if (Array.isArray(x?.data)) return x.data;
  return [];
}

function toInt(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function safeImgUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
}

function normalizeVertical(input: any): Vertical | "" {
  const raw = String(input ?? "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "FOOD" || raw === "MARKET" || raw === "FASHION") return raw;

  if (raw === "MEAL" || raw === "PLAT" || raw === "RESTAURANT") return "FOOD";
  if (raw === "GROCERY" || raw === "EPICERIE" || raw === "STORE" || raw === "SHOP")
    return "MARKET";
  if (raw === "CLOTH" || raw === "CLOTHES" || raw === "APPAREL" || raw === "MODE")
    return "FASHION";

  const low = raw.toLowerCase();
  if (low === "food") return "FOOD";
  if (low === "market") return "MARKET";
  if (low === "fashion") return "FASHION";

  return "";
}

function verticalFromProduct(p: any): Vertical | "" {
  return (
    normalizeVertical(p?.vertical) ||
    normalizeVertical(p?.product_vertical) ||
    normalizeVertical(p?.product_type) ||
    normalizeVertical(p?.type) ||
    normalizeVertical(p?.kind) ||
    normalizeVertical(p?.style) ||
    ""
  );
}

function mapDraftStyleToVertical(style: any): Vertical | "" {
  const s = String(style ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s === "food") return "FOOD";
  if (s === "market") return "MARKET";
  if (s === "fashion") return "FASHION";

  const up = String(style ?? "").trim().toUpperCase();
  if (up === "FOOD" || up === "MARKET" || up === "FASHION") return up as Vertical;

  return "";
}

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  size = "xl",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;

  const maxW = size === "sm" ? 520 : size === "md" ? 760 : size === "lg" ? 980 : 1180;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ zIndex: 1055, background: "rgba(0,0,0,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-100 d-flex align-items-center justify-content-center p-3">
        <div
          className="bg-white rounded-4 shadow w-100"
          style={{ maxWidth: maxW, maxHeight: "92vh", overflow: "hidden" }}
        >
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
            <div className="fw-bold">{title}</div>
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              ×
            </button>
          </div>

          <div style={{ overflow: "auto", maxHeight: "calc(92vh - 110px)" }}>
            <div className="p-3">{children}</div>
          </div>

          {footer ? (
            <div className="px-3 py-2 border-top d-flex justify-content-end gap-2">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ManageProductsPage({ scope }: { scope: Scope }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [qrProduct, setQrProduct] = useState<{ id: number; name: string } | null>(null);

  const roleUp = String(user?.role || "").toUpperCase();
  const isVendor =
    scope === "vendor" ||
    roleUp === "VENDOR" ||
    roleUp === "VENDEUR" ||
    roleUp === "SELLER" ||
    roleUp === "BOUTIQUE" ||
    roleUp === "SHOP" ||
    // ✅ Le backend traite RESTAURANT comme VENDEUR pour le choix de
    // boutique (isActingVendorOrRestaurant côté API) — le front doit
    // suivre la même règle pour activer le sélecteur de boutique.
    roleUp === "RESTAURANT";

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const pageSizeOptions = [20, 50, 100, 200, 500, 1000];

  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageSize: 100,
    total: 0,
    pages: 1,
  });

  const [openForm, setOpenForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<FullProduct | undefined>(undefined);

  const title = useMemo(() => {
    if (!openForm) return "Produits";
    return editing?.id ? `Modifier produit #${editing.id}` : "Ajouter un produit";
  }, [openForm, editing?.id]);

  const loadShops = useCallback(async (vendorMode: boolean) => {
    try {
      if (vendorMode) {
        const rMine = await api.get("/api/shops/mine");
        const rows = asArray(unwrap<any>(rMine));
        if (rows.length) return rows as Shop[];
      }
    } catch {}

    const r = await api.get("/api/shops");
    return asArray(unwrap<any>(r)) as Shop[];
  }, []);

  const loadCatalogs = useCallback(
    async (vendorMode: boolean) => {
      const [cats, subs, sh] = await Promise.all([
        listCategories(),
        listSubCategories(),
        loadShops(vendorMode),
      ]);

      const catsArr = asArray(unwrap<any>(cats)) as Category[];
      setCategories((catsArr || []).map((c: any) => ({ ...c, id: Number(c.id) })));

      const subsArr = asArray(unwrap<any>(subs));
      const mappedSubs: SubCategory[] = (subsArr || []).map((x: any) => ({
        id: Number(x.id),
        category_id: Number(x.category_id),
        name: String(x.name ?? ""),
        slug: String(x.slug ?? ""),
        category_name: x.category_name ?? null,
        category_slug: x.category_slug ?? null,
        vertical: normalizeVertical(x.vertical) || null,
      }));
      setSubCategories(mappedSubs);

      const shArr = asArray(sh);
      const mappedShops: Shop[] = (shArr || []).map((s: any) => ({
        ...s,
        id: Number(s.id),
        name: String(s.name ?? ""),
      }));
      setShops(mappedShops);
    },
    [loadShops]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const res: any = await listManageProducts({
        page,
        pageSize,
        onlyActive: false,
        q: q.trim() || undefined,
      });

      const data = unwrap<any>(res);
      const rows = asArray(data);

      const mapped = (rows || []).map((p: any) => ({
        ...p,
        vertical: verticalFromProduct(p) || p?.vertical || p?.type || p?.style || null,
      }));

      const infoRaw = data?.pageInfo || data?.page_info || {};
      const total = Math.max(0, toInt(infoRaw.total, mapped.length));
      const size = Math.max(1, toInt(infoRaw.pageSize, pageSize));
      const pages = Math.max(1, toInt(infoRaw.pages, Math.ceil(total / size)));
      const currentPage = Math.min(Math.max(1, toInt(infoRaw.page, page)), pages);

      setItems(mapped);
      setPageInfo({
        page: currentPage,
        pageSize: size,
        total,
        pages,
      });

      if (currentPage !== page) {
        setPage(currentPage);
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  useEffect(() => {
    (async () => {
      setBooting(true);
      setErr(null);
      try {
        const u = unwrap(await me());
        setUser(u || null);

        const uRole = String(u?.role || "").toUpperCase();
        const vendorMode =
          scope === "vendor" ||
          uRole === "VENDOR" ||
          uRole === "VENDEUR" ||
          uRole === "SELLER" ||
          uRole === "BOUTIQUE" ||
          uRole === "SHOP" ||
          uRole === "RESTAURANT";

        await loadCatalogs(vendorMode);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setBooting(false);
      }
    })();
  }, [loadCatalogs, scope]);

  useEffect(() => {
    if (booting) return;
    refresh();
  }, [booting, refresh]);

  const onDelete = useCallback(
    async (id: number) => {
      if (!confirm("Supprimer ce produit ?")) return;
      await removeProduct(id);
      await refresh();
    },
    [refresh]
  );

  const onToggleActive = useCallback(
    async (p: Product) => {
      const next = isActive(p) ? 0 : 1;
      await updateProduct((p as any).id, { is_active: next } as any, [], false);
      await refresh();
    },
    [refresh]
  );

  const loadProductById = useCallback(async (id: number) => {
    const r = await api.get(`/api/products/manage/${id}`);
    const p = unwrap<any>(r);

    const normalizedVertical = verticalFromProduct(p);

    const mapped: FullProduct = {
      ...(p || {}),
      id: Number(p.id),
      shop_id: p.shop_id != null ? Number(p.shop_id) : null,
      category_id: p.category_id != null ? Number(p.category_id) : null,
      sub_category_id: p.sub_category_id != null ? Number(p.sub_category_id) : null,
      price: p.price != null ? Number(p.price) : null,
      stock: p.stock != null ? Number(p.stock) : null,
      promo_discount_value: p.promo_discount_value != null ? Number(p.promo_discount_value) : null,
      images: Array.isArray(p?.images) ? (p.images as ProductImage[]) : [],
      vertical: normalizedVertical || p?.vertical || p?.type || p?.style || null,
    } as any;

    return mapped;
  }, []);

  const openCreate = useCallback(() => {
    setFormErr(null);
    setEditing(undefined);
    setOpenForm(true);
  }, []);

  const openEdit = useCallback(
    async (id: number) => {
      setFormErr(null);
      setFormLoading(true);
      setOpenForm(true);
      try {
        const full = await loadProductById(id);
        setEditing(full);
      } catch (e: any) {
        setFormErr(e?.message || String(e));
      } finally {
        setFormLoading(false);
      }
    },
    [loadProductById]
  );

  useEffect(() => {
    if (booting) return;
    const editId = searchParams.get("edit");
    if (!editId) return;
    const n = Number(editId);
    if (!n) return;
    openEdit(n);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, searchParams]);

  const closeForm = useCallback(() => {
    setOpenForm(false);
    setEditing(undefined);
    setFormErr(null);
    setFormLoading(false);
  }, []);

  const onCreateCategory = useCallback(async (name: string, vertical: Vertical) => {
    const v = normalizeVertical(vertical) as Vertical | "";
    if (!v) throw new Error("vertical required (FOOD|MARKET|FASHION)");

    const r = await createCategory({
      name: String(name || "").trim(),
      vertical: v as CategoryVertical,
    } as any);

    const created = unwrap<Category>(r);

    const normalized: any = {
      ...created,
      id: Number((created as any)?.id),
      vertical: normalizeVertical((created as any)?.vertical || v) || v,
    };

    setCategories((prev) => [...prev, normalized]);
    return normalized as Category;
  }, []);

  const onCreateSubCategory = useCallback(
    async (categoryId: number, name: string, vertical: Vertical) => {
      const v = normalizeVertical(vertical) as Vertical | "";
      if (!v) throw new Error("vertical required (FOOD|MARKET|FASHION)");

      const r = await createSubCategory({
        category_id: Number(categoryId),
        name: String(name || "").trim(),
        vertical: v as SubVertical,
      } as any);

      const created = unwrap<SvcSubCategory>(r);

      const sc: SubCategory = {
        id: Number((created as any).id),
        category_id: Number((created as any).category_id ?? categoryId),
        name: String((created as any).name ?? name),
        slug: String((created as any).slug ?? ""),
        category_name: (created as any).category_name ?? null,
        category_slug: (created as any).category_slug ?? null,
        vertical: normalizeVertical((created as any).vertical || v) || v,
      };

      setSubCategories((prev) => [...prev, sc]);
      return sc;
    },
    []
  );

  const createOrUpdate = useCallback(
    async (draft: Draft, files: File[], replaceImages: boolean, variants: VariantDraft[]) => {
      setFormErr(null);

      const fd = new FormData();
      const put = (k: string, v: any) => {
        if (v === undefined || v === null || v === "") return;
        fd.append(k, String(v));
      };

      const vFromDraft =
        normalizeVertical((draft as any).vertical) || mapDraftStyleToVertical((draft as any).style);
      const vFromEditing = verticalFromProduct(editing as any);
      const vertical = (vFromDraft || vFromEditing) as Vertical | "";

      if (!vertical) throw new Error("vertical required (FOOD|MARKET|FASHION)");
      put("vertical", vertical);

      put("name", draft.name);
      put("brand", draft.brand);
      put("price", draft.price);
      put("supplier_price_ht", draft.supplier_price_ht);
      put("partner_price_ht", draft.partner_price_ht);
      put("currency", draft.currency || "MAD");
      put("description", draft.description);
      put("conditionnement", draft.conditionnement);
      put("stock", draft.stock);

      put("is_featured", draft.is_featured);
      put("promo_eligible", draft.promo_eligible);

      put("category_id", draft.category_id);
      put("sub_category_id", draft.sub_category_id);

      put("shop_id", draft.shop_id);

      put("promo_discount_type", draft.promo_discount_type || "PERCENT");
      put("promo_discount_value", draft.promo_discount_value);
      put("promo_free_delivery", draft.promo_free_delivery);

      if (draft.is_active != null) put("is_active", draft.is_active);

      fd.append("replace_images", replaceImages ? "true" : "false");
      for (const f of files || []) fd.append("images[]", f);

      const cleaned = cleanVariantsForApi(variants || []);
      fd.append("variants", JSON.stringify(cleaned));

      const editingId = Number(editing?.id || 0);

      try {
        if (editingId) {
          await api.put(`/api/products/${editingId}`, fd);
        } else {
          await api.post(`/api/products`, fd);
        }

        closeForm();
        await refresh();
      } catch (e: any) {
        setFormErr(e?.message || String(e));
        throw e;
      }
    },
    [closeForm, editing, isVendor, refresh]
  );

  if (booting) {
    return (
      <div className="container-xxl py-4">
        <PageLoader />
      </div>
    );
  }

  const canPrev = page > 1;
  const canNext = page < pageInfo.pages;

  return (
    <div className="container-xxl py-4">
      <style>{`
        .duu-thumb{
          width:44px; height:44px; object-fit:cover;
          border-radius:12px; border:1px solid rgba(0,0,0,.10);
          background: rgba(0,0,0,.04);
        }
        .row-click{ cursor:pointer; }
        .row-click:hover{ background: rgba(0,0,0,.02); }
      `}</style>

      <PageHeader
        title={isVendor ? "Mes produits" : "Gestion des produits"}
        subtitle={loading ? "Chargement…" : `${pageInfo.total} produit(s)`}
        right={
          <>
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder="Rechercher (nom, description, boutique)…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />

            <select
              className="form-select"
              style={{ width: 120 }}
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>

            <button className="btn btn-duu-orange" onClick={openCreate}>
              + Ajouter
            </button>
            <button className="btn btn-outline-dark" onClick={refresh} disabled={loading}>
              Rafraîchir
            </button>
          </>
        }
      />

      {err ? <div className="alert alert-danger py-2 mb-3">{err}</div> : null}

      <div
        className="card border-0"
        style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
      >
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Image</th>
                <th>ID</th>
                <th>Produit</th>
                {!isVendor && <th>Boutique</th>}
                <th>Prix</th>
                <th>Prix Fournisseur HT</th>
                <th>Statut</th>
                <th className="text-end" style={{ width: 320 }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isVendor ? 8 : 9} className="text-muted p-3">
                    <LoadingState size="sm" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isVendor ? 8 : 9} className="text-muted p-3">
                    Aucun produit.
                  </td>
                </tr>
              ) : (
                items.map((p: any) => {
                  const base = basePriceForAdmin(p);
                  const rawImg =
                    p?.cover || p?.image || p?.image_url || p?.thumb || p?.images?.[0]?.url || null;

                  const src = rawImg ? safeImgUrl(String(rawImg)) : "";
                  const vert = verticalFromProduct(p);

                  return (
                    <tr key={p.id} className="row-click" onClick={() => openEdit(Number(p.id))}>
                      <td onClick={(e) => e.stopPropagation()}>
                        {src ? (
                          <img src={src} alt={p.name} className="duu-thumb" />
                        ) : (
                          <div className="duu-thumb d-flex align-items-center justify-content-center text-muted">
                            —
                          </div>
                        )}
                      </td>

                      <td>#{p.id}</td>

                      <td>
                        <div className="fw-semibold d-flex align-items-center gap-2 flex-wrap">
                          <span>{p.name}</span>
                          {vert ? <span className="badge text-bg-light border">{vert}</span> : null}
                        </div>
                        <div className="small text-muted">
                          {p?.sub_category_name || p?.sub_category ? (
                            <span className="badge text-bg-light border">
                              {p.sub_category_name || p.sub_category}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {!isVendor && <td>{p.shop_name || "-"}</td>}

                      <td>{moneyMAD(base)}</td>

                      <td>
                        {p.supplier_price_ht != null ? (
                          <>
                            <div>{moneyMAD(Number(p.supplier_price_ht))}</div>
                            <div
                              className={`small ${
                                base - Number(p.supplier_price_ht) >= 0
                                  ? "text-success"
                                  : "text-danger"
                              }`}
                            >
                              Marge : {moneyMAD(base - Number(p.supplier_price_ht))}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td>
                        {isActive(p) ? (
                          <span className="badge bg-success">Actif</span>
                        ) : (
                          <span className="badge bg-secondary">Off</span>
                        )}
                      </td>

                      <td className="text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-end gap-2 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() => openEdit(Number(p.id))}
                          >
                            Modifier
                          </button>

                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() => setQrProduct({ id: Number(p.id), name: p.name })}
                          >
                            Étiquettes QR
                          </button>

                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => onToggleActive(p)}
                          >
                            {isActive(p) ? "Désactiver" : "Activer"}
                          </button>

                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDelete(p.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="small text-muted">
            Page <b>{pageInfo.page}</b> / <b>{pageInfo.pages}</b> • {pageInfo.total} total •{" "}
            {pageInfo.pageSize}/page
          </div>

          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev || loading}
            >
              ← Précédent
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPage((p) => Math.min(pageInfo.pages, p + 1))}
              disabled={!canNext || loading}
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={openForm}
        title={title}
        onClose={closeForm}
        size="xl"
        footer={
          <button className="btn btn-outline-secondary" onClick={closeForm} disabled={formLoading}>
            Fermer
          </button>
        }
      >
        {formErr ? <div className="alert alert-danger py-2">{formErr}</div> : null}

        {formLoading ? (
          <LoadingState label="Chargement du produit…" />
        ) : (
          <ProductForm
            initial={editing}
            categories={categories}
            subCategories={subCategories}
            shops={shops}
            isVendor={isVendor}
            onCreateCategory={onCreateCategory}
            onCreateSubCategory={onCreateSubCategory}
            onSubmit={createOrUpdate}
            onCancel={closeForm}
          />
        )}
      </Modal>

      <QrLabelsModal
        open={!!qrProduct}
        onClose={() => setQrProduct(null)}
        productId={qrProduct?.id || 0}
        productName={qrProduct?.name || ""}
      />
    </div>
  );
}