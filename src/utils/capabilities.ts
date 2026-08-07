// src/utils/capabilities.ts
import { normRole } from "./roles";
import type { InternalRole } from "../services/companies";

export type Capabilities = {
  canBrowse: boolean;          // Home/Market/Food/Fashion
  canOrder: boolean;           // checkout
  canAccessAdmin: boolean;     // /admin
  canAccessPro: boolean;       // /pro/*
  canManageProducts: boolean;  // CRUD produits
  canManageOrders: boolean;    // gestion commandes
};

export function getCaps(roleInput?: any): Capabilities {
  const r = normRole(roleInput);

  // visiteur / client (MEMBER ou null)
  if (!r || r === "MEMBER") {
    return {
      canBrowse: true,
      canOrder: true,
      canAccessAdmin: false,
      canAccessPro: false,
      canManageProducts: false,
      canManageOrders: false,
    };
  }

  // admin
  if (r === "ADMIN") {
    return {
      canBrowse: true,
      canOrder: true,
      canAccessAdmin: true,
      canAccessPro: true,
      canManageProducts: true,
      canManageOrders: true,
    };
  }

  // pro: vendeur/resto/fournisseur
  if (r === "VENDEUR" || r === "RESTAURANT" || r === "FOURNISSEUR") {
    return {
      canBrowse: true,
      canOrder: true, // mets false si tu veux leur cacher achat
      canAccessAdmin: false,
      canAccessPro: true,
      canManageProducts: true,
      canManageOrders: true,
    };
  }

  // livreur (si tu l’utilises)
  if (r === "LIVREUR") {
    return {
      canBrowse: true,
      canOrder: false,
      canAccessAdmin: false,
      canAccessPro: false,
      canManageProducts: false,
      canManageOrders: true,
    };
  }

  // commercial : déclare ses propres ventes, pas de gestion produit
  if (r === "COMMERCIAL") {
    return {
      canBrowse: true,
      canOrder: false,
      canAccessAdmin: false,
      canAccessPro: true,
      canManageProducts: false,
      canManageOrders: true,
    };
  }

  return {
    canBrowse: true,
    canOrder: true,
    canAccessAdmin: false,
    canAccessPro: false,
    canManageProducts: false,
    canManageOrders: false,
  };
}

/* ===== Niveau 2 : rôle interne entreprise (company_members.internal_role) =====
   Matrice reprise de docs/duumini-2.0/01-vision-produit.md §4. Ce niveau se
   combine au rôle plateforme ci-dessus : un OWNER d'entreprise sans le rôle
   plateforme VENDEUR/FOURNISSEUR/RESTAURANT n'a toujours pas accès à /pro. */
export type CompanyCapabilities = {
  canManageCatalog: boolean;
  canManageOrders: boolean;
  canManageEmployees: boolean;
  canManageBilling: boolean;
  canManageStock: boolean;
  canViewCrm: boolean;
  canViewFinance: boolean;
  canDeleteCompany: boolean;
  canViewOnly: boolean;
};

export function getCompanyCaps(internalRole?: InternalRole | null): CompanyCapabilities {
  const base: CompanyCapabilities = {
    canManageCatalog: false,
    canManageOrders: false,
    canManageEmployees: false,
    canManageBilling: false,
    canManageStock: false,
    canViewCrm: false,
    canViewFinance: false,
    canDeleteCompany: false,
    canViewOnly: false,
  };

  switch (internalRole) {
    case "OWNER":
      return {
        ...base,
        canManageCatalog: true,
        canManageOrders: true,
        canManageEmployees: true,
        canManageBilling: true,
        canManageStock: true,
        canViewCrm: true,
        canViewFinance: true,
        canDeleteCompany: true,
      };
    case "MANAGER":
      return {
        ...base,
        canManageCatalog: true,
        canManageOrders: true,
        canManageEmployees: true,
        canManageStock: true,
        canViewCrm: true,
      };
    case "SALES":
      return {
        ...base,
        canManageOrders: true,
        canViewCrm: true,
      };
    case "WAREHOUSE":
      return {
        ...base,
        canManageStock: true,
      };
    case "ACCOUNTANT":
      return {
        ...base,
        canManageBilling: true,
        canViewFinance: true,
      };
    case "VIEWER":
      return {
        ...base,
        canViewOnly: true,
      };
    default:
      return base;
  }
}