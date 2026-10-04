import { parseApiRole } from "@/lib/roles";

/** GET /api/permissions entry (PascalCase JSON). */
export interface PermissionInfo {
  Name: string;
  Category: string;
  Description: string;
  LearnerScoped: boolean;
  AdminOnly: boolean;
}

/** GET /api/roles entry (PascalCase JSON). */
export interface RoleInfo {
  Id: string;
  Name: string;
  Description: string | null;
  Permissions: string[];
  IsSystem: boolean;
  IsLocked: boolean;
  BaseRole: string | null;
  UserCount: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export const PERMISSIONS_QUERY_KEY = ["permissions"] as const;
export const ROLES_QUERY_KEY = ["roles"] as const;

/** i18n keys cannot contain dots, so "courses.write" is looked up as "courses_write". */
export const permissionKey = (name: string): string => name.replace(/\./g, "_");

/** Built-in roles use the localized role names; custom roles show their own name. */
export const systemRoleKey = (role: Pick<RoleInfo, "IsSystem" | "BaseRole">): string | null => {
  if (!role.IsSystem) return null;
  return parseApiRole(role.BaseRole);
};
