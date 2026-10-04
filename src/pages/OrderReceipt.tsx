import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { OrderStatusBadge } from "@/components/billing";
import { RefundRequestPanel } from "@/components/billing/RefundRequestPanel";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCheckoutSettings } from "@/hooks/useCheckout";
import { useMyOrderQuery } from "@/hooks/useOrders";
import { activeEntitlementFor, useMyEntitlementsQuery } from "@/hooks/useEntitlements";

interface ReceiptLocationState {
  /** Set by Checkout when it forwards a buyer here the moment their payment cleared. */
  justPaid?: boolean;
  /** Where the buyer came from, so "start learning" goes back to the right course. */
  returnTo?: string;
}

/**
 * One order, printable (`GET /api/orders/me/{id}`, `orders.self`).
 *
 * Every figure is the snapshot taken at checkout — a later price change, rename or deletion never rewrites a receipt
 * (plan §5.0). Printing is plain CSS: `print:` utilities drop the chrome and flatten the card, so Ctrl+P (or the
 * button) yields a clean page without a PDF generator.
 */
const OrderReceipt = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDateTime, formatDate } = useFormatters();
  const { orderId } = useParams<{ orderId: string }>();
  const { state } = useLocation() as { state: ReceiptLocationState | null };

  const { data: order, isLoading, isError, error } = useMyOrderQuery(orderId);
  const { data: entitlements } = useMyEntitlementsQuery();
  const settings = useCheckoutSettings();

  const justPaid = state?.justPaid === true && order?.Status === "Paid";
  const firstCourseId = order?.Items.find((line) => line.CourseId)?.CourseId ?? null;

  // The refund window is a promise made to the buyer, so it is read from the platform settings rather than assumed.
  const refundWindowDays = settings.data?.RefundWindowDays;
  const refundWindowEndsAt =
    order?.PaidAt && typeof refundWindowDays === "number"
      ? new Date(new Date(order.PaidAt).getTime() + refundWindowDays * 86_400_000)
      : null;
  // The same window decides whether a refund may be requested. A window of 0 days means "no window" on the server, and
  // an unknown window (settings still loading) is left to the server to judge rather than hiding the option.
  const withinRefundWindow =
    !refundWindowEndsAt || (typeof refundWindowDays === "number" && refundWindowDays <= 0) || refundWindowEndsAt > new Date();

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="print:hidden">
        <ApplicantSidebar onCollapse={setSidebarCollapsed} />
        <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />
      </div>

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0",
          "print:p-0 print:m-0 print:pt-0"
        )}
      >
        <div className="max-w-3xl mx-auto space-y-6 print:max-w-none print:space-y-4">
          <div className="print:hidden">
            <Button variant="ghost" size="sm" className="-ms-2 mb-2 text-muted-foreground" asChild>
              <Link to="/purchases">
                <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" aria-hidden="true" />
                {t("order.title")}
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : isError || !order ? (
            <div className="text-center py-16 space-y-2" data-testid="receipt-error">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" aria-hidden="true" />
              <p className="text-destructive">{getApiError(error, t("order.loadFailed"))}</p>
              <Button variant="outline" className="mt-2" asChild>
                <Link to="/purchases">{t("order.title")}</Link>
              </Button>
            </div>
          ) : (
            <>
              {justPaid && (
                <Card className="border-success/30 bg-success/5 print:hidden" data-testid="receipt-success">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-success">{t("checkout.success.title")}</p>
                        <p className="text-sm text-muted-foreground">{t("checkout.success.description")}</p>
                      </div>
                    </div>
                    <Button size="sm" asChild>
                      <Link to={state?.returnTo ?? (firstCourseId ? `/courses/${firstCourseId}` : "/courses")}>
                        {t("checkout.success.goToCourse")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-2xl">
                        <Receipt className="w-6 h-6 text-primary print:hidden" aria-hidden="true" />
                        {t("order.receiptTitle")}
                      </CardTitle>
                      <CardDescription data-testid="receipt-reference">
                        {t("order.receiptSubtitle", { reference: order.ProviderRef })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={order.Status} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="print:hidden"
                        onClick={() => window.print()}
                        data-testid="receipt-print"
                      >
                        <Printer className="h-4 w-4 me-2" aria-hidden="true" />
                        {t("order.print")}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("order.placedAt")}</dt>
                      <dd>{formatDateTime(order.PlacedAt)}</dd>
                    </div>
                    {order.PaidAt && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("order.paidAt")}</dt>
                        <dd data-testid="receipt-paid-at">{formatDateTime(order.PaidAt)}</dd>
                      </div>
                    )}
                    {order.CancelledAt && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("order.cancelledAt")}</dt>
                        <dd>{formatDateTime(order.CancelledAt)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("order.provider")}</dt>
                      <dd>
                        {t(
                          order.Provider === "mock" || order.Provider === "manual"
                            ? `checkout.provider.${order.Provider}`
                            : "checkout.provider.other",
                          { name: order.Provider }
                        )}
                      </dd>
                    </div>
                    {order.PaymentReference && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("order.paymentReference")}</dt>
                        <dd className="font-mono text-xs">{order.PaymentReference}</dd>
                      </div>
                    )}
                    {order.CouponCode && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("order.coupon")}</dt>
                        <dd className="font-mono text-xs">{order.CouponCode}</dd>
                      </div>
                    )}
                    {order.FailureReason && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("order.failureReason")}</dt>
                        <dd className="text-destructive">{order.FailureReason}</dd>
                      </div>
                    )}
                  </dl>

                  <Separator />

                  <div className="space-y-3" data-testid="receipt-lines">
                    <p className="text-sm font-medium">{t("order.items")}</p>
                    {order.Items.map((line) => {
                      const granted = activeEntitlementFor(entitlements, line.ItemType, line.ItemId);
                      return (
                        <div key={line.LineId} className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{line.Title || t("common.unknownItem")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t(`common.itemType.${line.ItemType}`)}
                              {order.Status === "Paid" && (
                                <>
                                  {" · "}
                                  <span data-testid={`line-access-${line.LineId}`}>
                                    {t("entitlement.title")}:{" "}
                                    {granted ? t("entitlement.status.Active") : t("entitlement.status.Revoked")}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="tabular-nums">{formatCurrency(line.LineTotal, order.Currency)}</p>
                            {line.DiscountAmount > 0 && (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {t("order.lineDiscount")}: -{formatCurrency(line.DiscountAmount, order.Currency)}
                              </p>
                            )}
                            {line.RefundedAmount > 0 && (
                              <p className="text-xs text-primary tabular-nums">
                                {t("order.refundedAmount")}: {formatCurrency(line.RefundedAmount, order.Currency)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("order.subtotal")}</dt>
                      <dd className="tabular-nums">{formatCurrency(order.Subtotal, order.Currency)}</dd>
                    </div>
                    {order.DiscountAmount > 0 && (
                      <div className="flex justify-between text-success">
                        <dt>{t("order.discount")}</dt>
                        <dd className="tabular-nums">-{formatCurrency(order.DiscountAmount, order.Currency)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-semibold pt-1">
                      <dt>{t("order.total")}</dt>
                      <dd className="tabular-nums" data-testid="receipt-total">
                        {formatCurrency(order.Total, order.Currency)}
                      </dd>
                    </div>
                    {order.RefundedAmount > 0 && (
                      <div className="flex justify-between text-primary" data-testid="receipt-refunded">
                        <dt>{t("order.refundedAmount")}</dt>
                        <dd className="tabular-nums">-{formatCurrency(order.RefundedAmount, order.Currency)}</dd>
                      </div>
                    )}
                  </dl>

                  {refundWindowEndsAt && (
                    <Badge
                      variant="outline"
                      className="font-normal text-muted-foreground"
                      data-testid="receipt-refund-window"
                    >
                      {t("order.refundWindow")}:{" "}
                      {refundWindowEndsAt > new Date()
                        ? t("order.refundWindowEndsAt", { date: formatDate(refundWindowEndsAt) })
                        : t("order.refundWindowClosed")}
                    </Badge>
                  )}

                  <RefundRequestPanel order={order} withinRefundWindow={withinRefundWindow} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrderReceipt;
