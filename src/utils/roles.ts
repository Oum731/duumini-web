// src/utils/roles.ts
export type Role =
  | "MEMBER"
  | "VENDEUR"
  | "FOURNISSEUR"
  | "RESTAURANT"
  | "LIVREUR"
  | "COMMERCIAL"
  | "ADMIN";

export function normRole(input?: any): Role | null {
  const r = String(input || "").trim().toUpperCase();
  if (!r) return null;

  // alias (au cas où backend varie)
  if (r === "VENDOR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE") return "VENDEUR";
  if (r === "SUPPLIER") return "FOURNISSEUR";

  if (
    r === "MEMBER" ||
    r === "VENDEUR" ||
    r === "FOURNISSEUR" ||
    r === "RESTAURANT" ||
    r === "LIVREUR" ||
    r === "COMMERCIAL" ||
    r === "ADMIN"
  ) return r as Role;

  return null;
}

export function isProRole(role?: any) {
  const r = normRole(role);
  return r === "ADMIN" || r === "VENDEUR" || r === "RESTAURANT" || r === "FOURNISSEUR";
}