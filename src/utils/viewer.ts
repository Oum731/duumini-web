// src/utils/viewer.ts
export type ViewerRole = "GUEST" | "CLIENT" | "VENDOR" | "RESTAURANT" | "SUPPLIER" | "ADMIN";

export function normalizeViewerRole(user: any): ViewerRole {
  const r = String(user?.role || "").trim().toUpperCase();

  if (r === "ADMIN") return "ADMIN";

  // vendeurs (boutique/restaurant)
  if (r === "VENDOR" || r === "VENDEUR" || r === "SELLER" || r === "SHOP") return "VENDOR";
  if (r === "RESTAURANT" || r === "RESTO") return "RESTAURANT";

  // fournisseurs
  if (r === "SUPPLIER" || r === "FOURNISSEUR") return "SUPPLIER";

  // clients
  if (r === "CLIENT" || r === "CUSTOMER" || r === "USER") return "CLIENT";

  return "GUEST";
}

export function canSeeVendorPanel(role: ViewerRole) {
  return role === "VENDOR" || role === "RESTAURANT" || role === "ADMIN";
}

export function canSeeSupplierPanel(role: ViewerRole) {
  return role === "SUPPLIER" || role === "ADMIN";
}