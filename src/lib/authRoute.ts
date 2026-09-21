export type AuthMode = "signin" | "signup";

/** /signup or ?mode=signup opens sign-up; /login, /auth (and anything else) open sign-in. */
export const getAuthModeFromRoute = (pathname: string, search: string): AuthMode =>
  pathname === "/signup" || new URLSearchParams(search).get("mode") === "signup" ? "signup" : "signin";

/** Extracts the internal path the user originally requested (set by RoleGuard), if any. */
export const getReturnPath = (state: unknown): string | null => {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)?.from;
  if (!from || typeof from.pathname !== "string" || !from.pathname.startsWith("/") || from.pathname.startsWith("//")) {
    return null;
  }
  const search = typeof from.search === "string" ? from.search : "";
  const hash = typeof from.hash === "string" ? from.hash : "";
  return `${from.pathname}${search}${hash}`;
};
