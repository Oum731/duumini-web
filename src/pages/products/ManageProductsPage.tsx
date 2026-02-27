// src/pages/products/ManageProductsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { me } from "../../services/auth";
import { api, API_BASE } from "../../services/http";

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
} from "../../services/categories";

import { listSubCategories } from "../../services/subCategories";

import ProductForm, {
  type Draft,
  type FullProduct,
  type ProductImage,
  type Shop,
  type SubCategory,
  type VariantDraft,
  cleanVariantsForApi,
  moneyMAD,
  isActive,
  basePriceForAdmin,
} from "./ProductForm";

type Scope = "admin" | "vendor";

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

function safeImgUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
}

/** ✅ Vertical/Style robust (backend may return different keys/values) */
function normalizeVertical(input: any): "FOOD" | "MARKET" | "FASHION" | "" {
  const raw = String(input ?? "")
    .trim()
    .toUpperCase();

  if (!raw) return "";

  // direct
  if (raw === "FOOD" || raw === "MARKET" || raw === "FASHION") return raw;

  // common aliases
  if (raw === "MEAL" || raw === "PLAT" || raw === "RESTAURANT") return "FOOD";
  if (raw === "GROCERY" || raw === "EPICERIE" || raw === "STORE" || raw === "SHOP") return "MARKET";
  if (raw === "CLOTH" || raw === "CLOTHES" || raw === "APPAREL" || raw === "MODE") return "FASHION";

  // sometimes style comes as "food/market/fashion"
  if (raw === "FOOD/DRINKS" || raw === "FOOD&DRINKS") return "FOOD";
  if (raw === "FOOD") return "FOOD";

  return "";
}

function verticalFromProduct(p: any): "FOOD" | "MARKET" | "FASHION" | "" {
  // try many keys without breaking
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

function mapDraftStyleToVertical(style: any): "FOOD" | "MARKET" | "FASHION" | "" {
  const s = String(style ?? "").trim().toUpperCase();
  if (!s) return "";
  // already vertical?
  if (s === "FOOD" || s === "MARKET" || s === "FASHION") return s as any;

  // style values
  if (s === "FOOD") return "FOOD";
  if (s === "MARKET") return "MARKET";
  if (s === "FASHION") return "FASHION";

  if (s === "FOOD") return "FOOD";
  if (s === "MARKET") return "MARKET";
  if (s === "FASHION") return "FASHION";

  // lower-case style
  const low = String(style ?? "").trim().toLowerCase();
  if (low === "food") return "FOOD";
  if (low === "market") return "MARKET";
  if (low === "fashion") return "FASHION";

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

  const maxW =
    size === "sm" ? 520 : size === "md" ? 760 : size === "lg" ? 980 : 1180;

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
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div style={{ overflow: "auto", maxHeight: "calc(92vh - 110px)" }}>
            <div className="p-3">{children}</div>
          </div>

          {footer ? (
            <div className="px-3 py-2 border-top d-flex justify-content-end gap-2">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ManageProductsPage({ scope }: { scope: Scope }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<any>(null);

  // ✅ accepte plusieurs libellés possibles de rôle vendeur
  const roleUp = String(user?.role || "").toUpperCase();
  const isVendor =
    scope === "vendor" ||
    roleUp === "VENDOR" ||
    roleUp === "VENDEUR" ||
    roleUp === "SELLER" ||
    roleUp === "BOUTIQUE" ||
    roleUp === "SHOP";

  // catalog
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  // list UI
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // modal create/edit
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
    } catch {
      // ignore
    }

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
      const res: any = await listManageProducts({ onlyActive: false });
      const data = unwrap<any>(res);
      const rows = asArray(data);

      // ✅ normalise vertical à la liste (utile pour affichage + édition)
      const mapped = (rows || []).map((p: any) => ({
        ...p,
        vertical: verticalFromProduct(p) || p?.vertical || p?.type || p?.style || null,
      }));

      setItems(mapped);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

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
          uRole === "SHOP";

        await loadCatalogs(vendorMode);
        await refresh();
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- pagination client side ----
  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return items || [];
    return (items || []).filter((p: any) => {
      const name = String(p?.name || "").toLowerCase();
      const shop = String(p?.shop_name || p?.shop || "").toLowerCase();
      const id = String(p?.id || "");
      const vert = String(verticalFromProduct(p) || p?.vertical || "").toLowerCase();
      return name.includes(s) || shop.includes(s) || id.includes(s) || vert.includes(s);
    });
  }, [items, q]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pages) setPage(1);
  }, [pages, page]);

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const canPrev = page > 1;
  const canNext = page < pages;

  // ---- CRUD actions ----
  async function onDelete(id: number) {
    if (!confirm("Supprimer ce produit ?")) return;
    await removeProduct(id);
    refresh();
  }

  async function onToggleActive(p: Product) {
    const next = isActive(p) ? 0 : 1;
    await updateProduct((p as any).id, { is_active: next } as any, [], false);
    refresh();
  }

  const loadProductById = useCallback(async (id: number) => {
    // ✅ endpoint détail
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
      promo_discount_value:
        p.promo_discount_value != null ? Number(p.promo_discount_value) : null,
      images: Array.isArray(p?.images) ? (p.images as ProductImage[]) : [],

      // ✅ important: garantir un "vertical" propre pour ProductForm
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

  const closeForm = useCallback(() => {
    setOpenForm(false);
    setEditing(undefined);
    setFormErr(null);
    setFormLoading(false);
  }, []);

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

  const createOrUpdate = useCallback(
    async (draft: Draft, files: File[], replaceImages: boolean, variants: VariantDraft[]) => {
      setFormErr(null);

      const fd = new FormData();
      const put = (k: string, v: any) => {
        if (v === undefined || v === null || v === "") return;
        fd.append(k, String(v));
      };

      // ✅ vertical robuste : prend draft.style, sinon fallback sur editing.vertical
      const vFromDraft = mapDraftStyleToVertical(draft.style);
      const vFromEditing = verticalFromProduct(editing as any);
      const vertical = vFromDraft || vFromEditing;

      if (vertical) put("vertical", vertical);

      put("name", draft.name);
      put("price", draft.price);
      put("currency", draft.currency || "MAD");
      put("description", draft.description);
      put("stock", draft.stock);

      put("is_featured", draft.is_featured);
      put("promo_eligible", draft.promo_eligible);

      put("category_id", draft.category_id);
      put("sub_category_id", draft.sub_category_id);

      // Admin: shop obligatoire, Vendor: shop déduit côté API
      if (!isVendor) put("shop_id", draft.shop_id);

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
        <div className="text-muted">Chargement…</div>
      </div>
    );
  }

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

      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
        <div>
          <h1 className="h4 mb-1">{isVendor ? "Mes produits" : "Gestion des produits"}</h1>
          <div className="text-muted small">
            {loading ? "Chargement…" : `${total} produit(s)`}
          </div>
          {err ? <div className="alert alert-danger py-2 mt-2 mb-0">{err}</div> : null}
        </div>

        <div className="d-flex gap-2 flex-wrap align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            placeholder="Rechercher (nom, boutique, id, vertical)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <button className="btn btn-dark" onClick={openCreate}>
            + Ajouter
          </button>
          <button className="btn btn-outline-secondary" onClick={refresh} disabled={loading}>
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Image</th>
                <th>ID</th>
                <th>Produit</th>
                {!isVendor && <th>Boutique</th>}
                <th>Prix</th>
                <th>Statut</th>
                <th className="text-end" style={{ width: 320 }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isVendor ? 7 : 8} className="text-muted p-3">
                    Chargement…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={isVendor ? 7 : 8} className="text-muted p-3">
                    Aucun produit.
                  </td>
                </tr>
              ) : (
                pageItems.map((p: any) => {
                  const base = basePriceForAdmin(p);
                  const rawImg =
                    p?.cover ||
                    p?.image ||
                    p?.image_url ||
                    p?.thumb ||
                    p?.images?.[0]?.url ||
                    null;

                  const src = rawImg ? safeImgUrl(String(rawImg)) : "";
                  const vert = verticalFromProduct(p);

                  return (
                    <tr
                      key={p.id}
                      className="row-click"
                      onClick={() => openEdit(Number(p.id))}
                    >
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
                          {vert ? (
                            <span className="badge text-bg-light border">
                              {vert}
                            </span>
                          ) : null}
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
            Page <b>{page}</b> / <b>{pages}</b> • {total} total
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
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
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
          <button
            className="btn btn-outline-secondary"
            onClick={closeForm}
            disabled={formLoading}
          >
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
    </div>
  );
}