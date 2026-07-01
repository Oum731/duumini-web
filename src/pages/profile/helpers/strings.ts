export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normKey(s: string) {
  return stripDiacritics(String(s || ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function titleCase(s: string) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

export function uniqSorted(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const v = String(x || "").trim();
    if (!v) continue;
    const k = normKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  return out;
}

export function normalizeItems(input: any): string[] {
  const arr = input?.items ?? input ?? [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => {
      if (typeof x === "string") return x;
      return x?.value ?? x?.name ?? "";
    })
    .map((s: any) => titleCase(String(s || "")))
    .filter(Boolean);
}
