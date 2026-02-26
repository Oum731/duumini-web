// src/components/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useViewer } from "../hooks/useViewer";

export default function RequireAuth({
  allow,
  redirectTo = "/",
}: {
  allow?: (viewer: ReturnType<typeof useViewer>) => boolean;
  redirectTo?: string;
}) {
  const viewer = useViewer();
  const loc = useLocation();

  if (viewer.loading) return null;

  if (!viewer.isLogged) {
    return <Navigate to="/profile?tab=login" replace state={{ from: loc.pathname }} />;
  }

  if (allow && !allow(viewer)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}