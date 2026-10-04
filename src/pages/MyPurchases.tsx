import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, Receipt, ShoppingBag, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { OrderStatusBadge } from "@/components/billing";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, type OrderDto } from "@/hooks/useBilling";
import { MY_ORDERS_PAGE_SIZE, useCancelMyOrder, useMyOrdersQuery } from "@/hooks/useOrders";

const ALL = "all";

/**
 * "My purchases" — the trainer's own order history (`GET /api/orders/me`, `orders.self`).
 *
 * Each row is one order with its status badge, what it contained (the `Title` snapshots taken at checkout, so a later
 * rename or deletion never rewrites a receipt) and what it cost. An order still awaiting payment can be resumed or
 * cancelled from here; nothing was charged either way.
 */
const MyPurchases = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["billing", "common"]);
  const { formatDate, formatCurrency, formatNumber } = useFormatters();
  const { toast } = useToast();

  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pendingCancel, setPendingCancel] = useState<OrderDto | null>(null);

  const filters = { status: status === ALL ? undefined : status, page, pageSize: MY_ORDERS_PAGE_SIZE };
  const { data, isLoading, isError, error } = useMyOrdersQuery(filters);
  const cancelOrder = useCancelMyOrder();

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / MY_ORDERS_PAGE_SIZE));

  const handleStatusChange = (next: string) => {
    setStatus(next);
    setPage(1);
  };

  const handleCancel = async () => {
    if (!pendingCancel) return;
    const order = pendingCancel;
    setPendingCancel(null);
    try {
      await cancelOrder.mutateAsync(order.Id);
      toast({ title: t("order.cancelled") });
    } catch (err) {
      toast({ title: t("order.cancelFailed"), description: getApiError(err), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0"
        )}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ShoppingBag className="w-7 h-7 text-primary" aria-hidden="true" />
                {t("order.title")}
              </h1>
              <p className="text-muted-foreground mt-1">{t("order.subtitle")}</p>
            </div>
            <div className="w-full sm:w-56">
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger aria-label={t("common.status")}>
                  <SelectValue placeholder={t("common.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("common.allStatuses")}</SelectItem>
                  {ORDER_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`orderStatus.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : isError ? (
            <div className="text-center py-16 space-y-2" data-testid="orders-error">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" aria-hidden="true" />
              <p className="text-destructive">{getApiError(error, t("order.loadFailed"))}</p>
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-2" data-testid="orders-empty">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="font-medium">{t("order.empty")}</p>
                <p className="text-sm text-muted-foreground">{t("order.emptyHint")}</p>
                <Button variant="outline" className="mt-2" asChild>
                  <Link to="/catalog">{t("order.browseCatalog")}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="orders-list">
              {orders.map((order) => (
                <Card key={order.Id} data-testid={`order-${order.Id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">{order.ProviderRef}</span>
                          <OrderStatusBadge status={order.Status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("order.placedAt")}: {formatDate(order.PlacedAt)}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-semibold tabular-nums">{formatCurrency(order.Total, order.Currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("order.itemsCount", { count: order.Items.length })}
                        </p>
                      </div>
                    </div>

                    <ul className="text-sm text-muted-foreground space-y-0.5">
                      {order.Items.map((line) => (
                        <li key={line.LineId} className="truncate">
                          {line.Title || t("common.unknownItem")}
                          <span className="text-xs"> · {t(`common.itemType.${line.ItemType}`)}</span>
                        </li>
                      ))}
                    </ul>

                    {order.CouponCode && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Ticket className="h-3 w-3" aria-hidden="true" />
                        {order.CouponCode}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/purchases/${order.Id}`}>{t("order.viewReceipt")}</Link>
                      </Button>
                      {order.Status === "PendingPayment" && (
                        <>
                          <Button size="sm" asChild>
                            <Link to={`/checkout?${order.Items.map((i) => `item=${i.ItemType}:${i.ItemId}`).join("&")}`}>
                              {t("order.payNow")}
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingCancel(order)}
                            disabled={cancelOrder.isPending}
                          >
                            {t("order.cancel")}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {total > MY_ORDERS_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t("order.pageInfo", {
                      page: formatNumber(page),
                      pages: formatNumber(totalPages),
                      count: formatNumber(total),
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      {t("common:actions.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("common:actions.next")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!pendingCancel} onOpenChange={(open) => !open && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("order.cancelConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("order.cancelConfirmHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.close")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleCancel()}>{t("order.cancel")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyPurchases;
