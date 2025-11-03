// src/components/ProtectedAdmin.tsx
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUser } from "../services/auth";

export default function ProtectedAdmin() {
  // getCurrentUser() retourne déjà un user avec rôle normalisé
  // et prend en compte l'override local (localStorage.duumini_force_role / VITE_FORCE_ROLE)
  const u = getCurrentUser();

  if (!u) {
    // Non connecté → page profil
    return <Navigate to="/profile" replace />;
  }

  const role = (u.role || "").toString().trim().toUpperCase();
  if (role !== "ADMIN") {
    // Connecté mais pas admin → on renvoie à l’accueil
    return <Navigate to="/" replace />;
  }

  // Admin autorisé → rend les routes enfant (AdminShell + pages)
  return <Outlet />;
}
