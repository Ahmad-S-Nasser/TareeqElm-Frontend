/**
 * Order management for somebody else's orders (catalog v12's ownership-based split).
 *
 * The body lives in its own component (rather than in the page) so the same table/filters/detail-dialog can be
 * mounted under the Admin shell (`AdminOrders`) as well as the Organization one (`OrganizationOrders`), the way
 * `CatalogPricingManager`/`CouponsManager`/`PayoutsManager` are shared. The backend scopes every order by ownership
 * (the same "null owner" convention Course/Enrollment/Coupon/Payout use): Admin manages platform-owned orders only,
 * Organization its own tenant's — nothing here needs to know which caller it is.
 *
 * `AdminOrderDetail` (the refund/mark-paid/re-apply dialog) is reused as-is: its own gates already split
 * `refunds.manage` (Admin-only, hidden for Organization) from `ordersManage` (now shared), so it needs no change.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2, Receipt, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/billing";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ORDER_STATUSES } from "@/hooks/useBilling";
import {
    ADMIN_ORDERS_PAGE_SIZE,
    useAdminOrdersQuery,
    useExportOrders,
    type AdminOrderDto,
    type AdminOrderFilters,
} from "@/hooks/useAdminOrders";
import AdminOrderDetail from "@/pages/AdminOrderDetail";

const ALL = "all";

/** The providers this platform ships with. Anything a row actually carries is added on top, so a new gateway shows up
 *  in the filter the moment its first order exists — no frontend release needed. */
const KNOWN_PROVIDERS = ["mock", "manual"] as const;

export const OrdersManager = () => {
    const { t } = useTranslation(["billing", "common"]);
    const { formatCurrency, formatDate, formatNumber } = useFormatters();
    const { toast } = useToast();

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState(ALL);
    const [provider, setProvider] = useState(ALL);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [buyer, setBuyer] = useState<{ id: string; name: string } | null>(null);
    const [item, setItem] = useState<{ id: string; title: string } | null>(null);
    const [page, setPage] = useState(1);
    const [openOrderId, setOpenOrderId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const filters: AdminOrderFilters = {
        status: status === ALL ? undefined : status,
        provider: provider === ALL ? undefined : provider,
        userId: buyer?.id,
        itemId: item?.id,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        page,
        pageSize: ADMIN_ORDERS_PAGE_SIZE,
    };

    const { data, isLoading, isError, error, isFetching } = useAdminOrdersQuery(filters);
    const exportOrders = useExportOrders();

    const orders = useMemo(() => data?.items ?? [], [data]);
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE));

    const providerOptions = useMemo(() => {
        const seen = new Set<string>(KNOWN_PROVIDERS);
        for (const order of orders) if (order.Provider) seen.add(order.Provider);
        return [...seen].sort();
    }, [orders]);

    const providerLabel = (name: string) =>
        name === "mock" || name === "manual" ? t(`checkout.provider.${name}`) : name;

    const resetPaged = <T,>(setter: (value: T) => void) => (value: T) => {
        setter(value);
        setPage(1);
    };

    const handleExport = async () => {
        try {
            const fileName = await exportOrders.mutateAsync(filters);
            toast({ title: t("common.exported", { file: fileName }) });
        } catch (err) {
            toast({ variant: "destructive", title: t("common.exportFailed"), description: getApiError(err) });
        }
    };

    const firstLine = (order: AdminOrderDto) => order.Items[0];

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <Receipt className="w-7 h-7 text-primary" aria-hidden="true" />
                        {t("order.adminTitle")}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("order.adminSubtitle")}</p>
                </div>
                <Can permission={PERMISSIONS.ordersManage}>
                    <Button variant="outline" onClick={() => void handleExport()} disabled={exportOrders.isPending}>
                        <Download className="w-4 h-4 me-2" aria-hidden="true" />
                        {exportOrders.isPending ? t("common.exporting") : t("common.export")}
                    </Button>
                </Can>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative lg:col-span-2">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                        className="ps-9"
                        placeholder={t("order.searchPlaceholder")}
                        aria-label={t("common.search")}
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                    />
                </div>
                <Select value={status} onValueChange={resetPaged(setStatus)}>
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
                <Select value={provider} onValueChange={resetPaged(setProvider)}>
                    <SelectTrigger aria-label={t("order.filterProvider")}>
                        <SelectValue placeholder={t("order.allProviders")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("order.allProviders")}</SelectItem>
                        {providerOptions.map((value) => (
                            <SelectItem key={value} value={value}>
                                {providerLabel(value)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Label htmlFor="orders-from" className="sr-only">
                            {t("common.from")}
                        </Label>
                        <Input
                            id="orders-from"
                            type="date"
                            aria-label={t("common.from")}
                            value={from}
                            onChange={(event) => resetPaged(setFrom)(event.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <Label htmlFor="orders-to" className="sr-only">
                            {t("common.to")}
                        </Label>
                        <Input
                            id="orders-to"
                            type="date"
                            aria-label={t("common.to")}
                            value={to}
                            onChange={(event) => resetPaged(setTo)(event.target.value)}
                        />
                    </div>
                </div>
            </div>

            {(buyer || item) && (
                <div className="flex flex-wrap gap-2" data-testid="active-filters">
                    {buyer && (
                        <Badge variant="secondary" className="gap-1.5">
                            {t("order.filterBuyer")}: {buyer.name}
                            <button
                                type="button"
                                aria-label={`${t("common.reset")} ${t("order.filterBuyer")}`}
                                onClick={() => {
                                    setBuyer(null);
                                    setPage(1);
                                }}
                            >
                                <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                        </Badge>
                    )}
                    {item && (
                        <Badge variant="secondary" className="gap-1.5">
                            {t("order.filterItem")}: {item.title}
                            <button
                                type="button"
                                aria-label={`${t("common.reset")} ${t("order.filterItem")}`}
                                onClick={() => {
                                    setItem(null);
                                    setPage(1);
                                }}
                            >
                                <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                        </Badge>
                    )}
                </div>
            )}

            <Card className="border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("order.reference")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("order.buyer")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("order.items")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("order.total")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("order.provider")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("common.status")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("order.placedAt")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary inline" aria-hidden="true" />
                                        </td>
                                    </tr>
                                )}
                                {isError && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-destructive" data-testid="orders-error">
                                            {getApiError(error, t("order.loadFailed"))}
                                        </td>
                                    </tr>
                                )}
                                {!isLoading &&
                                    !isError &&
                                    orders.map((order) => {
                                        const line = firstLine(order);
                                        return (
                                            <tr
                                                key={order.Id}
                                                className={cn(
                                                    "border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer",
                                                    isFetching && "opacity-70"
                                                )}
                                                data-testid={`order-row-${order.Id}`}
                                                onClick={() => setOpenOrderId(order.Id)}
                                            >
                                                <td className="px-5 py-3.5">
                                                    <button
                                                        type="button"
                                                        className="font-mono text-xs text-start hover:underline"
                                                        aria-label={t("order.openDetails")}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setOpenOrderId(order.Id);
                                                        }}
                                                    >
                                                        {order.ProviderRef}
                                                    </button>
                                                </td>
                                                <td className="px-5 py-3.5 font-semibold">
                                                    <button
                                                        type="button"
                                                        className="hover:underline text-start"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setBuyer({ id: order.UserId, name: order.BuyerName ?? t("common.unknownUser") });
                                                            setPage(1);
                                                        }}
                                                    >
                                                        {order.BuyerName ?? t("common.unknownUser")}
                                                    </button>
                                                </td>
                                                <td className="px-5 py-3.5 hidden md:table-cell">
                                                    {line ? (
                                                        <button
                                                            type="button"
                                                            className="text-start hover:underline"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setItem({
                                                                    id: line.ItemId,
                                                                    title: line.ResolvedTitle ?? line.Title ?? t("common.unknownItem"),
                                                                });
                                                                setPage(1);
                                                            }}
                                                        >
                                                            {line.ResolvedTitle ?? line.Title ?? t("common.unknownItem")}
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted-foreground">{t("common.none")}</span>
                                                    )}
                                                    {order.Items.length > 1 && (
                                                        <span className="text-xs text-muted-foreground ms-1">
                                                            +{formatNumber(order.Items.length - 1)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 font-semibold tabular-nums">
                                                    {formatCurrency(order.Total, order.Currency)}
                                                    {order.RefundedAmount > 0 && (
                                                        <span className="block text-xs font-normal text-muted-foreground">
                                                            {t("order.refundedAmount")}: {formatCurrency(order.RefundedAmount, order.Currency)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">
                                                    {providerLabel(order.Provider)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <OrderStatusBadge status={order.Status} />
                                                </td>
                                                <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">
                                                    {formatDate(order.PlacedAt)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                {!isLoading && !isError && orders.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-muted-foreground" data-testid="orders-empty">
                                            {t("order.adminEmpty")}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {total > ADMIN_ORDERS_PAGE_SIZE && (
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
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            {t("common:actions.next")}
                        </Button>
                    </div>
                </div>
            )}

            <AdminOrderDetail orderId={openOrderId} onOpenChange={(open) => !open && setOpenOrderId(null)} />
        </>
    );
};
