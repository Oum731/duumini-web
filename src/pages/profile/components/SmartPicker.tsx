import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Check, Plus } from "lucide-react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { titleCase, normKey } from "../helpers/strings";

export function SmartPicker({
  value,
  onSelect,
  loadOptions,
  placeholder = "Rechercher…",
  allowCreate,
  onCreate,
  createLabel,
}: {
  value?: string | null;
  onSelect: (val: string) => void;
  loadOptions: (q: string) => Promise<string[]>;
  placeholder?: string;
  allowCreate?: boolean;
  onCreate?: (val: string) => Promise<void> | void;
  createLabel?: (val: string) => string;
}) {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 250);

  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = titleCase(value || "");
  const wantCreate = useMemo(() => {
    if (!allowCreate) return false;
    const typed = titleCase(q);
    if (!typed) return false;
    const exists = items.some((x) => normKey(x) === normKey(typed));
    return !exists;
  }, [allowCreate, q, items]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);
    loadOptions(dq)
      .then((opts) => {
        if (!mounted) return;
        setItems(opts);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setErr(e?.message || "Impossible de charger la liste.");
        setItems([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [dq, loadOptions]);

  const filtered = useMemo(() => {
    const needle = normKey(q);
    if (!needle) return items;
    return items.filter((o) => normKey(o).includes(needle));
  }, [q, items]);

  return (
    <>
      <div className="input-group mb-3">
        <span className="input-group-text">
          <Search size={16} />
        </span>
        <input
          className="form-control"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        {loading && (
          <span className="input-group-text">
            <Loader2 className="spin" size={16} />
          </span>
        )}
      </div>

      {err && <div className="alert alert-warning py-2">{err}</div>}

      <div
        className="border rounded"
        style={{ maxHeight: "50vh", overflowY: "auto" }}
      >
        <ul className="list-group list-group-flush">
          {allowCreate && wantCreate && (
            <li
              className="list-group-item d-flex align-items-center justify-content-between"
              role="button"
              onClick={async () => {
                const typed = titleCase(q);
                if (!typed) return;
                await onCreate?.(typed);
                onSelect(typed);
              }}
            >
              <span className="d-flex align-items-center gap-2">
                <Plus size={16} />
                {createLabel
                  ? createLabel(titleCase(q))
                  : `Ajouter "${titleCase(q)}"`}
              </span>
              <span className="badge bg-dark">Nouveau</span>
            </li>
          )}

          {filtered.map((opt) => {
            const active = normKey(current) === normKey(opt);
            return (
              <li
                key={opt}
                className={`list-group-item d-flex align-items-center justify-content-between ${
                  active ? "bg-light" : ""
                }`}
                role="button"
                onClick={() => onSelect(opt)}
              >
                <span>{opt}</span>
                {active ? (
                  <span className="badge bg-dark d-inline-flex align-items-center gap-1">
                    <Check size={14} /> Choisi
                  </span>
                ) : null}
              </li>
            );
          })}

          {!loading && !filtered.length && (
            <li className="list-group-item text-muted">Aucun résultat</li>
          )}
        </ul>
      </div>

      <style>{`
        .spin{ animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>
    </>
  );
}
