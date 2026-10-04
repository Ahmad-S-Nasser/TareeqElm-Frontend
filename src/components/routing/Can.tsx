import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface CanProps {
  /** One permission, or a list of which any one is enough. */
  permission: string | readonly string[];
  /** Rendered when the permission is missing (default: nothing). */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders `children` only when the signed-in user holds the permission. */
export const Can = ({ permission, fallback = null, children }: CanProps) => {
  const { canAny } = usePermissions();
  const wanted = typeof permission === "string" ? [permission] : permission;
  return <>{canAny(...wanted) ? children : fallback}</>;
};

export default Can;
