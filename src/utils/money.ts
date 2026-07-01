const MAD_SCALE = 100;

export function toNum(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function toCents(n: unknown): number {
  return Math.round(toNum(n) * MAD_SCALE);
}

export function fromCents(c: unknown): number {
  return toNum(c) / MAD_SCALE;
}

export function roundToMAD(cents: number): number {
  return Math.round((cents || 0) / MAD_SCALE) * MAD_SCALE;
}

export function moneyMAD(n?: number | null, digits: 0 | 2 = 0): string {
  const safe = toNum(n ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe);
}
