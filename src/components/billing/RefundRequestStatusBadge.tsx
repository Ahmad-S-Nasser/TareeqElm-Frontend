import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REFUND_REQUEST_STATUSES, type RefundRequestStatus } from "@/hooks/useRefundRequests";

/** Theme tokens, as in OrderStatusBadge: waiting is amber, granted is green, refused is red, withdrawn is muted. */
const STATUS_CLASSES: Record<RefundRequestStatus, string> = {
  Pending: "border-warning/30 bg-warning/10 text-warning",
  Approved: "border-success/30 bg-success/10 text-success",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-border bg-muted text-muted-foreground",
};

/** Status pill for a refund request. An unknown status shows its raw value rather than a missing-key string. */
export const RefundRequestStatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const { t } = useTranslation("billing");
  const known = (REFUND_REQUEST_STATUSES as readonly string[]).includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        known ? STATUS_CLASSES[status as RefundRequestStatus] : "border-border bg-muted text-muted-foreground",
        className
      )}
      data-testid="refund-request-status-badge"
      data-status={status}
    >
      {known ? t(`refundRequestStatus.${status}`) : status}
    </Badge>
  );
};

export default RefundRequestStatusBadge;
