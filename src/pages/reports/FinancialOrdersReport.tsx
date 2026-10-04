import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Download, Hash, Loader2, Receipt, RotateCcw, Search, Wallet } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/routing/Can";
import api, { getApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import { INVOICE_STATUSES } from "@/hooks/useInvoices";
import {
    INVOICE_REPORT_PAGE_SIZE,
    fetchInvoiceReport,
    useInvoiceReportQuery,
    type InvoiceReportFilters,
    type InvoiceReportRowDto,
} from "@/hooks/useInvoiceReport";

const ALL = "all";
/** The providers this platform ships with (same list as AdminOrders' provider filter). */
const KNOWN_PROVIDERS = ["mock", "manual"] as const;
/** CSV export walks every page of the generated report, at the server's max page size, up to this many rows. */
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 10_000;

interface FinancialFilters {
    status: string;
    provider: string;
    itemId: string;
    search: string;
    from: string;
    to: string;
}

const INITIAL_FILTERS: FinancialFilters = { status: ALL, provider: ALL, itemId: ALL, search: "", from: "", to: "" };

const toQuery = (f: FinancialFilters, page: number): InvoiceReportFilters => ({
    status: f.status === ALL ? undefined : f.status,
    provider: f.provider === ALL ? undefined : f.provider,
    itemId: f.itemId === ALL ? undefined : f.itemId,
    search: f.search.trim() || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    page,
    pageSize: INVOICE_REPORT_PAGE_SIZE,
});

interface CourseOption { Id: string; Title: string }

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const FinancialOrdersReportBody = () => {
    const { t } = useTranslation(["organization", "billing", "common"]);
    const { formatCurrency, formatDate, formatNumber } = useFormatters();
    const { toast } = useToast();
    const report = useReportBuilder<FinancialFilters>(INITIAL_FILTERS);
    const { filters, setFilter } = report;
    const [page, setPage] = useState(1);
    const [exporting, setExporting] = useState(false);
    const rangeValid = !filters.from || !filters.to || filters.from <= filters.to;

    const { data: courses = [] } = useQuery({
        queryKey: ["organization", "reports", "course-options"],
        queryFn: async () => {
            const res = await api.get<CourseOption[]>("/Courses", { params: { pageSize: 100 } });
            return Array.isArray(res.data) ? res.data : [];
        },
    });

    const applied = report.appliedFilters ? toQuery(report.appliedFilters, page) : null;
    const { data, isLoading, isFetching, isError, error } = useInvoiceReportQuery(applied, {
        enabled: report.hasGenerated,
        runId: report.runId,
    });

    const rows = data?.Items.Items ?? [];
    const total = data?.Items.Total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / INVOICE_REPORT_PAGE_SIZE));
    const money = (amount: number, currency?: string | null) =>
        currency ? formatCurrency(amount, currency) : formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const providerLabel = (name: string) => t(`billing:checkout.provider.${name}`, { defaultValue: name });
    const statusLabel = (status: string) => t(`reports.financial.statuses.${status}`, { defaultValue: status });

    const handleGenerate = () => {
        setPage(1);
        report.generate();
    };

    const handleExport = async () => {
        if (!report.appliedFilters) return;
        setExporting(true);
        try {
            const all: InvoiceReportRowDto[] = [];
            for (let p = 1; all.length < EXPORT_MAX_ROWS; p++) {
                const chunk = await fetchInvoiceReport({ ...toQuery(report.appliedFilters, p), pageSize: EXPORT_PAGE_SIZE });
                all.push(...chunk.Items.Items);
                if (chunk.Items.Items.length < EXPORT_PAGE_SIZE || all.length >= chunk.Items.Total) break;
            }
            const csv = [
                [t("reports.financial.table.number"), t("reports.financial.table.buyer"), t("reports.financial.table.issuedAt"),
                    t("reports.financial.table.status"), t("reports.financial.table.currency"), t("reports.financial.table.tax"),
                    t("reports.financial.table.total"), t("reports.financial.summary.totalRefunded"), t("reports.financial.table.orderId")],
                ...all.map((r) => [r.InvoiceNumber, r.BuyerNameSnapshot, r.IssuedAt, r.Status, r.Currency, r.TaxAmount, r.Total, r.RefundedAmount, r.OrderId ?? ""]),
            ].map((line) => line.map(csvCell).join(",")).join("\n");
            const fileName = `financial-orders-report-${new Date().toISOString().slice(0, 10)}.csv`;
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: t("reports.financial.exported"), description: fileName });
        } catch (err) {
            toast({ variant: "destructive", title: t("reports.financial.exportFailed"), description: getApiError(err) });
        } finally {
            setExporting(false);
        }
    };

    const summary = data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="financial-summary">
            {[
                { key: "count", icon: Hash, value: formatNumber(data.Count), color: "text-primary bg-primary/10" },
                { key: "totalAmount", icon: Wallet, value: money(data.TotalAmount, data.Currency), color: "text-emerald-500 bg-emerald-500/10" },
                { key: "totalTax", icon: Receipt, value: money(data.TotalTax, data.Currency), color: "text-amber-500 bg-amber-500/10" },
                { key: "totalRefunded", icon: RotateCcw, value: money(data.TotalRefunded, data.Currency), color: "text-destructive bg-destructive/10" },
            ].map((kpi) => (
                <Card key={kpi.key} className="border-border/50">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", kpi.color)}>
                            <kpi.icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{t(`reports.financial.summary.${kpi.key}`)}</p>
                            <p className="text-xl font-black tabular-nums" data-testid={`financial-${kpi.key}`}>{kpi.value}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
            {data.Currency === null && data.Count > 0 && (
                <p className="text-xs text-muted-foreground sm:col-span-4">{t("reports.financial.summary.mixedCurrencies")}</p>
            )}
        </div>
    );

    const results = (
        <div className="space-y-4">
            {summary}
            <Card className="border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.financial.table.number")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.financial.table.buyer")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("reports.financial.table.issuedAt")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("reports.financial.table.tax")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.financial.table.total")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.financial.table.status")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr
                                        key={row.Id}
                                        className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}
                                        data-testid={`invoice-row-${row.Id}`}
                                    >
                                        <td className="px-5 py-3.5 font-mono text-xs">{row.InvoiceNumber}</td>
                                        <td className="px-5 py-3.5 font-semibold">{row.BuyerNameSnapshot}</td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{formatDate(row.IssuedAt)}</td>
                                        <td className="px-5 py-3.5 hidden md:table-cell tabular-nums">{money(row.TaxAmount ?? 0, row.Currency)}</td>
                                        <td className="px-5 py-3.5 font-semibold tabular-nums">
                                            {money(row.Total, row.Currency)}
                                            {row.RefundedAmount > 0 && (
                                                <p className="text-xs font-normal text-destructive">
                                                    {t("reports.financial.table.refunded", { amount: money(row.RefundedAmount, row.Currency) })}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <Badge variant={row.Status === "Voided" ? "destructive" : "secondary"}>{statusLabel(row.Status)}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {total > INVOICE_REPORT_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {t("reports.financial.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), total: formatNumber(total) })}
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
        </div>
    );

    return (
        <ReportBuilder
            title={t("reports.financial.title")}
            description={t("reports.financial.subtitle")}
            icon={Receipt}
            backTo="/organization/reports"
            onGenerate={handleGenerate}
            hasGenerated={report.hasGenerated}
            canGenerate={rangeValid}
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
            error={error}
            errorMessage={t("reports.financial.loadFailed")}
            isEmpty={!!data && data.Count === 0}
            emptyMessage={t("reports.financial.empty")}
            actions={
                <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
                    {exporting ? <Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4 me-2" aria-hidden="true" />}
                    {exporting ? t("reports.financial.exporting") : t("reports.financial.export")}
                </Button>
            }
            filters={
                <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="fin-report-search">{t("reports.financial.search")}</Label>
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                <Input
                                    id="fin-report-search"
                                    className="ps-9"
                                    placeholder={t("reports.financial.searchPlaceholder")}
                                    value={filters.search}
                                    onChange={(e) => setFilter("search", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t("reports.financial.status")}</Label>
                            <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
                                <SelectTrigger aria-label={t("reports.financial.status")}>
                                    <SelectValue placeholder={t("reports.financial.allStatuses")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("reports.financial.allStatuses")}</SelectItem>
                                    {INVOICE_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t("reports.financial.provider")}</Label>
                            <Select value={filters.provider} onValueChange={(v) => setFilter("provider", v)}>
                                <SelectTrigger aria-label={t("reports.financial.provider")}>
                                    <SelectValue placeholder={t("reports.financial.allProviders")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("reports.financial.allProviders")}</SelectItem>
                                    {KNOWN_PROVIDERS.map((p) => (
                                        <SelectItem key={p} value={p}>{providerLabel(p)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t("reports.financial.course")}</Label>
                            <Select value={filters.itemId} onValueChange={(v) => setFilter("itemId", v)}>
                                <SelectTrigger aria-label={t("reports.financial.course")}>
                                    <SelectValue placeholder={t("reports.financial.allCourses")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("reports.financial.allCourses")}</SelectItem>
                                    {courses.map((c) => (
                                        <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="fin-report-from">{t("reports.builder.from")}</Label>
                            <Input id="fin-report-from" type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="fin-report-to">{t("reports.builder.to")}</Label>
                            <Input id="fin-report-to" type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
                        </div>
                    </div>
                    {!rangeValid && <p className="text-xs text-destructive" role="alert">{t("reports.builder.invalidRange")}</p>}
                </div>
            }
            results={results}
        />
    );
};

/** Financial/Orders report (`GET /api/organization/invoices/report`, permission `invoices.view`). */
const FinancialOrdersReport = () => {
    const { t } = useTranslation("organization");
    return (
        <OrganizationPageLayout>
            <Can
                permission={PERMISSIONS.invoicesView}
                fallback={
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-muted-foreground" data-testid="report-no-access">
                            {t("reports.financial.noAccess")}
                        </CardContent>
                    </Card>
                }
            >
                <FinancialOrdersReportBody />
            </Can>
        </OrganizationPageLayout>
    );
};

export default FinancialOrdersReport;
