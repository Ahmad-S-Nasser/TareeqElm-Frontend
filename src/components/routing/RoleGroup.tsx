import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { PageLoader } from "./PageLoader";

/**
 * Element for a role group's layout route (wrapped by RoleGuard):
 * one error boundary (reset on navigation) and one Suspense for the group's lazy pages.
 */
export const RoleGroup = () => {
  const location = useLocation();
  return (
    <AppErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AppErrorBoundary>
  );
};

export default RoleGroup;
