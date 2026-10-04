import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isRoleAllowed, roleHome, SET_PASSWORD_PATH, SIGN_IN_PATH, type AppRole } from "@/lib/roles";
import { PageLoader } from "./PageLoader";

interface RoleGuardProps {
  /** Roles allowed to see the nested routes. Omit to allow any signed-in user with a known role. */
  roles?: readonly AppRole[];
}

/**
 * Layout route that fails closed:
 * - no user -> sign-in page (remembering where the user wanted to go)
 * - user with a null/unknown role, or a role that is not allowed -> their own dashboard
 * Children are only rendered for an authorised user.
 */
export const RoleGuard = ({ roles }: RoleGuardProps) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to={SIGN_IN_PATH} replace state={{ from: location }} />;
  }

  const allowed = roles ? isRoleAllowed(role, roles) : role !== null;
  if (!allowed) {
    // roleHome(null) is the sign-in page, which never redirects back for a role-less user.
    return <Navigate to={roleHome(role)} replace />;
  }

  // An admin/org-created account must change its generated password before it can reach any dashboard.
  if (user.MustChangePassword && location.pathname !== SET_PASSWORD_PATH) {
    return <Navigate to={SET_PASSWORD_PATH} replace />;
  }

  return <Outlet />;
};

export default RoleGuard;
