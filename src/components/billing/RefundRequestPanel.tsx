import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import type { OrderDto } from "@/hooks/useBilling";
import {
  useCancelRefundRequest,
  useMyRefundRequestsQuery,
  useRequestRefund,
} from "@/hooks/useRefundRequests";
import { RefundRequestStatusBadge } from "./RefundRequestStatusBadge";

export interface RefundRequestPanelProps {
  order: OrderDto;
  /** False once the platform's refund window (PaidAt + RefundWindowDays) has closed; the receipt computes it. */
  withinRefundWindow: boolean;
}

/**
 * The trainee side of a refund request, shown on their own receipt: the latest request's status (with the reviewer's note
 * and a Cancel button while it is pending), and a "Request refund" button when a new request makes sense — a paid order
 * with money still refundable, inside the refund window, and nothing already pending.
 */
export const RefundRequestPanel = ({ order, withinRefundWindow }: RefundRequestPanelProps) => {
  const { t } = useTranslation("billing");
  const { toast } = useToast();
  const { formatCurrency, formatDate } = useFormatters();
  const { data: requests, isLoading } = useMyRefundRequestsQuery(order.Id);
  const requestRefund = useRequestRefund(order.Id);
  const cancelRequest = useCancelRefundRequest();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The server's own figures; the only arithmetic here is "what is left", used for the hint and a client-side bound.
  const remaining = Math.max(0, Math.round((order.Total - order.RefundedAmount) * 100) / 100);
  const latest = requests?.[0];
  const hasPending = requests?.some((r) => r.Status === "Pending") ?? false;
  const canRequest =
    (order.Status === "Paid" || order.Status === "PartiallyRefunded") &&
    order.RefundedAmount < order.Total &&
    withinRefundWindow &&
    !isLoading &&
    !hasPending;

  const reset = () => {
    setReason("");
    setAmount("");
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError(t("refundRequest.reasonRequired"));
      return;
    }
    let parsed: number | null = null;
    if (amount.trim()) {
      parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > remaining) {
        setError(t("refundRequest.amountInvalid", { amount: formatCurrency(remaining, order.Currency) }));
        return;
      }
    }
    try {
      await requestRefund.mutateAsync({ reason, amount: parsed });
      toast({ title: t("refundRequest.submitted") });
      setOpen(false);
      reset();
    } catch (err) {
      setError(getApiError(err, t("refundRequest.submitFailed")));
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelRequest.mutateAsync(id);
      toast({ title: t("refundRequest.cancelled") });
    } catch (err) {
      toast({ variant: "destructive", title: t("refundRequest.cancelFailed"), description: getApiError(err) });
    }
  };

  if (!latest && !canRequest) return null;

  return (
    <div className="space-y-3 print:hidden" data-testid="refund-request-panel">
      {latest && (
        <div className="rounded-lg border border-border/60 p-3 space-y-2 text-sm" data-testid="refund-request-latest">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("refundRequest.yourRequest")}</span>
              <RefundRequestStatusBadge status={latest.Status} />
            </div>
            {latest.Status === "Pending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void cancel(latest.Id)}
                disabled={cancelRequest.isPending}
                data-testid="refund-request-cancel"
              >
                {cancelRequest.isPending ? t("refundRequest.cancelling") : t("refundRequest.cancel")}
              </Button>
            )}
          </div>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-muted-foreground">
            <div className="flex justify-between gap-2">
              <dt>{t("refundRequest.requestedAmount")}</dt>
              <dd className="tabular-nums text-foreground">
                {latest.RequestedAmount != null
                  ? formatCurrency(latest.RequestedAmount, latest.Currency)
                  : t("refundRequest.everything")}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("refundRequest.requestedAt")}</dt>
              <dd className="text-foreground">{formatDate(latest.RequestedAt)}</dd>
            </div>
          </dl>
          <p className="text-muted-foreground">
            {t("refundRequest.reason")}: <span className="text-foreground">{latest.Reason}</span>
          </p>
          {latest.DecisionNote && (
            <p className="text-muted-foreground" data-testid="refund-request-note">
              {t("refundRequest.decisionNote")}: <span className="text-foreground">{latest.DecisionNote}</span>
            </p>
          )}
        </div>
      )}

      {canRequest && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="refund-request-open">
          <Undo2 className="h-4 w-4 me-2" aria-hidden="true" />
          {t("refundRequest.request")}
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("refundRequest.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("refundRequest.dialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="refund-request-reason">{t("refundRequest.reason")}</Label>
              <Textarea
                id="refund-request-reason"
                value={reason}
                maxLength={500}
                placeholder={t("refundRequest.reasonPlaceholder")}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-request-amount">{t("refundRequest.amount")}</Label>
              <Input
                id="refund-request-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                max={remaining}
                value={amount}
                placeholder={String(remaining)}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("refundRequest.amountHint", { amount: formatCurrency(remaining, order.Currency) })}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert" data-testid="refund-request-error">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={requestRefund.isPending} data-testid="refund-request-submit">
                {requestRefund.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />}
                {requestRefund.isPending ? t("refundRequest.submitting") : t("refundRequest.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RefundRequestPanel;
