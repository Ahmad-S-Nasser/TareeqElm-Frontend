import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, Search } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { InvoiceStatusBadge } from "@/components/billing/InvoiceStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  INVOICE_STATUSES,
  ORGANIZATION_INVOICES_PAGE_SIZE,
  useOrganizationInvoicesQuery,
  type InvoiceFilters,
} from "@/hooks/useInvoices";

const ALL = "all";

/**
 * Organization → Invoices (`GET /api/organization/invoices`, permission `invoices.view`).
 *
 * The same table shape as {@link AdminOrders}: a debounced search, a status select and a date range, a paged body with
 * explicit loading/empty/error rows, and a pagination footer only once there is more than one page. A row opens the
 * printable invoice document at `/organization/invoices/:id`.
 */
const OrganizationInvoicesTable = () => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDate, formatNumber } = useFormatters();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: InvoiceFilters = {
    status: status === ALL ? undefined : status,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    page,
    pageSize: ORGANIZATION_INVOICES_PAGE_SIZE,
  };

  const { data, isLoading, isError, error, isFetching } = useOrganizationInvoicesQuery(filters);
  const invoices = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ORGANIZATION_INVOICES_PAGE_SIZE));

  const resetPaged = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const open = (id: string) => navigate(`/organization/invoices/${id}`);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="ps-9"
            placeholder={t("invoice.searchPlaceholder")}
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
            {INVOICE_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`invoice.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="invoices-from" className="sr-only">
              {t("common.from")}
            </Label>
            <Input
              id="invoices-from"
              type="date"
              aria-label={t("common.from")}
              value={from}
              onChange={(event) => resetPaged(setFrom)(event.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="invoices-to" className="sr-only">
              {t("common.to")}
            </Label>
            <Input
              id="invoices-to"
              type="date"
              aria-label={t("common.to")}
              value={to}
              onChange={(event) => resetPaged(setTo)(event.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("invoice.columns.number")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("invoice.columns.issuedAt")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("invoice.columns.buyer")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("invoice.columns.total")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("invoice.columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary inline" aria-hidden="true" />
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-destructive" data-testid="invoices-error">
                      {getApiError(error, t("invoice.loadFailed"))}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  invoices.map((invoice) => (
                    <tr
                      key={invoice.Id}
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer",
                        isFetching && "opacity-70"
                      )}
                      data-testid={`invoice-row-${invoice.Id}`}
                      onClick={() => open(invoice.Id)}
                    >
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          className="font-mono text-xs text-start hover:underline"
                          aria-label={t("invoice.open", { number: invoice.InvoiceNumber })}
                          onClick={(event) => {
                            event.stopPropagation();
                            open(invoice.Id);
                          }}
                        >
                          <bdi>{invoice.InvoiceNumber}</bdi>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{formatDate(invoice.IssuedAt)}</td>
                      <td className="px-5 py-3.5 font-semibold">{invoice.BuyerNameSnapshot}</td>
                      <td className="px-5 py-3.5 font-semibold tabular-nums">
                        {formatCurrency(invoice.Total, invoice.Currency)}
                        {invoice.RefundedAmount > 0 && (
                          <p className="text-xs font-normal text-destructive" data-testid={`invoice-refunded-${invoice.Id}`}>
                            {t("invoice.columns.refunded", { amount: formatCurrency(invoice.RefundedAmount, invoice.Currency) })}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <InvoiceStatusBadge status={invoice.Status} />
                      </td>
                    </tr>
                  ))}
                {!isLoading && !isError && invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground" data-testid="invoices-empty">
                      {t("invoice.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > ORGANIZATION_INVOICES_PAGE_SIZE && (
        <div className="flex items-center justify-between" data-testid="invoices-pagination">
          <p className="text-xs text-muted-foreground">
            {t("invoice.pageInfo", {
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
    </>
  );
};

const OrganizationInvoices = () => {
  const { t } = useTranslation("billing");

  return (
    <OrganizationPageLayout>
      <div className="animate-slide-up">
        <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
          <FileText className="h-8 w-8 text-primary" aria-hidden="true" />
          {t("invoice.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("invoice.subtitle")}</p>
      </div>

      <Can
        permission={PERMISSIONS.invoicesView}
        fallback={
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground" data-testid="invoices-no-access">
            {t("invoice.noAccess")}
          </p>
        }
      >
        <div className="space-y-6">
          <OrganizationInvoicesTable />
        </div>
      </Can>
    </OrganizationPageLayout>
  );
};

export default OrganizationInvoices;
