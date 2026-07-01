import type { CSSProperties } from "react";
import { moneyMAD } from "../../../utils/money";

export const DUU = {
  yellow: "#FFD54A",
  yellowSoft: "#FFF7D6",
  yellowBorder: "rgba(255, 213, 74, 0.45)",
  black: "#111111",
  gray: "#6B7280",
  line: "rgba(17,17,17,0.08)",
  bg: "#FFFDF6",
  white: "#FFFFFF",
  green: "#1FA971",
  greenSoft: "rgba(31,169,113,0.10)",
  red: "#E15554",
  redSoft: "rgba(225,85,84,0.10)",
  blueSoft: "rgba(17,17,17,0.04)",
};

export type PageInfo = {
  page: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  total?: number;
};

export const defaultPageInfo: PageInfo = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasPrevPage: false,
  hasNextPage: false,
};

export const PRODUCT_ROUTE_PREFIX =
  ((import.meta as any)?.env?.VITE_PRODUCT_ROUTE_PREFIX as string | undefined) ||
  "/products";

export type ProductOption = {
  id: number;
  name: string;
  slug?: string | null;
  price?: number | null;
  promo_price?: number | null;
  stock?: number | null;
  is_active?: boolean | number | null;
  shop_name?: string | null;
  cover?: string | null;
};

export function formatMoney(value: unknown) {
  return moneyMAD(Number(value || 0), 2);
}

export function formatNumber(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-FR").format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(d);
}

export function normalizeRoutePrefix(value: string) {
  const v = String(value || "").trim();
  if (!v) return "/products";
  return v.startsWith("/") ? v.replace(/\/+$/, "") : `/${v.replace(/\/+$/, "")}`;
}

export function buildPublicProductPath(product: ProductOption | null) {
  if (!product?.id) return "";
  const prefix = normalizeRoutePrefix(PRODUCT_ROUTE_PREFIX);
  const target = product.slug ? encodeURIComponent(product.slug) : String(product.id);
  return `${prefix}/${target}`;
}

export function cardStyle(extra?: CSSProperties): CSSProperties {
  return {
    border: `1px solid ${DUU.line}`,
    borderRadius: 24,
    background: DUU.white,
    boxShadow: "0 12px 30px rgba(17,17,17,0.06)",
    ...extra,
  };
}

export function statusBadgeClass(status: string) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
    case "APPROVED":
    case "PAID":
      return { background: "rgba(31,169,113,0.12)", color: DUU.green };
    case "INACTIVE":
    case "CANCELLED":
      return { background: "rgba(107,114,128,0.14)", color: "#4B5563" };
    case "PENDING":
      return { background: "rgba(255,213,74,0.20)", color: "#8A6200" };
    default:
      return { background: "rgba(17,17,17,0.08)", color: DUU.black };
  }
}
