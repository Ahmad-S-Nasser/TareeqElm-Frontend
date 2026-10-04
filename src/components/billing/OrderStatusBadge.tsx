import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/hooks/useBilling";

/**
 * One colour per `OrderStatus`, using the theme tokens rather than raw palette colours so both themes and RTL
 * behave. Money that arrived is green, money that is still expected is amber, money that went back is blue,
 * and a dead order is muted.
 */
const STATUS_CLASSES: Record<OrderStatus, string> = {
  PendingPayment: "border-warning/30 bg-warning/10 text-warning",
  Paid: "border-success/30 bg-success/10 text-success",
  Failed: "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-border bg-muted text-muted-foreground",
  Refunded: "border-primary/30 bg-primary/10 text-primary",
  PartiallyRefunded: "border-primary/30 bg-primary/10 text-primary",
  Expired: "border-border bg-muted text-muted-foreground",
};

const FALLBACK_CLASS = "border-border bg-muted text-muted-foreground";

export interface OrderStatusBadgeProps {
  /** The `Status` string straight off an order DTO. An unknown value still renders, muted, with its raw text. */
  status: OrderStatus | string;
  className?: string;
}

/** Colour-coded order status with its label from `billing:orderStatus.*`. */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const { t } = useTranslation("billing");
  const known = status in STATUS_CLASSES;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", known ? STATUS_CLASSES[status as OrderStatus] : FALLBACK_CLASS, className)}
      data-testid="order-status-badge"
      data-status={status}
    >
      {known ? t(`orderStatus.${status}`) : status}
    </Badge>
  );
}

export default OrderStatusBadge;
