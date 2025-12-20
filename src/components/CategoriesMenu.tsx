// src/components/CategoriesMenu.tsx
import { useEffect, useMemo, useState } from "react";
import { listCategories, type Category } from "../services/categories";
import { listSubCategories, type SubCategory } from "../services/subCategories";

type Props = {
  activeCategoryId?: number | null;
  activeSubCategoryId?: number | null;
  onSelectCategory?: (cat: Category) => void;
  onSelectSubCategory?: (sub: SubCategory) => void;
  title?: string;
  variant?: "auto" | "drawer" | "dropdown";
};

export default function CategoriesMenu({
  activeCategoryId = null,
  activeSubCategoryId = null,
  onSelectCategory,
  onSelectSubCategory,
  title = "Filtrer",
  variant = "auto",
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

  // auto => dropdown desktop, drawer mobile
  const ui: "drawer" | "dropdown" = useMemo(() => {
    if (variant === "drawer" || variant === "dropdown") return variant;
    if (typeof window === "undefined") return "drawer";
    return window.matchMedia("(min-width: 992px)").matches ? "dropdown" : "drawer";
  }, [variant]);

  const subsByCat = useMemo(() => {
    const map = new Map<number, SubCategory[]>();
    for (const s of subs) {
      const cid = Number(s.category_id || 0);
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(s);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
      map.set(k, arr);
    }
    return map;
  }, [subs]);

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
    if (!cats.length) return <div className="text-muted small">Aucune catégorie.</div>;

    return (
      <div className="d-flex flex-column gap-2">
        {cats.map((c) => {
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
                        const isSubActive = Number(activeSubCategoryId || 0) === s.id;
                        return (
                          <button
                            key={s.id}
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

  // ======= Drawer (mobile) — ✅ OUVERTURE GAUCHE -> DROITE =======
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

      {/* Overlay normal: NE FERME PAS "LA PAGE" */}
      <div
        className={"position-fixed top-0 start-0 w-100 h-100 " + (open ? "d-block" : "d-none")}
        style={{
          background: "rgba(0,0,0,.45)",
          zIndex: 1040,
        }}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
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
