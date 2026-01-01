// src/components/CategoriesMenu.tsx
import { useEffect, useMemo, useState } from "react";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";

type PageScope = "all" | "african-food" | "african-market" | "fashion";

type Props = {
  activeCategoryId?: number | null;
  activeSubCategoryId?: number | null;
  onSelectCategory?: (cat: Category) => void;
  onSelectSubCategory?: (sub: SubCategory) => void;
  title?: string;
  variant?: "auto" | "drawer" | "dropdown";

  /** Filtrer selon la page */
  scope?: PageScope;
};

function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function scopeToVertical(scope: PageScope): "" | "FOOD" | "MARKET" | "FASHION" {
  if (scope === "african-food") return "FOOD";
  if (scope === "african-market") return "MARKET";
  if (scope === "fashion") return "FASHION";
  return "";
}

function scopeToCategorySlugFallback(scope: PageScope): "" | "african-food" | "african-market" | "fashion" | "food" | "market" {
  // ⚠️ adapte si tes slugs categories sont exactement "food/market/fashion"
  // ou "african-food/african-market/fashion".
  // Ici on accepte les 2.
  if (scope === "african-food") return "food";
  if (scope === "african-market") return "market";
  if (scope === "fashion") return "fashion";
  return "";
}

export default function CategoriesMenu({
  activeCategoryId = null,
  activeSubCategoryId = null,
  onSelectCategory,
  onSelectSubCategory,
  title = "Filtrer",
  variant = "auto",
  scope = "all",
}: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // drawer
  const [open, setOpen] = useState(false);
  const [openCatId, setOpenCatId] = useState<number | null>(activeCategoryId);

  useEffect(() => setOpenCatId(activeCategoryId), [activeCategoryId]);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const catRes = await listCategories({ page: 1, pageSize: 500 });
      const subRes = await listSubCategories({ page: 1, pageSize: 2000 });
      setCats(catRes.items || []);
      setSubs(subRes.items || []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // reset quand scope change
  useEffect(() => {
    setOpenCatId(activeCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // auto => dropdown desktop, drawer mobile
  const ui: "drawer" | "dropdown" = useMemo(() => {
    if (variant === "drawer" || variant === "dropdown") return variant;
    if (typeof window === "undefined") return "drawer";
    return window.matchMedia("(min-width: 992px)").matches ? "dropdown" : "drawer";
  }, [variant]);

  const catsById = useMemo(() => {
    const m: Record<number, Category> = {};
    for (const c of cats || []) m[Number(c.id)] = c;
    return m;
  }, [cats]);

  /**
   * ✅ Filtrage par scope (robuste):
   * 1) Si sub.vertical existe -> on filtre dessus (FOOD/MARKET/FASHION)
   * 2) Sinon fallback: on filtre par slug de catégorie (category_slug join si présent, sinon depuis catsById)
   */
  const filteredSubs = useMemo(() => {
    const wantedVertical = scopeToVertical(scope);
    if (!wantedVertical) return subs || [];

    const wantedSlugFallback = scopeToCategorySlugFallback(scope);

    return (subs || []).filter((s) => {
      const v = norm((s as any).vertical);
      if (v) return v === norm(wantedVertical);

      const catSlugJoin = norm((s as any).category_slug);
      if (catSlugJoin) return catSlugJoin === norm(wantedSlugFallback) || catSlugJoin === norm(scope);

      const cat = catsById[Number((s as any).category_id || 0)];
      const catSlug = norm((cat as any)?.slug);
      if (catSlug) return catSlug === norm(wantedSlugFallback) || catSlug === norm(scope);

      return false;
    });
  }, [subs, scope, catsById]);

  const catsFiltered = useMemo(() => {
    const wantedVertical = scopeToVertical(scope);
    if (!wantedVertical) {
      const sorted = [...(cats || [])];
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
      return sorted;
    }

    const allowedCatIds = new Set<number>();
    for (const s of filteredSubs || []) {
      const cid = Number((s as any).category_id || 0);
      if (cid) allowedCatIds.add(cid);
    }

    const filtered = (cats || []).filter((c) => allowedCatIds.has(Number(c.id)));
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    return filtered;
  }, [cats, filteredSubs, scope]);

  const subsByCat = useMemo(() => {
    const map = new Map<number, SubCategory[]>();
    for (const s of filteredSubs) {
      const cid = Number((s as any).category_id || 0);
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(s);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
      map.set(k, arr);
    }
    return map;
  }, [filteredSubs]);

  useEffect(() => {
    if (!activeCategoryId) return;
    const exists = catsFiltered.some((c) => c.id === Number(activeCategoryId));
    if (!exists) {
      setOpenCatId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catsFiltered]);

  function toggleCategory(catId: number) {
    setOpenCatId((prev) => (prev === catId ? null : catId));
  }

  function handlePickCategory(c: Category) {
    setOpenCatId(c.id);
    onSelectCategory?.(c);
  }

  function handlePickSub(s: SubCategory) {
    onSelectSubCategory?.(s);
    if (ui === "drawer") setOpen(false);
  }

  function CategoryList() {
    if (loading) return <div className="text-muted small">Chargement…</div>;
    if (err) return <div className="alert alert-danger py-2 mb-0">{err}</div>;
    if (!catsFiltered.length) return <div className="text-muted small">Aucune catégorie.</div>;

    return (
      <div className="d-flex flex-column gap-2">
        {catsFiltered.map((c) => {
          const isOpen = openCatId === c.id;
          const isActive = Number(activeCategoryId || 0) === c.id;
          const children = subsByCat.get(c.id) || [];

          return (
            <div
              key={c.id}
              className="border rounded overflow-hidden"
              style={{ borderColor: "rgba(0,0,0,.12)" }}
            >
              <button
                type="button"
                className="btn w-100 text-start d-flex align-items-center justify-content-between"
                onClick={() => {
                  toggleCategory(c.id);
                  handlePickCategory(c);
                }}
                style={{
                  background: isActive ? "var(--duu-yellow)" : "#fff",
                  color: "var(--duu-black)",
                  border: "none",
                }}
              >
                <span className="fw-semibold text-truncate">{c.name}</span>
                <span className="small" style={{ color: "rgba(0,0,0,.55)", marginLeft: 12 }}>
                  {isOpen ? "—" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="p-2" style={{ background: "rgba(0,0,0,.02)" }}>
                  {children.length ? (
                    <div className="d-flex flex-column gap-1">
                      {children.map((s) => {
                        const isSubActive = Number(activeSubCategoryId || 0) === Number((s as any).id);
                        return (
                          <button
                            key={Number((s as any).id)}
                            type="button"
                            className="btn btn-sm text-start"
                            onClick={() => handlePickSub(s)}
                            style={{
                              background: isSubActive ? "var(--duu-red)" : "#fff",
                              color: isSubActive ? "#fff" : "var(--duu-black)",
                              border: "1px solid rgba(0,0,0,.12)",
                            }}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted small">Aucune sous-catégorie.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ======= Dropdown (desktop) =======
  if (ui === "dropdown") {
    return (
      <div className="dropdown">
        <button
          className="btn btn-outline-dark dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          style={{ borderColor: "rgba(0,0,0,.25)", color: "var(--duu-black)" }}
        >
          {title}
        </button>

        <div
          className="dropdown-menu p-2"
          style={{
            width: 340,
            maxHeight: 520,
            overflow: "auto",
            borderColor: "rgba(0,0,0,.12)",
          }}
        >
          <CategoryList />
        </div>
      </div>
    );
  }

  // ======= Drawer (mobile) — gauche -> droite =======
  return (
    <>
      <button
        type="button"
        className="btn btn-outline-dark"
        onClick={() => setOpen(true)}
        style={{ borderColor: "rgba(0,0,0,.25)", color: "var(--duu-black)" }}
      >
        {title}
      </button>

      <div
        className={"position-fixed top-0 start-0 w-100 h-100 " + (open ? "d-block" : "d-none")}
        style={{ background: "rgba(0,0,0,.45)", zIndex: 1040 }}
        onClick={() => setOpen(false)}
      />

      <div
        className="position-fixed top-0 start-0 h-100 bg-white shadow"
        style={{
          width: "min(92vw, 380px)",
          zIndex: 1050,
          transform: open ? "translateX(0)" : "translateX(-110%)",
          transition: "transform .22s ease",
          willChange: "transform",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="d-flex align-items-center justify-content-between border-bottom p-3">
          <div className="fw-bold" style={{ color: "var(--duu-black)" }}>
            {title}
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setOpen(false)}
            style={{
              background: "var(--duu-yellow)",
              border: "none",
              color: "var(--duu-black)",
              fontWeight: 700,
            }}
          >
            Fermer
          </button>
        </div>

        <div className="p-3" style={{ overflowY: "auto", height: "calc(100% - 62px)" }}>
          <CategoryList />
        </div>
      </div>
    </>
  );
}
