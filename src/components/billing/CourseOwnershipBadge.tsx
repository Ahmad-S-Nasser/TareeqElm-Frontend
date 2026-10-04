import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CourseOwnershipBadgeProps {
  /** Null = a platform course (owned by no organization — the badge says "Platform"). */
  organizationId: string | null;
  /** Resolved display name of `organizationId`; a deleted organization still shows the fallback, not a blank badge. */
  organizationName?: string | null;
  className?: string;
}

/**
 * "Platform" / "{Org name}" — wherever a course is listed (catalog v12 phase 3's ownership-based split), so an Admin
 * or Organization screen that lists courses across tenants never leaves the viewer guessing who owns one.
 */
export function CourseOwnershipBadge({ organizationId, organizationName, className }: CourseOwnershipBadgeProps) {
  const { t } = useTranslation(["billing", "common"]);
  const isPlatform = organizationId === null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        isPlatform ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-muted text-muted-foreground",
        className
      )}
      data-testid="course-ownership-badge"
    >
      {isPlatform ? t("billing:courseOwnership.platform") : organizationName ?? t("common:deletedOrganization")}
    </Badge>
  );
}

export default CourseOwnershipBadge;
