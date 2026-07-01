import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../services/http";
import { me } from "../../services/auth";
import { listCategories, createCategory, type Category } from "../../services/categories";
import { listSubCategories, type SubCategory as SvcSubCategory } from "../../services/subCategories";

import { moneyMAD } from "../../utils/money";
import { imgUrl } from "../../utils/media";
import ProductForm, {
  type Draft,
  type FullProduct,
  type ProductImage,
  type ProductStyle,
  type Shop,
  type SubCategory,
  type VariantDraft,
  cleanVariantsForApi,
  isActive,
  hasRealPromo,
  promoLabel,
  basePriceForAdmin,
  promoPriceForAdmin,
} from "../products/ProductForm";

type AnyObj = Record<string, any>;

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

function unwrap<T = any>(r: any): T {
  return (r?.data ?? r) as T;
}

function toInt(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function asArray<T = any>(x: any): T[] {
  const body = unwrap<any>(x);
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.data?.items)) return body.data.items;
  return [];
}

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  size = "lg",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;

  const maxW = size === "sm" ? 520 : size === "md" ? 760 : size === "xl" ? 1180 : 980;

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

export default function ProductsAdminPage() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AnyObj | null>(null);

  const isVendor =
    String(user?.role || "").toUpperCase() === "VENDOR" ||
    String(user?.role || "").toUpperCase() === "VENDEUR";

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  const [items, setItems] = useState<FullProduct[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageSize: 100,
    total: 0,
    pages: 1,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [style, setStyle] = useState<ProductStyle | "">("");
  const [shopId, setShopId] = useState<number | "">("");
  const [active, setActive] = useState<"" | "1" | "0">("");
  const [promo, setPromo] = useState<"" | "1">("");

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subCategoryId, setSubCategoryId] = useState<number | "">("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const pageSizeOptions = [20, 50, 100, 200, 500, 1000];

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
        const rows = asArray<Shop>(rMine);
        if (rows.length) return rows;
      }
    } catch {}

    const r = await api.get("/api/shops");
    return asArray<Shop>(r);
  }, []);

  const loadCatalogs = useCallback(
    async (vendorMode: boolean) => {
      const [cats, subs, sh] = await Promise.all([
        listCategories(),
        listSubCategories(),
        loadShops(vendorMode),
      ]);

      const catsRows = asArray<Category>(cats).map((c: any) => ({
        ...c,
        id: Number(c.id),
      }));
      setCategories(catsRows);

      const subsRaw = asArray<SvcSubCategory>(subs) as any[];
      const mappedSubs: SubCategory[] = (subsRaw || []).map((x) => ({
        id: Number(x.id),
        category_id: Number(x.category_id),
        name: String(x.name ?? ""),
        slug: String(x.slug ?? ""),
        category_name: x.category_name ?? null,
        category_slug: x.category_slug ?? null,
      }));
      setSubCategories(mappedSubs);

      const mappedShops = (sh || []).map((s: any) => ({
        ...s,
        id: Number(s.id),
        name: String(s.name ?? ""),
      }));
      setShops(mappedShops);

      if (vendorMode && mappedShops.length === 1) {
        setShopId(Number(mappedShops[0].id));
      }
    },
    [loadShops]
  );

  useEffect(() => {
    const run = async () => {
      setBooting(true);
      setErr(null);

      try {
        const u = unwrap(await me());
        setUser(u || null);

        const vendorMode =
          String(u?.role || "").toUpperCase() === "VENDOR" ||
          String(u?.role || "").toUpperCase() === "VENDEUR";

        await loadCatalogs(vendorMode);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setBooting(false);
      }
    };

    run();
  }, [loadCatalogs]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const params: AnyObj = {
        page,
        pageSize,
        pagesize: pageSize,
        page_size: pageSize,
        noCache: 1,
      };

      const qs = String(q || "").trim();
      if (qs) params.q = qs;

      if (style) params.vertical = String(style).toUpperCase();
      if (shopId !== "") params.shop_id = Number(shopId);

      if (active === "1") params.onlyActive = 1;
      if (active === "0") params.onlyActive = 0;

      if (promo === "1") params.onlyPromos = 1;

      if (categoryId !== "") {
        params.category_id = Number(categoryId);
        params.categoryId = Number(categoryId);
      }

      if (subCategoryId !== "") {
        params.sub_category_id = Number(subCategoryId);
        params.subCategoryId = Number(subCategoryId);
      }

      const r = await api.get("/api/products/manage", { params });
      const data = unwrap<any>(r);

      const rows = asArray<any>(data);

      const infoRaw = data?.pageInfo || data?.page_info || {};

      const mapped: FullProduct[] = rows.map((p: any) => ({
        ...(p || {}),
        id: Number(p.id),
        shop_id: p.shop_id != null ? Number(p.shop_id) : null,
        category_id: p.category_id != null ? Number(p.category_id) : null,
        sub_category_id: p.sub_category_id != null ? Number(p.sub_category_id) : null,
        price: p.price != null ? Number(p.price) : null,
        stock: p.stock != null ? Number(p.stock) : null,
        promo_discount_value:
          p.promo_discount_value != null ? Number(p.promo_discount_value) : null,
        images: Array.isArray(p.images) ? (p.images as ProductImage[]) : [],
      }));

      const total = Math.max(
        0,
        toInt(
          infoRaw.total ?? data?.total ?? data?.pageInfo?.total,
          mapped.length
        )
      );

      const size = Math.max(
        1,
        toInt(
          infoRaw.pageSize ??
            infoRaw.page_size ??
            infoRaw.pagesize ??
            data?.pageSize ??
            data?.page_size ??
            data?.pagesize,
          pageSize
        )
      );

      const pages = Math.max(
        1,
        toInt(
          infoRaw.pages ??
            infoRaw.totalPages ??
            data?.pages ??
            data?.totalPages,
          Math.ceil(total / size)
        )
      );

      const currentPage = Math.min(
        Math.max(1, toInt(infoRaw.page ?? data?.page, page)),
        pages
      );

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
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        String(e);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, style, shopId, active, promo, categoryId, subCategoryId]);

  useEffect(() => {
    if (booting) return;
    fetchProducts();
  }, [booting, fetchProducts]);

  const loadProductById = useCallback(async (id: number) => {
    const r = await api.get(`/api/products/manage/${id}`, { params: { noCache: 1 } });
    const p = unwrap<any>(r);

    const mapped: FullProduct = {
      ...(p || {}),
      id: Number(p.id),
      shop_id: p.shop_id != null ? Number(p.shop_id) : null,
      category_id: p.category_id != null ? Number(p.category_id) : null,
      sub_category_id: p.sub_category_id != null ? Number(p.sub_category_id) : null,
      price: p.price != null ? Number(p.price) : null,
      stock: p.stock != null ? Number(p.stock) : null,
      promo_discount_value:
        p.promo_discount_value != null ? Number(p.promo_discount_value) : null,
      images: Array.isArray(p.images) ? (p.images as ProductImage[]) : [],
    };

    return mapped;
  }, []);

  const openCreate = useCallback(() => {
  setFormErr(null);
  setEditing(undefined);

  // Si une seule boutique existe, on la présélectionne automatiquement
  // dans le formulaire de création du produit.
  if (shops.length === 1) {
    const onlyShop = shops[0];

    setEditing({
      shop_id: Number(onlyShop.id),
    } as FullProduct);
  }

  setOpenForm(true);
}, [shops]);

  const openEdit = useCallback(
    async (id: number) => {
      setFormErr(null);
      setFormLoading(true);
      setOpenForm(true);

      try {
        const full = await loadProductById(id);
        setEditing(full);
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          String(e);
        setFormErr(msg);
      } finally {
        setFormLoading(false);
      }
    },
    [loadProductById]
  );

  const closeForm = useCallback(() => {
    setOpenForm(false);
    setEditing(undefined);
    setFormErr(null);
    setFormLoading(false);
  }, []);

  const deleteProduct = useCallback(
    async (p: FullProduct) => {
      if (!confirm(`Supprimer le produit "${p.name}" ?`)) return;

      try {
        await api.delete(`/api/products/${p.id}`);

        if (items.length === 1 && page > 1) {
          setPage((prev) => Math.max(1, prev - 1));
        } else {
          await fetchProducts();
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          String(e);
        alert(msg);
      }
    },
    [fetchProducts, items.length, page]
  );

  const createOrUpdate = useCallback(
    async (
      draft: Draft,
      files: File[],
      replaceImages: boolean,
      variants: VariantDraft[]
    ) => {
      setFormErr(null);

      const fd = new FormData();

      const put = (k: string, v: any) => {
        if (v === undefined || v === null || v === "") return;
        fd.append(k, String(v));
      };

      const vertical = String(draft.style || "").toUpperCase();
      put("vertical", vertical);

      put("name", draft.name);
      put("price", draft.price);
      put("currency", draft.currency || "MAD");
      put("description", draft.description);
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

      put("replace_images", replaceImages ? 1 : 0);

      for (const f of files || []) fd.append("images[]", f);

      const cleaned = cleanVariantsForApi(variants || []);
      fd.append("variants", JSON.stringify(cleaned));

      const editingId = Number(editing?.id || 0);

      try {
        if (editingId) {
          await api.put(`/api/products/${editingId}`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          await api.post(`/api/products`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        closeForm();
        setPage(1);
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          String(e);
        setFormErr(msg);
        throw e;
      }
    },
    [closeForm, editing?.id, isVendor]
  );

  useEffect(() => {
    if (booting) return;
    fetchProducts();
  }, [page, pageSize, booting, fetchProducts]);

  const onCreateCategory = useCallback(async (name: string) => {
    const r = await createCategory(name);
    const created = unwrap<Category>(r);
    setCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const onCreateSubCategory = useCallback(async (categoryId: number, name: string) => {
    const r = await api.post("/api/sub-categories", { category_id: categoryId, name });
    const created = unwrap<any>(r);

    const sc: SubCategory = {
      id: Number(created.id),
      category_id: Number(created.category_id ?? categoryId),
      name: String(created.name ?? name),
      slug: String(created.slug ?? ""),
      category_name: created.category_name ?? null,
      category_slug: created.category_slug ?? null,
    };

    setSubCategories((prev) => [...prev, sc]);
    return sc;
  }, []);

  const totalLabel = useMemo(() => {
    if (loading) return "Chargement…";
    return `${pageInfo.total} produit(s)`;
  }, [loading, pageInfo.total]);

  const pageCanPrev = pageInfo.page > 1;
  const pageCanNext = pageInfo.page < pageInfo.pages;

  const shopOptions = useMemo(() => {
    return [...shops].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "fr", {
        sensitivity: "base",
      })
    );
  }, [shops]);

  const categoryOptions = useMemo(() => {
    return [...categories].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "fr", {
        sensitivity: "base",
      })
    );
  }, [categories]);

  const subCategoryOptions = useMemo(() => {
    const cid = categoryId === "" ? 0 : Number(categoryId);
    const arr = cid
      ? subCategories.filter((s) => Number(s.category_id) === cid)
      : subCategories;

    return [...arr].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "fr", {
        sensitivity: "base",
      })
    );
  }, [subCategories, categoryId]);

  if (booting) {
    return (
      <main className="container py-4">
        <div className="text-muted">Chargement…</div>
      </main>
    );
  }

  return (
    <main className="container py-4">
      <style>{`
        .duu-focus:focus, .duu-focus:focus-visible, .form-control:focus, .form-select:focus{
          outline:none !important;
          box-shadow: 0 0 0 .22rem rgba(253,220,0,.35) !important;
          border-color: rgba(229,57,53,.35) !important;
        }
        .duu-card{ border-radius: 16px; }
        .duu-thumb{
          width:44px;
          height:44px;
          object-fit:cover;
          border-radius: 12px;
          border:1px solid rgba(0,0,0,.10);
        }
      `}</style>

      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
        <div>
          <h4 className="mb-1">Produits</h4>
          <div className="text-muted small">{totalLabel}</div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-dark" onClick={openCreate}>
            + Ajouter
          </button>
          <button className="btn btn-outline-secondary" onClick={fetchProducts} disabled={loading}>
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="card duu-card border-0 bg-light mt-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label">Recherche</label>
              <input
                className="form-control duu-focus"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Nom, boutique, description…"
              />
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label">Type</label>
              <select
                className="form-select duu-focus"
                value={style}
                onChange={(e) => {
                  setStyle((e.target.value as ProductStyle) || "");
                  setPage(1);
                }}
              >
                <option value="">Tous</option>
                <option value="food">Food</option>
                <option value="market">Market</option>
                <option value="fashion">Fashion</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label">Actif</label>
              <select
                className="form-select duu-focus"
                value={active}
                onChange={(e) => {
                  setActive((e.target.value as "" | "1" | "0") || "");
                  setPage(1);
                }}
              >
                <option value="">Tous</option>
                <option value="1">Actifs</option>
                <option value="0">Désactivés</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label">Promo</label>
              <select
                className="form-select duu-focus"
                value={promo}
                onChange={(e) => {
                  setPromo((e.target.value as "" | "1") || "");
                  setPage(1);
                }}
              >
                <option value="">Toutes</option>
                <option value="1">En promo</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label">Boutique</label>
              <select
                className="form-select duu-focus"
                value={shopId === "" ? "" : String(shopId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setShopId(v ? Number(v) : "");
                  setPage(1);
                }}
                disabled={isVendor && shops.length <= 1}
              >
                <option value="">Toutes</option>
                {shopOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Catégorie</label>
              <select
                className="form-select duu-focus"
                value={categoryId === "" ? "" : String(categoryId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setCategoryId(v ? Number(v) : "");
                  setSubCategoryId("");
                  setPage(1);
                }}
              >
                <option value="">Toutes</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Sous-catégorie</label>
              <select
                className="form-select duu-focus"
                value={subCategoryId === "" ? "" : String(subCategoryId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSubCategoryId(v ? Number(v) : "");
                  setPage(1);
                }}
              >
                <option value="">Toutes</option>
                {subCategoryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label">Page size</label>
              <select
                className="form-select duu-focus"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 d-flex gap-2 flex-wrap mt-2">
              <button
                className="btn btn-outline-dark"
                onClick={() => {
                  setQ("");
                  setStyle("");
                  setActive("");
                  setPromo("");
                  setShopId("");
                  setCategoryId("");
                  setSubCategoryId("");
                  setPageSize(100);
                  setPage(1);
                }}
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {err ? <div className="alert alert-danger mt-3 mb-0">{err}</div> : null}

      <div className="card duu-card mt-3">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 70 }}>Image</th>
                  <th>Produit</th>
                  <th style={{ width: 140 }}>Type</th>
                  <th style={{ width: 180 }}>Prix</th>
                  <th style={{ width: 140 }}>Promo</th>
                  <th style={{ width: 120 }}>Statut</th>
                  <th style={{ width: 220 }} className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-muted p-3">
                      Chargement…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-muted p-3">
                      Aucun produit.
                    </td>
                  </tr>
                ) : (
                  items.map((p) => {
                    const base = basePriceForAdmin(p);
                    const promoPrice = promoPriceForAdmin(p);
                    const activeFlag = isActive(p) === 1;

                    const vertical = String((p as any)?.vertical || "")
                      .toUpperCase()
                      .trim();

                    const img =
                      (p as any)?.cover ||
                      (p as any)?.image ||
                      (p as any)?.image_url ||
                      (p as any)?.images?.[0]?.url ||
                      null;

                    return (
                      <tr key={p.id}>
                        <td className="p-2">
                          {img ? (
                            <img src={imgUrl(img)} alt={p.name} className="duu-thumb" />
                          ) : (
                            <div
                              className="duu-thumb d-flex align-items-center justify-content-center text-muted"
                              style={{ background: "rgba(0,0,0,.04)" }}
                            >
                              —
                            </div>
                          )}
                        </td>

                        <td className="p-2">
                          <div className="fw-semibold">{p.name}</div>
                          <div className="small text-muted">
                            #{p.id}
                            {(p as any)?.shop_name ? (
                              <>
                                {" "}
                                •{" "}
                                <span className="badge text-bg-light border">
                                  {(p as any).shop_name}
                                </span>
                              </>
                            ) : null}
                            {(p as any)?.sub_category_name ? (
                              <>
                                {" "}
                                •{" "}
                                <span className="badge text-bg-light border">
                                  {(p as any).sub_category_name}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </td>

                        <td className="p-2">
                          <span className="badge text-bg-dark">{vertical || "—"}</span>
                        </td>

                        <td className="p-2">
                          <div className="fw-semibold">{moneyMAD(base)}</div>
                          {promoPrice != null ? (
                            <div className="small text-muted">
                              Promo: <b>{moneyMAD(promoPrice)}</b>
                            </div>
                          ) : (
                            <div className="small text-muted">—</div>
                          )}
                        </td>

                        <td className="p-2">
                          {hasRealPromo(p) ? (
                            <span className="badge bg-warning text-dark">{promoLabel(p)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        <td className="p-2">
                          {activeFlag ? (
                            <span className="badge bg-success">Actif</span>
                          ) : (
                            <span className="badge bg-secondary">Off</span>
                          )}
                        </td>

                        <td className="p-2 text-end">
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <button
                              className="btn btn-sm btn-outline-dark"
                              onClick={() => openEdit(Number(p.id))}
                            >
                              Modifier
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => deleteProduct(p)}
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
              disabled={!pageCanPrev || loading}
            >
              ← Précédent
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPage((p) => Math.min(pageInfo.pages, p + 1))}
              disabled={!pageCanNext || loading}
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
          <div className="text-muted">Chargement du produit…</div>
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
    </main>
  );
}