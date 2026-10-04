/**
 * Single source of truth for application roles.
 * "applicant" is the internal name of the API's "Trainer" role.
 */
export const APP_ROLES = ['applicant', 'instructor', 'organization', 'admin'] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Maps the role name returned by the .NET API to the app role. */
const API_ROLE_TO_APP_ROLE: Readonly<Record<string, AppRole>> = {
  Trainer: 'applicant',
  Instructor: 'instructor',
  Organization: 'organization',
  Admin: 'admin',
};

const ROLE_HOME: Readonly<Record<AppRole, string>> = {
  applicant: '/dashboard',
  instructor: '/instructor',
  organization: '/organization',
  admin: '/admin',
};

const ROLE_LABEL: Readonly<Record<AppRole, string>> = {
  applicant: 'Trainer',
  instructor: 'Instructor',
  organization: 'Organization',
  admin: 'Administrator',
};

/** Where users without a usable role are sent (never a protected page). */
export const SIGN_IN_PATH = '/auth';

/** Where RoleGuard sends a signed-in user whose account must change its password before anything else works. */
export const SET_PASSWORD_PATH = '/auth/set-password';

export const isAppRole = (value: unknown): value is AppRole =>
  typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);

/** Converts an API role string to an AppRole; unknown values yield null (fail closed). */
export const parseApiRole = (apiRole: unknown): AppRole | null =>
  typeof apiRole === 'string' && Object.prototype.hasOwnProperty.call(API_ROLE_TO_APP_ROLE, apiRole)
    ? API_ROLE_TO_APP_ROLE[apiRole]
    : null;

/** Landing path for a role's dashboard; null/unknown roles map to the sign-in page. */
export const roleHome = (role: AppRole | null | undefined): string =>
  isAppRole(role) ? ROLE_HOME[role] : SIGN_IN_PATH;

export const roleLabel = (role: AppRole | null | undefined): string =>
  isAppRole(role) ? ROLE_LABEL[role] : 'Unknown';

/** True only when role is a known AppRole contained in `allowed`. */
export const isRoleAllowed = (role: AppRole | null | undefined, allowed: readonly AppRole[]): boolean =>
  isAppRole(role) && allowed.includes(role);
