import type { RevenuePeriod } from "../../../services/affiliates";
import { api } from "../../../services/http";
import type { PageInfo } from "./shared";
import type { Affiliate, AffiliateCommission, UserOption } from "./types";

export function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeAffiliateCodeLocal(value: unknown) {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return v || "";
}

export function extractNameParts(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" ") || "",
  };
}

export function buildAffiliateCodeFromName(name: string, seed?: string | number) {
  const { first, last } = extractNameParts(name);

  const firstPart = slugify(first).replace(/-/g, "").slice(0, 3).toUpperCase();
  const lastPart = slugify(last || first).replace(/-/g, "").slice(0, 3).toUpperCase();
  const suffix = String(seed || "")
    .replace(/\D+/g, "")
    .slice(-4);

  return normalizeAffiliateCodeLocal(
    `${firstPart || "AFF"}${lastPart || "USR"}${suffix ? `-${suffix}` : ""}`,
  );
}

export function buildAffiliateSlugFromName(name: string, seed?: string | number) {
  const base = slugify(name || "affilie");
  const suffix = String(seed || "")
    .replace(/\D+/g, "")
    .slice(-4);

  return slugify(`${base}${suffix ? `-${suffix}` : ""}`);
}

export function safeAffiliateName(item?: Affiliate | null) {
  return item?.name?.trim() || `Affilié #${item?.id ?? ""}`;
}

export function safeUserLabel(user?: UserOption | null) {
  const full =
    user?.full_name?.trim() ||
    user?.name?.trim() ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return full || `Utilisateur #${user?.id ?? ""}`;
}

export function getCommissionAmount(row: AffiliateCommission) {
  const direct = Number(row.amount);
  if (Number.isFinite(direct)) return direct;
  const earnings = Number(row.total_earnings);
  if (Number.isFinite(earnings)) return earnings;
  return 0;
}

export function getCommissionBase(row: AffiliateCommission) {
  const base = Number(row.base_amount);
  if (Number.isFinite(base)) return base;
  const sales = Number(row.total_sales);
  if (Number.isFinite(sales)) return sales;
  return 0;
}

export function getPageTotal(pageInfo: PageInfo) {
  return Number(pageInfo.totalItems ?? pageInfo.total ?? 0);
}

export function periodLabel(period: RevenuePeriod) {
  switch (period) {
    case "DAY":
      return "jour";
    case "WEEK":
      return "semaine";
    case "YEAR":
      return "année";
    default:
      return "mois";
  }
}

export function snapshotValue(obj: any, key: string) {
  const n = Number(obj?.[key] || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function searchUsersCandidates(query: string): Promise<UserOption[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  const attempts = [
    { url: "/api/users", query: { q, page: 1, pageSize: 10 } },
    { url: "/api/user", query: { q, page: 1, pageSize: 10 } },
    { url: "/api/user/admin/list", query: { q, page: 1, pageSize: 10 } },
    { url: "/api/admin/users", query: { q, page: 1, pageSize: 10 } },
  ];

  for (const attempt of attempts) {
    try {
      const data: any = await api.get(attempt.url, { query: attempt.query });
      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      const mapped = rawItems
        .map((u: any): UserOption | null => {
          const id = Number(u?.id);
          if (!Number.isFinite(id) || id <= 0) return null;

          return {
            id,
            first_name: u.first_name ?? null,
            last_name: u.last_name ?? null,
            name: u.name ?? null,
            full_name:
              u.full_name ??
              [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ??
              null,
            phone: u.phone ?? null,
            email: u.email ?? null,
            role: u.role ?? null,
          };
        })
        .filter(Boolean) as UserOption[];

      if (mapped.length) return mapped;
    } catch {
      // ignore and try next endpoint
    }
  }

  return [];
}
