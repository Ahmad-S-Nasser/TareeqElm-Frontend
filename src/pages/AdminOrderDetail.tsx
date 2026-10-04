import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, RotateCcw, Undo2, Wallet } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput, OrderStatusBadge } from "@/components/billing";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  newIdempotencyKey,
  useAdminOrderQuery,
  useMarkPaid,
  useOrderRefundsQuery,
  useReapplyOrder,
  useRefundOrder,
} from "@/hooks/useAdminOrders";

export interface AdminOrderDetailProps {
  /** The order to show; `null` closes the panel. */
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** One dated line of the payment history. */
interface TimelineEvent {
  key: string;
  label: string;
  at: string;
  detail?: string | null;
}

/**
 * The administrative view of one order (`GET /api/admin/orders/{id}`), as a side panel over the orders table.
 *
 * It shows the lines with their resolved titles, the money as the server computed it, a payment history assembled
 * from the order's own timestamps plus its refunds, and the three things an administrator can do about an order:
 *
 *  - **Refund** (`refunds.manage`) — full or line-by-line, always with a reason, and always carrying an idempotency
 *    key generated once when the dialog opens. The same key survives a retry, so a double-click or a re-submit after
 *    a timeout returns the first refund rather than giving the money back twice.
 *  - **Mark paid** (`orders.manage`) — only rendered when the order's own `SupportsManualCapture` is true and it is
 *    still awaiting payment. Any provider with a gateway of its own refuses this, so the button is never offered.
 *  - **Re-apply** (`orders.manage`) — repairs a Paid order whose entitlements/enrollments/earnings went missing.
 */
export const AdminOrderDetail = ({ orderId, onOpenChange }: AdminOrderDetailProps) => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDateTime, formatNumber } = useFormatters();
  const { toast } = useToast();

  const { data: order, isLoading, isError, error } = useAdminOrderQuery(orderId);
  const { data: refunds = [] } = useOrderRefundsQuery(orderId);

  const refundOrder = useRefundOrder();
  const markPaid = useMarkPaid();
  const reapply = useReapplyOrder();

  // ---- refund dialog ------------------------------------------------------
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full");
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [refundError, setRefundError] = useState<string | null>(null);
  /**
   * One key per refund *attempt*, not per click: it is minted when the dialog opens and deliberately kept across
   * failures and retries, because that is exactly what makes a retry safe.
   */
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // ---- mark-paid dialog ---------------------------------------------------
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [markPaidNotes, setMarkPaidNotes] = useState("");

  // ---- reapply confirmation ----------------------------------------------
  const [reapplyOpen, setReapplyOpen] = useState(false);

  // Closing the panel (or switching to another order) must not carry one order's half-filled refund form to the next.
  useEffect(() => {
    setRefundOpen(false);
    setMarkPaidOpen(false);
    setReapplyOpen(false);
    setRefundMode("full");
    setSelectedLines([]);
    setRefundAmount(null);
    setRefundReason("");
    setRevokeAccess(true);
    setRefundError(null);
    setPaymentReference("");
    setMarkPaidNotes("");
  }, [orderId]);

  const openRefund = () => {
    setRefundMode("full");
    setSelectedLines([]);
    setRefundAmount(null);
    setRefundReason("");
    setRevokeAccess(true);
    setRefundError(null);
    setIdempotencyKey(newIdempotencyKey());
    setRefundOpen(true);
  };

  const toggleLine = (lineId: string) =>
    setSelectedLines((current) =>
      current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]
    );

  const submitRefund = async () => {
    if (!order) return;
    if (refundMode === "partial" && selectedLines.length === 0) {
      setRefundError(t("refund.selectLines"));
      return;
    }
    if (!refundReason.trim()) {
      setRefundError(t("refund.reasonRequired"));
      return;
    }
    setRefundError(null);
    try {
      const refund = await refundOrder.mutateAsync({
        orderId: order.Id,
        amount: refundAmount,
        lineIds: refundMode === "partial" ? selectedLines : undefined,
        reason: refundReason,
        revokeAccess,
        idempotencyKey,
      });
      setRefundOpen(false);
      toast({
        title: t("refund.done"),
        description: formatCurrency(refund.Amount, refund.Currency),
      });
    } catch (err) {
      // The key is intentionally NOT regenerated: pressing "Issue refund" again replays the same attempt.
      setRefundError(getApiError(err, t("refund.failed")));
    }
  };

  const submitMarkPaid = async () => {
    if (!order) return;
    try {
      await markPaid.mutateAsync({ orderId: order.Id, paymentReference, notes: markPaidNotes });
      setMarkPaidOpen(false);
      toast({ title: t("order.markPaid.done") });
    } catch (err) {
      toast({ variant: "destructive", title: t("order.markPaid.failed"), description: getApiError(err) });
    }
  };

  const submitReapply = async () => {
    if (!order) return;
    setReapplyOpen(false);
    try {
      const result = await reapply.mutateAsync(order.Id);
      const repaired = result.EntitlementsCreated + result.EnrollmentsCreated + result.EarningsCreated;
      toast({
        title: t("order.reapply.action"),
        description: repaired === 0
          ? t("order.reapply.nothingMissing")
          : t("order.reapply.repaired", {
              entitlements: formatNumber(result.EntitlementsCreated),
              enrollments: formatNumber(result.EnrollmentsCreated),
              earnings: formatNumber(result.EarningsCreated),
            }),
      });
    } catch (err) {
      toast({ variant: "destructive", title: t("order.reapply.failed"), description: getApiError(err) });
    }
  };

  const buyer = order?.BuyerName ?? t("common.unknownUser");
  const refundable = order?.RefundableAmount ?? 0;
  const canRefund = !!order && refundable > 0 && (order.Status === "Paid" || order.Status === "PartiallyRefunded");
  const canMarkPaid = !!order && order.SupportsManualCapture && order.Status === "PendingPayment";
  const canReapply = !!order && order.Status === "Paid";

  const events: TimelineEvent[] = [];
  if (order) {
    events.push({ key: "placed", label: t("order.placedAt"), at: order.PlacedAt });
    if (order.PaidAt) {
      events.push({
        key: "paid",
        label: t("order.paidAt"),
        at: order.PaidAt,
        detail: order.MarkedPaidByName ? `${t("order.markedPaidBy")}: ${order.MarkedPaidByName}` : null,
      });
    }
    if (order.CancelledAt) events.push({ key: "cancelled", label: t("order.cancelledAt"), at: order.CancelledAt });
    if (order.FailedAt) {
      events.push({ key: "failed", label: t("order.failedAt"), at: order.FailedAt, detail: order.FailureReason });
    }
    for (const refund of refunds) {
      events.push({
        key: `refund-${refund.Id}`,
        label: `${t("refund.action")} · ${formatCurrency(refund.Amount, refund.Currency)} · ${t(`refundStatus.${refund.Status}`)}`,
        at: refund.CompletedAt ?? refund.RequestedAt,
        detail: [refund.RequestedByName, refund.Reason].filter(Boolean).join(" — ") || null,
      });
    }
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  return (
    <>
      <Sheet open={!!orderId} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="order-detail">
          <SheetHeader>
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">
                {t("order.detailsTitle", { reference: order?.ProviderRef ?? orderId ?? "" })}
              </span>
              {order && <OrderStatusBadge status={order.Status} />}
            </SheetTitle>
            <SheetDescription>{t("order.adminSubtitle")}</SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : isError || !order ? (
            <div className="py-16 text-center space-y-2" data-testid="order-detail-error">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" aria-hidden="true" />
              <p className="text-destructive">{getApiError(error, t("order.notFound"))}</p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("order.buyer")}</dt>
                  <dd className="font-medium">{buyer}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("order.provider")}</dt>
                  <dd className="font-medium">{order.Provider}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("order.total")}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(order.Total, order.Currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("order.refundableAmount")}</dt>
                  <dd className="font-semibold tabular-nums" data-testid="order-refundable">
                    {formatCurrency(refundable, order.Currency)}
                  </dd>
                </div>
                {order.CouponCode && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("order.coupon")}</dt>
                    <dd className="font-medium">{order.CouponCode}</dd>
                  </div>
                )}
                {order.PaymentReference && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("order.paymentReference")}</dt>
                    <dd className="font-medium">{order.PaymentReference}</dd>
                  </div>
                )}
                {order.RefundWindowEndsAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("order.refundWindow")}</dt>
                    <dd className={cn("font-medium", !order.WithinRefundWindow && "text-muted-foreground")}>
                      {order.WithinRefundWindow
                        ? t("order.refundWindowEndsAt", { date: formatDateTime(order.RefundWindowEndsAt) })
                        : t("order.refundWindowClosed")}
                    </dd>
                  </div>
                )}
              </dl>

              <Separator />

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("order.items")}</h3>
                <ul className="space-y-2" data-testid="order-lines">
                  {order.Items.map((line) => (
                    <li key={line.LineId} className="rounded-lg border border-border/50 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{line.ResolvedTitle ?? line.Title ?? t("common.unknownItem")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t(`common.itemType.${line.ItemType}`)}
                            {line.CourseTitle ? ` · ${line.CourseTitle}` : ""}
                            {line.InstructorName ? ` · ${line.InstructorName}` : ""}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="font-semibold tabular-nums">
                            {formatCurrency(line.LineTotal, order.Currency)}
                          </p>
                          {line.RefundedAmount > 0 && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {t("order.refundedAmount")}: {formatCurrency(line.RefundedAmount, order.Currency)}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 text-sm pt-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("order.subtotal")}</dt>
                    <dd className="tabular-nums">{formatCurrency(order.Subtotal, order.Currency)}</dd>
                  </div>
                  {order.DiscountAmount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("order.discount")}</dt>
                      <dd className="tabular-nums">-{formatCurrency(order.DiscountAmount, order.Currency)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <dt>{t("order.total")}</dt>
                    <dd className="tabular-nums">{formatCurrency(order.Total, order.Currency)}</dd>
                  </div>
                </dl>
              </section>

              <Separator />

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("order.timeline")}</h3>
                <ol className="space-y-2 text-sm" data-testid="order-timeline">
                  {events.map((event) => (
                    <li key={event.key} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <div>
                        <p className="font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                        {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <Separator />

              <div className="flex flex-wrap gap-2">
                {canRefund && (
                  <Can permission={PERMISSIONS.refundsManage}>
                    <Button variant="destructive" size="sm" onClick={openRefund}>
                      <Undo2 className="w-4 h-4 me-2" aria-hidden="true" />
                      {t("refund.action")}
                    </Button>
                  </Can>
                )}
                {canMarkPaid && (
                  <Can permission={PERMISSIONS.ordersManage}>
                    <Button size="sm" onClick={() => setMarkPaidOpen(true)}>
                      <Wallet className="w-4 h-4 me-2" aria-hidden="true" />
                      {t("order.markPaid.action")}
                    </Button>
                  </Can>
                )}
                {canReapply && (
                  <Can permission={PERMISSIONS.ordersManage}>
                    <Button variant="outline" size="sm" onClick={() => setReapplyOpen(true)}>
                      <RotateCcw className="w-4 h-4 me-2" aria-hidden="true" />
                      {t("order.reapply.action")}
                    </Button>
                  </Can>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ---------------------------------------------------------------- refund */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("refund.refundOrder")}</DialogTitle>
            <DialogDescription>{t("refund.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm">
              {t("order.refundableAmount")}:{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(refundable, order?.Currency)}</span>
            </p>

            <RadioGroup
              value={refundMode}
              onValueChange={(value) => {
                setRefundMode(value as "full" | "partial");
                setRefundError(null);
              }}
              className="gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id="refund-full" />
                <Label htmlFor="refund-full">{t("refund.full")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id="refund-partial" />
                <Label htmlFor="refund-partial">{t("refund.partial")}</Label>
              </div>
            </RadioGroup>

            {refundMode === "partial" && (
              <div className="space-y-2" data-testid="refund-lines">
                <p className="text-xs font-medium text-muted-foreground">{t("refund.lines")}</p>
                {order?.Items.map((line) => (
                  <label
                    key={line.LineId}
                    className="flex items-center gap-3 rounded-md border border-border/50 p-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedLines.includes(line.LineId)}
                      onCheckedChange={() => toggleLine(line.LineId)}
                      aria-label={line.ResolvedTitle ?? line.Title}
                      disabled={line.RefundableAmount <= 0}
                    />
                    <span className="flex-1 min-w-0 truncate">
                      {line.ResolvedTitle ?? line.Title ?? t("common.unknownItem")}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(line.RefundableAmount, order.Currency)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">{t("refund.amount")}</Label>
              <MoneyInput
                id="refund-amount"
                value={refundAmount}
                onChange={setRefundAmount}
                currency={order?.Currency}
                max={refundable}
              />
              <p className="text-xs text-muted-foreground">{t("refund.amountHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">{t("refund.reason")}</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(event) => {
                  setRefundReason(event.target.value);
                  setRefundError(null);
                }}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t("refund.reasonHint")}</p>
            </div>

            <div className="flex items-start gap-3">
              <Switch
                id="refund-revoke"
                checked={revokeAccess}
                onCheckedChange={setRevokeAccess}
                aria-label={t("refund.revokeAccess")}
              />
              <div>
                <Label htmlFor="refund-revoke">{t("refund.revokeAccess")}</Label>
                <p className="text-xs text-muted-foreground">{t("refund.revokeAccessHint")}</p>
              </div>
            </div>

            {refundError && (
              <p className="text-sm text-destructive" role="alert" data-testid="refund-error">
                {refundError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void submitRefund()} disabled={refundOrder.isPending}>
              {refundOrder.isPending ? t("refund.submitting") : t("refund.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- mark paid */}
      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("order.markPaid.title")}</DialogTitle>
            <DialogDescription>{t("order.markPaid.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mark-paid-reference">{t("order.markPaid.reference")}</Label>
              <Input
                id="mark-paid-reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("order.markPaid.referenceHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mark-paid-notes">{t("order.markPaid.notes")}</Label>
              <Textarea
                id="mark-paid-notes"
                value={markPaidNotes}
                onChange={(event) => setMarkPaidNotes(event.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void submitMarkPaid()} disabled={markPaid.isPending}>
              {t("order.markPaid.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------- reapply */}
      <AlertDialog open={reapplyOpen} onOpenChange={setReapplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("order.reapply.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("order.reapply.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitReapply()}>{t("order.reapply.submit")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminOrderDetail;
