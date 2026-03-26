import { useEffect, useMemo, useState } from "react";
import { ChevronRight, X } from "lucide-react";
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

function scopeToCategorySlugFallback(
  scope: PageScope,
): "" | "african-food" | "african-market" | "fashion" | "food" | "market" {
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
  title = "Filtres",
  variant = "auto",
  scope = "all",
}: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => {
    setOpenCatId(activeCategoryId);
  }, [scope, activeCategoryId]);

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
    if (loading) {
      return <div className="text-muted small">Chargement…</div>;
    }

    if (err) {
      return <div className="alert alert-danger py-2 mb-0">{err}</div>;
    }

    if (!catsFiltered.length) {
      return <div className="text-muted small">Aucune catégorie.</div>;
    }

    return (
      <div className="d-flex flex-column">
        {catsFiltered.map((c) => {
          const isOpen = openCatId === c.id;
          const isActive = Number(activeCategoryId || 0) === c.id;
          const children = subsByCat.get(c.id) || [];

          return (
            <div
              key={c.id}
              className="border-bottom"
              style={{ borderColor: "rgba(17,17,17,.08)" }}
            >
              <button
                type="button"
                className="w-100 border-0 bg-white d-flex align-items-center justify-content-between text-start px-3 py-3"
                onClick={() => {
                  toggleCategory(c.id);
                  handlePickCategory(c);
                }}
                style={{
                  color: "var(--duu-black)",
                  fontWeight: isActive ? 800 : 600,
                }}
              >
                <span className="text-truncate pe-3">{c.name}</span>
                <ChevronRight
                  size={18}
                  style={{
                    color: isActive || isOpen ? "var(--duu-black)" : "rgba(17,17,17,.45)",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform .18s ease",
                    flexShrink: 0,
                  }}
                />
              </button>

              {isOpen && (
                <div
                  className="px-3 pb-3"
                  style={{ background: "rgba(255,208,0,.08)" }}
                >
                  {children.length ? (
                    <div className="d-flex flex-column gap-2 pt-1">
                      {children.map((s) => {
                        const sid = Number((s as any).id || 0);
                        const isSubActive = Number(activeSubCategoryId || 0) === sid;

                        return (
                          <button
                            key={sid}
                            type="button"
                            className="border-0 rounded-3 text-start px-3 py-2"
                            onClick={() => handlePickSub(s)}
                            style={{
                              background: isSubActive ? "var(--duu-black)" : "#fff",
                              color: isSubActive ? "#fff" : "var(--duu-black)",
                              fontWeight: isSubActive ? 700 : 500,
                              border: "1px solid rgba(17,17,17,.08)",
                              boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                            }}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="small text-muted pt-2">Aucune sous-catégorie.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (ui === "dropdown") {
    return (
      <div className="dropdown">
        <button
          className="btn"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          style={{
            background: "var(--duu-yellow)",
            color: "var(--duu-black)",
            border: "none",
            fontWeight: 800,
            borderRadius: 14,
            padding: "10px 16px",
          }}
        >
          {title}
        </button>

        <div
          className="dropdown-menu p-0 overflow-hidden"
          style={{
            width: 360,
            maxHeight: 520,
            overflowY: "auto",
            border: "1px solid rgba(17,17,17,.08)",
            borderRadius: 18,
            boxShadow: "0 14px 40px rgba(0,0,0,.12)",
          }}
        >
          <div
            className="px-3 py-3 fw-bold"
            style={{
              background: "var(--duu-black)",
              color: "#fff",
              letterSpacing: ".02em",
            }}
          >
            {title}
          </div>
          <CategoryList />
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
        style={{
          background: "var(--duu-yellow)",
          color: "var(--duu-black)",
          border: "none",
          fontWeight: 800,
          borderRadius: 14,
          padding: "10px 16px",
        }}
      >
        {title}
      </button>

      <div
        className={open ? "position-fixed top-0 start-0 w-100 h-100 d-block" : "d-none"}
        style={{
          background: "rgba(0,0,0,.45)",
          zIndex: 1040,
          backdropFilter: "blur(2px)",
        }}
        onClick={() => setOpen(false)}
      />

      <div
        className="position-fixed top-0 start-0 h-100 bg-white shadow"
        style={{
          width: "100%",
          maxWidth: 420,
          zIndex: 1050,
          transform: open ? "translateX(0)" : "translateX(-110%)",
          transition: "transform .24s ease",
          willChange: "transform",
          overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="d-flex align-items-center justify-content-between px-3"
          style={{
            height: 78,
            background: "var(--duu-black)",
            color: "#fff",
          }}
        >
          <div
            className="fw-bold text-uppercase"
            style={{
              fontSize: "1.05rem",
              letterSpacing: ".03em",
            }}
          >
            Toutes les catégories
          </div>

          <button
            type="button"
            className="border-0 bg-transparent p-0 d-inline-flex align-items-center justify-content-center"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            style={{ color: "#fff" }}
          >
            <X size={34} />
          </button>
        </div>

        <div
          style={{
            height: "calc(100% - 78px)",
            overflowY: "auto",
            background: "#fff",
          }}
        >
          <CategoryList />
        </div>
      </div>
    </>
  );
}