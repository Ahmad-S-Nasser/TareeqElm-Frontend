import { Navigate, useLocation } from "react-router-dom";

/** Keeps old /university/* bookmarks working after the University -> Organization rename. */
export const LegacyUniversityRedirect = () => {
  const { pathname, search, hash } = useLocation();
  return <Navigate replace to={`${pathname.replace(/^\/university/, "/organization")}${search}${hash}`} />;
};
