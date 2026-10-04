import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';

/** The signed-in user's effective permissions (kept fresh by AuthProvider via GET /Auth/me). */
export const usePermissions = () => {
  const { user } = useAuth();
  const permissions = user?.Permissions;
  return useMemo(
    () => ({
      permissions: permissions ?? [],
      can: (permission: string) => hasPermission(permissions, permission),
      canAny: (...wanted: string[]) => hasAnyPermission(permissions, wanted),
    }),
    [permissions]
  );
};
