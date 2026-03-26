// src/pages/AfricanMarket.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import ProductCard from "../components/ProductCard";
import CategoriesMenu from "../components/CategoriesMenu";
import { listManageProducts, listProducts, type Product } from "../services/products";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";
import { useLocationCity } from "../context/LocationContext";
import { useViewer } from "../hooks/useViewer";

function GridSkeleton() {
  return (
    <div className="row g-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={i}>
          <div className="card h-100 border-0 shadow-sm am-skeleton-card">
            <div
              className="placeholder w-100"
              style={{ aspectRatio: "1 / 1", borderRadius: "20px 20px 0 0" }}
            />
            <div className="card-body">
              <div className="placeholder col-8 mb-2" />
              <div className="placeholder col-6 mb-2" />
              <div className="placeholder col-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const out = arr.slice();
  const rand = mulberry32(hashSeed(seedStr));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const RANDOM_WINDOW_HOURS = 5;
function getWindowKey(now = Date.now()) {
  const win = RANDOM_WINDOW_HOURS * 60 * 60 * 1000;
  return Math.floor(now / win);
}

type Channel = "african-market";
type SortMode = "relevance" | "price-asc" | "price-desc" | "name-asc";

function isPromoProduct(p: Product) {
  const x = p as any;

  if (x.is_promo === true || x.promo === true || x.on_promo === true) return true;

  const promoPercent =
    Number(x.promo_percent ?? x.discount_percent ?? x.percent_off ?? 0) || 0;
  const promoAmount =
    Number(x.promo_amount ?? x.discount_amount ?? x.amount_off ?? 0) || 0;
  if (promoPercent > 0 || promoAmount > 0) return true;

  const price = Number(x.price_client ?? x.price ?? 0) || 0;
  const promoPrice =
    Number(x.promo_price_client ?? x.promo_price ?? x.price_promo ?? x.sale_price ?? 0) || 0;
  if (promoPrice > 0 && price > 0 && promoPrice < price) return true;

  if (String(x.promo_type || x.discount_type || "").trim()) {
    const v = Number(x.promo_value ?? x.discount_value ?? 0) || 0;
    if (v > 0) return true;
  }

  return false;
}

function uniqById(list: Product[]) {
  const seen = new Set<number>();
  const out: Product[] = [];
  for (const p of list) {
    const id = Number((p as any).id || 0);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

function productPrice(p: Product) {
  const x = p as any;
  return Number(
    x.promo_price_client ??
      x.promo_price ??
      x.price_promo ??
      x.sale_price ??
      x.price_client ??
      x.price ??
      0,
  ) || 0;
}

export default function AfricanMarket() {
  const { city } = useLocationCity();
  const navigate = useNavigate();
  const params = useParams();
  const viewer = useViewer();

  const categorySlugParam = (params as any)?.categorySlug
    ? String((params as any).categorySlug).trim().toLowerCase()
    : "";

  const subSlugParam = (params as any)?.subCategorySlug
    ? String((params as any).subCategorySlug).trim().toLowerCase()
    : "";

  const [items, setItems] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const abortProductsRef = useRef<AbortController | null>(null);
  const abortMetaRef = useRef<AbortController | null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);

  const loadMeta = useCallback(async () => {
    abortMetaRef.current?.abort();
    const ac = new AbortController();
    abortMetaRef.current = ac;

    setLoadingMeta(true);
    setError(null);

    try {
      const [resCats, resSubs] = await Promise.all([
        listCategories({ page: 1, pageSize: 500 }),
        listSubCategories({ page: 1, pageSize: 2000 }),
      ]);

      if (ac.signal.aborted) return;

      setAllCategories(resCats.items || []);
      setAllSubCategories(resSubs.items || []);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    return () => abortMetaRef.current?.abort();
  }, [loadMeta]);

  const loadProducts = useCallback(async () => {
    abortProductsRef.current?.abort();
    const ac = new AbortController();
    abortProductsRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      if (viewer.loading) return;

      const isAdmin = viewer.role === "ADMIN";
      const isPro =
        viewer.role === "VENDEUR" || viewer.role === "RESTAURANT" || viewer.role === "FOURNISSEUR";

      let resProducts: any;

      if (isAdmin) {
        resProducts = await listManageProducts({
          page,
          pageSize,
          onlyActive: true,
          vertical: "MARKET",
        } as any);
      } else if (isPro) {
        const shopId = Number(viewer.actingShopId || 0) || null;
        if (!shopId) {
          setItems([]);
          setTotal(0);
          setError("Aucune boutique active. Sélectionne une boutique avant de voir tes produits.");
          return;
        }

        resProducts = await listManageProducts({
          page,
          pageSize,
          onlyActive: true,
          vertical: "MARKET",
          shop_id: shopId,
        } as any);
      } else {
        resProducts = await listProducts({
          page,
          pageSize,
          channel: "african-market" as Channel,
          onlyActive: true,
        } as any);
      }

      if (ac.signal.aborted) return;

      const rawItems = resProducts.items || [];
      const windowKey = getWindowKey();

      const seedStr = [
        "african-market",
        `win:${windowKey}`,
        `city:${city || "all"}`,
        `page:${page}`,
        `cat:${categorySlugParam || "all"}`,
        `sub:${subSlugParam || "all"}`,
        `role:${String(viewer.role || "guest")}`,
        `shop:${String(viewer.actingShopId || "none")}`,
      ].join("|");

      setItems(seededShuffle(rawItems, seedStr));
      setTotal(resProducts.pageInfo?.total ?? 0);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [
    page,
    pageSize,
    city,
    categorySlugParam,
    subSlugParam,
    viewer.loading,
    viewer.role,
    viewer.actingShopId,
  ]);

  useEffect(() => {
    loadProducts();
    return () => abortProductsRef.current?.abort();
  }, [loadProducts]);

  const refresh = useCallback(() => {
    loadProducts();
    if (!allCategories.length || !allSubCategories.length) loadMeta();
  }, [loadProducts, loadMeta, allCategories.length, allSubCategories.length]);

  const categoriesAll = useMemo(() => {
    const out = [...allCategories];
    out.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    return out;
  }, [allCategories]);

  const subCategoriesAll = useMemo(() => {
    const out = [...allSubCategories];
    out.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    return out;
  }, [allSubCategories]);

  const categoriesById = useMemo(() => {
    const map: Record<number, Category> = {};
    for (const c of categoriesAll) map[c.id] = c;
    return map;
  }, [categoriesAll]);

  const categoriesBySlug = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categoriesAll) map[String((c as any).slug || "").toLowerCase()] = c;
    return map;
  }, [categoriesAll]);

  const subById = useMemo(() => {
    const map: Record<number, SubCategory> = {};
    for (const s of subCategoriesAll) map[(s as any).id] = s;
    return map;
  }, [subCategoriesAll]);

  const subsByCatId = useMemo(() => {
    const m: Record<number, SubCategory[]> = {};
    for (const s of subCategoriesAll) {
      const cid = Number((s as any).category_id || 0);
      if (!cid) continue;
      if (!m[cid]) m[cid] = [];
      m[cid].push(s);
    }
    Object.keys(m).forEach((k) => {
      m[Number(k)].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    });
    return m;
  }, [subCategoriesAll]);

  const selectedCategory = useMemo(() => {
    if (!categorySlugParam) return null;
    return categoriesBySlug[categorySlugParam] || null;
  }, [categorySlugParam, categoriesBySlug]);

  const selectedSubCategory = useMemo(() => {
    if (!subSlugParam || !selectedCategory) return null;
    const list = subsByCatId[(selectedCategory as any).id] || [];
    return list.find((s) => String((s as any).slug || "").toLowerCase() === subSlugParam) || null;
  }, [subSlugParam, selectedCategory, subsByCatId]);

  useEffect(() => {
    if (!categoriesAll.length) return;
    if (categorySlugParam && !selectedCategory) {
      navigate("/african-market", { replace: true });
    }
  }, [categoriesAll.length, categorySlugParam, selectedCategory, navigate]);

  const filteredBySearch = useMemo(() => {
    if (!qDebounced) return items;
    return items.filter((p) => (p.name || "").toLowerCase().includes(qDebounced));
  }, [items, qDebounced]);

  const filtered = useMemo(() => {
    let out = filteredBySearch;

    if (selectedCategory) {
      out = out.filter((p) => {
        const cid = Number((p as any).category_id || 0);
        if (!cid) return false;
        const c = categoriesById[cid];
        return (
          c &&
          String((c as any).slug || "").toLowerCase() ===
            String((selectedCategory as any).slug || "").toLowerCase()
        );
      });
    }

    if (selectedSubCategory) {
      out = out.filter((p) => {
        const sid = Number((p as any).sub_category_id || 0);
        if (!sid) return false;
        const s = subById[sid];
        return (
          s &&
          String((s as any).slug || "").toLowerCase() ===
            String((selectedSubCategory as any).slug || "").toLowerCase()
        );
      });
    }

    return out;
  }, [filteredBySearch, selectedCategory, selectedSubCategory, categoriesById, subById]);

  const promoItems = useMemo(() => uniqById(filtered.filter(isPromoProduct)), [filtered]);

  const promoIds = useMemo(() => {
    const s = new Set<number>();
    for (const p of promoItems) s.add(Number((p as any).id || 0));
    return s;
  }, [promoItems]);

  const normalItems = useMemo(() => {
    if (!promoItems.length) return filtered;
    return filtered.filter((p) => !promoIds.has(Number((p as any).id || 0)));
  }, [filtered, promoItems.length, promoIds]);

  const sortedPromoItems = useMemo(() => {
    const list = [...promoItems];
    if (sortMode === "price-asc") list.sort((a, b) => productPrice(a) - productPrice(b));
    else if (sortMode === "price-desc") list.sort((a, b) => productPrice(b) - productPrice(a));
    else if (sortMode === "name-asc") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
    }
    return list;
  }, [promoItems, sortMode]);

  const sortedNormalItems = useMemo(() => {
    const list = [...normalItems];
    if (sortMode === "price-asc") list.sort((a, b) => productPrice(a) - productPrice(b));
    else if (sortMode === "price-desc") list.sort((a, b) => productPrice(b) - productPrice(a));
    else if (sortMode === "name-asc") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
    }
    return list;
  }, [normalItems, sortMode]);

  const title = useMemo(() => {
    if (selectedSubCategory) return (selectedSubCategory as any).name || "Produits";
    if (selectedCategory) return (selectedCategory as any).name || "Produits";
    return "African Market";
  }, [selectedCategory, selectedSubCategory]);

  const subtitle = useMemo(() => {
    if (selectedSubCategory) {
      return "Découvre une sélection ciblée de produits de cette sous-catégorie.";
    }
    if (selectedCategory) {
      return "Explore les meilleurs produits de cette catégorie avec livraison simple et rapide.";
    }
    return "Épicerie, boissons, cosmétiques, accessoires et bien plus encore.";
  }, [selectedCategory, selectedSubCategory]);

  const activeCategoryId = (selectedCategory as any)?.id ?? null;
  const activeSubCategoryId = (selectedSubCategory as any)?.id ?? null;

  const showFiltersBar = !!selectedCategory || !!selectedSubCategory;
  const loadingAny = loading || loadingMeta || viewer.loading;

  const totalShown = sortedPromoItems.length + sortedNormalItems.length;

  return (
    <section className="container-xxl am-page py-3 py-md-4">
      <style>{`
        .am-page{
          padding-bottom: 96px;
        }

        .am-skeleton-card{
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.06);
          background: #fff;
        }

        .btn-duu{
          background: var(--duu-yellow);
          color: #111;
          border: none;
          font-weight: 900;
          border-radius: 14px;
        }
        .btn-duu:hover{ filter: brightness(.97); }
        .btn-duu:focus,
        .btn-duu:focus-visible{
          outline: none !important;
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .35) !important;
        }

        .am-hero{
          border-radius: 24px;
          border: 1px solid rgba(0,0,0,.08);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.08), transparent 55%),
            #fff;
          box-shadow: 0 14px 30px rgba(0,0,0,.06);
          padding: 16px;
        }

        .am-kicker{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:7px 12px;
          border-radius:999px;
          background: rgba(var(--duu-yellow-rgb), .18);
          border: 1px solid rgba(0,0,0,.08);
          font-weight: 900;
          color: var(--duu-black);
          font-size: .82rem;
        }

        .am-title{
          color: var(--duu-black);
          font-weight: 950;
          letter-spacing: -.02em;
          margin: 0;
        }

        .am-subtitle{
          color: rgba(0,0,0,.62);
          font-weight: 600;
          line-height: 1.45;
        }

        .am-market-strip{
          margin-top: 12px;
          border-radius: 18px;
          background: linear-gradient(90deg, #111111 0%, #1a1a1a 100%);
          color: #fff;
          padding: 12px 14px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }

        .am-market-strip .lead{
          margin:0;
          font-weight:900;
          font-size:.96rem;
        }

        .am-market-strip .sub{
          margin:2px 0 0;
          font-size:.82rem;
          color: rgba(255,255,255,.72);
        }

        .am-market-badge{
          display:inline-flex;
          align-items:center;
          gap:8px;
          background: var(--duu-yellow);
          color: #111;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .am-toolbar{
          margin-top: 14px;
          display:grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .am-filter-wrap{
          display:flex;
          align-items:center;
          gap:10px;
          min-width:0;
        }

        .am-filter-icon{
          width:46px;
          height:46px;
          border-radius:16px;
          border:1px solid rgba(0,0,0,.10);
          background: rgba(255,255,255,.94);
          display:flex;
          align-items:center;
          justify-content:center;
          flex: 0 0 auto;
          box-shadow: 0 6px 16px rgba(0,0,0,.04);
        }

        .duu-filter-btn .btn,
        .duu-filter-btn .dropdown > .btn,
        .duu-filter-btn > .btn{
          border-color: rgba(0,0,0,.12) !important;
          color: var(--duu-black) !important;
          background: #fff !important;
          font-weight: 900;
          border-radius: 16px !important;
          min-height: 46px;
          padding: 10px 14px !important;
          box-shadow: 0 8px 18px rgba(0,0,0,.04);
        }

        .am-search{
          position: relative;
        }

        .am-search .form-control{
          min-height: 48px;
          border-radius: 16px;
          padding-left: 44px;
          border-color: rgba(0,0,0,.10);
          box-shadow: 0 8px 18px rgba(0,0,0,.04);
        }

        .am-search .form-control:focus{
          border-color: rgba(var(--duu-yellow-rgb), .55);
          box-shadow: 0 0 0 .2rem rgba(var(--duu-yellow-rgb), .25);
        }

        .am-search-icon{
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(0,0,0,.45);
          pointer-events: none;
          z-index: 2;
        }

        .am-clear-btn{
          border-radius: 14px !important;
          font-weight: 900 !important;
        }

        .am-chip-row{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap: 10px;
          margin-top: 14px;
        }

        .filter-chip{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255,255,255,.92);
          font-weight: 800;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          color: var(--duu-black);
          box-shadow: 0 6px 16px rgba(0,0,0,.03);
        }

        .am-soft-btn{
          border: 1px solid rgba(0,0,0,.10);
          background: #fff;
          border-radius: 999px;
          font-weight: 800;
          padding: 8px 12px;
        }

        .am-subcats{
          display:flex;
          flex-wrap:nowrap;
          overflow-x:auto;
          gap: 10px;
          margin-top: 12px;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .am-subcats::-webkit-scrollbar{ display:none; }
        .am-subcats .btn{
          border-radius: 999px;
          font-weight: 800;
          padding: 8px 13px;
          white-space: nowrap;
        }

        .am-topline{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          margin: 18px 0 14px;
        }

        .am-count{
          color: rgba(0,0,0,.58);
          font-size: .92rem;
          font-weight: 800;
        }

        .promo-wrap{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 22px;
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.16), transparent 60%),
            radial-gradient(900px 320px at 90% 10%, rgba(var(--duu-red-rgb),.09), transparent 55%),
            #fff;
          box-shadow: 0 12px 26px rgba(0,0,0,.05);
          overflow: hidden;
        }

        .promo-head{
          padding: 15px 16px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }

        .promo-title{
          font-weight: 950;
          color: var(--duu-black);
          margin: 0;
        }

        .promo-sub{
          color: rgba(0,0,0,.56);
          font-size: .88rem;
          margin-top: 2px;
        }

        .promo-badge{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(var(--duu-red-rgb), .08);
          border: 1px solid rgba(var(--duu-red-rgb), .20);
          font-weight: 900;
          color: var(--duu-red);
          white-space: nowrap;
        }

        .am-empty{
          border: 1px dashed rgba(0,0,0,.14);
          border-radius: 22px;
          background: rgba(255,255,255,.72);
          text-align:center;
          color: rgba(0,0,0,.55);
          padding: 48px 18px;
          font-weight: 700;
        }

        .am-pagination{
          margin-top: 20px;
          display:flex;
          justify-content:flex-end;
          align-items:center;
        }
        .am-pagination .btn-group .btn{
          min-width: 44px;
          border-radius: 14px !important;
          font-weight: 900;
        }

        .am-bottom-bar{
          position: fixed;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          width: min(720px, calc(100% - 22px));
          z-index: 1028;
          background: rgba(17,17,17,.96);
          color: #fff;
          border-radius: 20px;
          box-shadow: 0 18px 40px rgba(0,0,0,.22);
          border: 1px solid rgba(255,255,255,.08);
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .am-bottom-bar-inner{
          display:grid;
          grid-template-columns: 1fr 1fr;
        }

        .am-bottom-btn{
          min-height: 58px;
          border: 0;
          background: transparent;
          color: #fff;
          font-weight: 900;
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 10px;
          position: relative;
        }

        .am-bottom-btn + .am-bottom-btn{
          border-left: 1px solid rgba(255,255,255,.08);
        }

        .am-bottom-btn.active{
          background: rgba(255,208,0,.12);
          color: var(--duu-yellow);
        }

        .am-sort-panel{
          position: fixed;
          left: 50%;
          bottom: 84px;
          transform: translateX(-50%);
          width: min(520px, calc(100% - 22px));
          z-index: 1029;
          background: #fff;
          border-radius: 22px;
          box-shadow: 0 18px 40px rgba(0,0,0,.18);
          border: 1px solid rgba(0,0,0,.08);
          overflow: hidden;
        }

        .am-sort-head{
          padding: 14px 16px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          font-weight: 950;
          color: var(--duu-black);
          background:
            radial-gradient(900px 420px at 15% 0%, rgba(var(--duu-yellow-rgb),.12), transparent 60%),
            #fff;
        }

        .am-sort-option{
          width: 100%;
          border: 0;
          background: #fff;
          text-align: left;
          padding: 14px 16px;
          font-weight: 700;
          color: var(--duu-black);
          border-bottom: 1px solid rgba(0,0,0,.05);
        }

        .am-sort-option.active{
          background: rgba(var(--duu-yellow-rgb), .14);
        }

        .am-sort-overlay{
          position: fixed;
          inset: 0;
          z-index: 1027;
          background: rgba(0,0,0,.28);
          backdrop-filter: blur(2px);
        }

        @media (min-width: 768px){
          .am-toolbar{
            grid-template-columns: minmax(250px, auto) minmax(280px, 440px);
            justify-content: space-between;
            align-items: center;
          }
        }

        @media (min-width: 992px){
          .am-page{
            padding-bottom: 36px;
          }
          .am-bottom-bar,
          .am-sort-panel,
          .am-sort-overlay{
            display:none !important;
          }
        }
      `}</style>

      <div className="am-hero">
        <div className="d-flex flex-column gap-2">
          <div className="am-kicker">🛒 DUUMINI Market</div>

          <div className="d-flex flex-column gap-2">
            <h1 className="h3 am-title">{title}</h1>
            <div className="am-subtitle">{subtitle}</div>

            {(viewer.role === "ADMIN" ||
              viewer.role === "VENDEUR" ||
              viewer.role === "RESTAURANT" ||
              viewer.role === "FOURNISSEUR") && (
              <div className="small text-muted mt-1">
                {viewer.role === "ADMIN"
                  ? "Mode admin : catalogue MARKET (manage)."
                  : viewer.actingShopId
                    ? `Mode pro : produits MARKET de la boutique #${viewer.actingShopId}.`
                    : "Mode pro : aucune boutique active."}
              </div>
            )}
          </div>


          <div className="am-toolbar">
            <div className="am-filter-wrap duu-filter-btn">
              <span className="am-filter-icon" aria-hidden="true">
                <SlidersHorizontal size={18} />
              </span>

              <CategoriesMenu
                scope="african-market"
                title="Filtrer"
                variant="auto"
                activeCategoryId={activeCategoryId}
                activeSubCategoryId={activeSubCategoryId}
                onSelectCategory={(c) => {
                  setPage(1);
                  navigate(`/african-market/${(c as any).slug}`);
                }}
                onSelectSubCategory={(s) => {
                  setPage(1);
                  const cat = categoriesById[Number((s as any).category_id || 0)];
                  const catSlug = (cat as any)?.slug || (selectedCategory as any)?.slug || "";
                  if (!catSlug) return;
                  navigate(`/african-market/${catSlug}/${(s as any).slug}`);
                }}
              />
            </div>

            <div className="input-group am-search">
              <span className="am-search-icon">
                <Search size={16} />
              </span>

              <input
                className="form-control"
                placeholder="Rechercher un produit…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                aria-label="Rechercher"
              />

              <button
                className="btn btn-duu am-clear-btn"
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                disabled={!q}
              >
                Effacer
              </button>
            </div>
          </div>

          {showFiltersBar && (
            <div className="am-chip-row">
              {selectedCategory && (
                <span className="filter-chip">
                  <span style={{ opacity: 0.7 }}>📦</span>
                  {(selectedCategory as any).name}
                </span>
              )}

              {selectedSubCategory && (
                <span className="filter-chip">
                  <span style={{ opacity: 0.7 }}>🏷️</span>
                  {(selectedSubCategory as any).name}
                </span>
              )}

              <button
                type="button"
                className="btn btn-sm am-soft-btn"
                onClick={() => {
                  setPage(1);
                  navigate("/african-market");
                }}
              >
                Tout afficher
              </button>
            </div>
          )}

          {selectedCategory && (
            <div className="am-subcats">
              <button
                type="button"
                className={"btn btn-sm " + (!selectedSubCategory ? "btn-dark" : "btn-outline-dark")}
                onClick={() => {
                  setPage(1);
                  navigate(`/african-market/${(selectedCategory as any).slug}`);
                }}
              >
                Tout
              </button>

              {(subsByCatId[(selectedCategory as any).id] || []).map((s) => {
                const active = (selectedSubCategory as any)?.id === (s as any).id;
                return (
                  <button
                    key={(s as any).id}
                    type="button"
                    className={"btn btn-sm " + (active ? "btn-dark" : "btn-outline-dark")}
                    onClick={() => {
                      setPage(1);
                      navigate(`/african-market/${(selectedCategory as any).slug}/${(s as any).slug}`);
                    }}
                  >
                    {(s as any).name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center mt-3">
          <span>{error}</span>
          <button className="btn btn-duu btn-sm" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}

      {!loadingAny && !error && (
        <div className="am-topline">
          <div className="am-count">{totalShown} produit(s) affiché(s)</div>
        </div>
      )}

      {loadingAny ? (
        <GridSkeleton />
      ) : (
        <>
          {sortedPromoItems.length > 0 && (
            <div className="promo-wrap mb-4">
              <div className="promo-head">
                <div>
                  <h2 className="h6 promo-title">Promos du moment</h2>
                  <div className="promo-sub">Les meilleures offres disponibles en ce moment.</div>
                </div>
                <span className="promo-badge">🔥 {sortedPromoItems.length}</span>
              </div>

              <div className="p-3">
                <div className="row g-3">
                  {sortedPromoItems.slice(0, 12).map((p) => (
                    <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={(p as any).id}>
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sortedNormalItems.length === 0 ? (
            <div className="am-empty">Aucun produit trouvé.</div>
          ) : (
            <div className="row g-3">
              {sortedNormalItems.map((p) => (
                <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={(p as any).id}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loadingAny && pages > 1 && (
        <div className="am-pagination">
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Page précédente"
              title="Page précédente"
            >
              ◀
            </button>

            <span className="btn btn-sm btn-outline-dark disabled">
              {page} / {pages}
            </span>

            <button
              className="btn btn-sm btn-duu"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              aria-label="Page suivante"
              title="Page suivante"
            >
              ▶
            </button>
          </div>
        </div>
      )}

      {sortOpen && (
        <>
          <div className="am-sort-overlay" onClick={() => setSortOpen(false)} />
          <div className="am-sort-panel">
            <div className="am-sort-head">Trier par</div>

            <button
              type="button"
              className={`am-sort-option ${sortMode === "relevance" ? "active" : ""}`}
              onClick={() => {
                setSortMode("relevance");
                setSortOpen(false);
              }}
            >
              Pertinence
            </button>

            <button
              type="button"
              className={`am-sort-option ${sortMode === "price-asc" ? "active" : ""}`}
              onClick={() => {
                setSortMode("price-asc");
                setSortOpen(false);
              }}
            >
              Prix : croissant
            </button>

            <button
              type="button"
              className={`am-sort-option ${sortMode === "price-desc" ? "active" : ""}`}
              onClick={() => {
                setSortMode("price-desc");
                setSortOpen(false);
              }}
            >
              Prix : décroissant
            </button>

            <button
              type="button"
              className={`am-sort-option ${sortMode === "name-asc" ? "active" : ""}`}
              onClick={() => {
                setSortMode("name-asc");
                setSortOpen(false);
              }}
            >
              Nom
            </button>
          </div>
        </>
      )}

      <div className="am-bottom-bar d-lg-none">
        <div className="am-bottom-bar-inner">
          <button
            type="button"
            className={`am-bottom-btn ${showFiltersBar ? "active" : ""}`}
            onClick={() => {
              const btn = document.querySelector(".duu-filter-btn .btn") as HTMLButtonElement | null;
              btn?.click();
            }}
          >
            <SlidersHorizontal size={18} />
            Filtres
          </button>

          <button
            type="button"
            className={`am-bottom-btn ${sortOpen ? "active" : ""}`}
            onClick={() => setSortOpen((v) => !v)}
          >
            <ArrowUpDown size={18} />
            Pertinence
          </button>
        </div>
      </div>
    </section>
  );
}