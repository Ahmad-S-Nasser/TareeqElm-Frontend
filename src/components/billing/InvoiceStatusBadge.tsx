import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUSES } from "@/hooks/useInvoices";

/** Status pill for an invoice. An unknown status shows its raw value rather than a missing-key string. */
export const InvoiceStatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const { t } = useTranslation("billing");
  const known = (INVOICE_STATUSES as readonly string[]).includes(status);
  return (
    <Badge
      variant={status === "Voided" ? "destructive" : "secondary"}
      className={className}
      data-testid="invoice-status-badge"
      data-status={status}
    >
      {known ? t(`invoice.status.${status}`) : status}
    </Badge>
  );
};

export default InvoiceStatusBadge;
