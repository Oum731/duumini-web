// src/components/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useViewer } from "../hooks/useViewer";

type RequireAuthProps = {
  allow?: (viewer: ReturnType<typeof useViewer>) => boolean;
  redirectTo?: string;
};

export default function RequireAuth({
  allow,
  redirectTo = "/",
}: RequireAuthProps) {
  const viewer = useViewer();
  const location = useLocation();

  if (viewer.loading) {
    return null;
  }

  if (!viewer.isLogged) {
    return (
      <Navigate
        to="/profile?tab=login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (allow && !allow(viewer)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}