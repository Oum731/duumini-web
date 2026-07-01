import { CITY_OPTIONS, type CityCode } from "../../context/LocationContext";
import type { LocationSuggestion, PaymentMethod } from "./types";

export function normalizePaymentMethod(method: PaymentMethod) {
  if (method === "BMCE" || method === "GAZHALA") return "BANK_TRANSFER";
  return "CASH";
}

export function paymentMethodLabel(method: PaymentMethod) {
  if (method === "BMCE") return "BMCE";
  if (method === "GAZHALA") return "GAZHALA";
  return "CASH";
}

export function normalizeSuggestionItems(input: any): LocationSuggestion[] {
  const arr = input?.items ?? input ?? [];
  if (!Array.isArray(arr)) return [];
  if (arr.length && typeof arr[0] === "string") {
    return arr.map((s: string) => ({ value: String(s) }));
  }
  return arr
    .map((x: any) => ({
      value: String(x?.value ?? x?.name ?? "").trim(),
      count: x?.count != null ? Number(x.count) || 0 : undefined,
    }))
    .filter((x: LocationSuggestion) => !!x.value);
}

export function normToken(x: any) {
  return String(x ?? "")
    .trim()
    .toLowerCase();
}

export function productSubToken(p: any) {
  const bySlug = normToken(p?.sub_category_slug);
  if (bySlug) return bySlug;

  const byName = normToken(p?.sub_category_name);
  if (byName) return byName;

  const id = p?.sub_category_id;
  if (id != null && String(id).trim() !== "") return normToken(String(id));

  return "";
}

export function isFoodLike(p: any) {
  const t = productSubToken(p);
  if (t)
    return t === "food" || t.includes("food") || t.includes("alimentation");
  return normToken(p?.category) === "food";
}

export const DELIVERY_RULES = {
  CASABLANCA_FEE: 25,
  DEFAULT_FEE_OUTSIDE_CASA: 0,
  EXPEDITION_DROP_FEE: 0,
};

export const BANK_RIB = {
  account_name: "LE BESOIN GROUP",
  rib: "011 450 0000122100028446 74",
  iban: "MA64 0114 5000 0012 2100 0284 4674",
  bic: "BMCEMAMC",
};

export const GAZHALA_PAYMENT = {
  account_name: "GAZHALA",
  note: "Paiement / dépôt GAZHALA",
};

export function isCasablanca(label: string) {
  const s = String(label || "")
    .trim()
    .toLowerCase();
  return s.includes("casa");
}

export function computeDeliveryFeeByCity(cityText: string) {
  if (!cityText) return 0;
  if (isCasablanca(cityText)) return DELIVERY_RULES.CASABLANCA_FEE;
  return 0;
}

export function getLineVariantKey(l: any) {
  return String(l?.variant?.variant_key || "default").trim() || "default";
}

export function getLineVariantLabel(l: any) {
  return String(l?.variant?.label || "").trim();
}

export function getLineVariantId(l: any) {
  const id = l?.variant?.variant_id ?? null;
  const n = id == null ? 0 : Number(id) || 0;
  return n > 0 ? n : null;
}

export function lineKey(l: any) {
  const lid = String(l?.line_id || "").trim();
  if (lid) return lid;
  const pid = Number(l?.id ?? 0) || 0;
  return `${pid}:${getLineVariantKey(l)}`;
}

export function normalizeCityName(input?: string | null) {
  const v = String(input || "").trim();
  if (!v) return "";
  return v
    .replace(/\bprovince\b/gi, "")
    .replace(/\bprefecture\b/gi, "")
    .replace(/\bpréfecture\b/gi, "")
    .replace(/\bregion\b/gi, "")
    .replace(/\brégion\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cityCodeFromText(input?: string | null): CityCode | null {
  const v = normalizeCityName(input).toLowerCase();
  if (!v) return null;

  const direct = CITY_OPTIONS.find((c) => c.code.toLowerCase() === v);
  if (direct) return direct.code as CityCode;

  const byLabel = CITY_OPTIONS.find((c) => c.label.toLowerCase() === v);
  if (byLabel) return byLabel.code as CityCode;

  const fuzzy = CITY_OPTIONS.find((c) => {
    const label = c.label.toLowerCase();
    const code = c.code.toLowerCase();
    return (
      label.includes(v) ||
      v.includes(label) ||
      code.includes(v) ||
      v.includes(code)
    );
  });
  if (fuzzy) return fuzzy.code as CityCode;

  if (v.includes("casa")) return "CASABLANCA" as CityCode;
  if (v.includes("marr")) return "MARRAKECH" as CityCode;

  return null;
}

export function parseGpsInput(raw?: string | null) {
  const txt = String(raw || "").trim();
  if (!txt) return null;

  const clean = txt.replace(/\s+/g, " ");

  let m = clean.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  m = clean.match(/q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  m = clean.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const nums = clean.match(/-?\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 2) {
    const lat = Number(nums[0]);
    const lng = Number(nums[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}
