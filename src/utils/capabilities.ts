// src/utils/capabilities.ts
import { normRole } from "./roles";

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

  return {
    canBrowse: true,
    canOrder: true,
    canAccessAdmin: false,
    canAccessPro: false,
    canManageProducts: false,
    canManageOrders: false,
  };
}